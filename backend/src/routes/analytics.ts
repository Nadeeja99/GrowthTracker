import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { dateRangeSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user analytics overview
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate } = dateRangeSchema.parse(req.query);

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    const [goals, tasks, habits] = await Promise.all([
      prisma.goal.findMany({
        where: {
          userId,
          createdAt: { gte: start, lte: end }
        },
        select: { status: true, progress: true }
      }),
      prisma.task.findMany({
        where: {
          userId,
          createdAt: { gte: start, lte: end }
        },
        select: { status: true, estimatedTime: true, actualTime: true }
      }),
      prisma.habit.findMany({
        where: {
          userId,
          createdAt: { gte: start, lte: end }
        },
        include: {
          completions: {
            where: {
              date: { gte: start, lte: end }
            }
          }
        }
      })
    ]);

    // Calculate analytics
    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.status === 'COMPLETED').length;
    const goalProgress = goals.reduce((sum, g) => sum + g.progress, 0) / totalGoals || 0;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const totalEstimatedTime = tasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
    const totalActualTime = tasks.reduce((sum, t) => sum + (t.actualTime || 0), 0);
    const timeEfficiency = totalEstimatedTime > 0 ? (totalActualTime / totalEstimatedTime) * 100 : 0;

    const habitStreak = habits.reduce((total, habit) => {
      const completions = habit.completions.length;
      const expectedCompletions = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      return total + (completions / expectedCompletions);
    }, 0) / habits.length || 0;

    const analytics = {
      period: { start, end },
      goals: {
        total: totalGoals,
        completed: completedGoals,
        completionRate: totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0,
        averageProgress: Math.round(goalProgress),
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        completionRate: Math.round(taskCompletionRate),
        timeEfficiency: Math.round(timeEfficiency),
        totalEstimatedTime,
        totalActualTime,
      },
      habits: {
        total: habits.length,
        averageStreak: Math.round(habitStreak * 100),
      },
      productivity: {
        overall: Math.round((goalProgress + taskCompletionRate + habitStreak * 100) / 3),
      }
    };

    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    logger.error('Get analytics overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics overview'
    });
  }
});

// Get weekly trends
router.get('/weekly-trends', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate } = dateRangeSchema.parse(req.query);

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const end = endDate ? new Date(endDate) : new Date();

    const weeklyData: Array<{ week: string; tasks: number; habitCompletions: number }> = [];
    const current = new Date(start);

    while (current <= end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current.getTime() + 6 * 24 * 60 * 60 * 1000);

      const [weekTasks, weekHabits] = await Promise.all([
        prisma.task.count({
          where: {
            userId,
            createdAt: { gte: weekStart, lte: weekEnd }
          }
        }),
        prisma.habitCompletion.count({
          where: {
            habit: { userId },
            date: { gte: weekStart, lte: weekEnd }
          }
        })
      ]);

      weeklyData.push({
        week: weekStart.toISOString().split('T')[0],
        tasks: weekTasks,
        habitCompletions: weekHabits,
      });

      current.setDate(current.getDate() + 7);
    }

    res.json({
      success: true,
      data: { weeklyTrends: weeklyData }
    });
  } catch (error) {
    logger.error('Get weekly trends error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get weekly trends'
    });
  }
});

// Get goal progress analytics
router.get('/goal-progress', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const goals = await prisma.goal.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        progress: true,
        status: true,
        targetDate: true,
        createdAt: true,
        _count: {
          select: { tasks: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const goalAnalytics = goals.map(goal => ({
      ...goal,
      daysRemaining: goal.targetDate ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null,
      progressStatus: goal.progress < 30 ? 'behind' : goal.progress > 70 ? 'ahead' : 'on-track'
    }));

    res.json({
      success: true,
      data: { goalProgress: goalAnalytics }
    });
  } catch (error) {
    logger.error('Get goal progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get goal progress'
    });
  }
});

// Get time allocation analytics
router.get('/time-allocation', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate } = dateRangeSchema.parse(req.query);

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const tasks = await prisma.task.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
        actualTime: { not: null }
      },
      select: {
        actualTime: true,
        goal: { select: { title: true } }
      }
    });

    const timeByGoal = tasks.reduce((acc: Record<string, number>, task) => {
      const goalTitle = task.goal?.title || 'No Goal';
      acc[goalTitle] = (acc[goalTitle] || 0) + (task.actualTime || 0);
      return acc;
    }, {} as Record<string, number>);

    const totalTime = Object.values(timeByGoal).reduce((sum: number, time: number) => sum + time, 0);
    const timeAllocation = Object.entries(timeByGoal).map(([goal, time]) => ({
      goal,
      time,
      percentage: Math.round((time / totalTime) * 100)
    })).sort((a, b) => b.time - a.time);

    res.json({
      success: true,
      data: { timeAllocation }
    });
  } catch (error) {
    logger.error('Get time allocation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get time allocation'
    });
  }
});

export default router;
