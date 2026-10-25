import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { dateRangeSchema } from '../utils/validation';
import { addDays, dateKeyInZone, dateOnly, daysBetween, resolveRange } from '../utils/dates';

const router = Router();

// All routes require authentication
router.use(authenticate);

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

// Get user analytics overview
router.get('/overview', async (req: AuthRequest, res) => {
  const { id: userId, timezone } = req.user!;
  const range = resolveRange(dateRangeSchema.parse(req.query), timezone, 30);
  const createdInRange = { gte: range.start, lt: range.endExclusive };

  const [goalsByStatus, activeGoalProgress, tasksByStatus, taskTime, habits, completionsByHabit, focus, completedFocus, reflections] = await Promise.all([
    // Goals are a current snapshot, not filtered by creation date.
    prisma.goal.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
    prisma.goal.aggregate({ where: { userId, status: 'ACTIVE' }, _avg: { progress: true } }),
    prisma.task.groupBy({ by: ['status'], where: { userId, createdAt: createdInRange }, _count: { _all: true } }),
    prisma.task.aggregate({
      where: { userId, createdAt: createdInRange },
      _sum: { estimatedTime: true, actualTime: true },
    }),
    // Every habit counts, not only those created inside the range.
    prisma.habit.findMany({ where: { userId }, select: { id: true, frequency: true, targetCount: true, createdAt: true } }),
    prisma.habitCompletion.groupBy({
      by: ['habitId'],
      where: { habit: { userId }, date: { gte: dateOnly(range.startKey), lte: dateOnly(range.endKey) } },
      _count: { _all: true },
    }),
    prisma.focusSession.aggregate({
      where: { userId, startedAt: createdInRange },
      _sum: { durationSeconds: true },
      _count: { _all: true },
    }),
    prisma.focusSession.count({ where: { userId, startedAt: createdInRange, completed: true } }),
    prisma.reflection.aggregate({
      where: { userId, date: { gte: dateOnly(range.startKey), lte: dateOnly(range.endKey) } },
      _avg: { performance: true, energy: true, mood: true },
      _count: { _all: true },
    }),
  ]);

  const countFor = (groups: Array<{ status: string; _count: { _all: number } }>, status: string) =>
    groups.find(g => g.status === status)?._count._all ?? 0;
  const totalGoals = goalsByStatus.reduce((sum, g) => sum + g._count._all, 0);
  const totalTasks = tasksByStatus.reduce((sum, g) => sum + g._count._all, 0);
  const completedTasks = countFor(tasksByStatus, 'COMPLETED');
  const totalEstimatedTime = taskTime._sum.estimatedTime ?? 0;
  const totalActualTime = taskTime._sum.actualTime ?? 0;

  // Habit completion rate: days with a completion vs. days the habit was
  // expected, counted only from when each habit was created.
  const completionsById = new Map(completionsByHabit.map(c => [c.habitId, c._count._all]));
  const habitRates = habits.flatMap(habit => {
    const createdKey = dateKeyInZone(habit.createdAt, timezone);
    const activeFrom = createdKey > range.startKey ? createdKey : range.startKey;
    if (activeFrom > range.endKey) return [];
    const activeDays = daysBetween(activeFrom, range.endKey);
    const periods = habit.frequency === 'DAILY' ? activeDays
      : habit.frequency === 'WEEKLY' ? Math.ceil(activeDays / 7)
      : Math.ceil(activeDays / 30);
    const expected = habit.frequency === 'DAILY' ? periods : periods * habit.targetCount;
    return [Math.min(1, (completionsById.get(habit.id) ?? 0) / expected)];
  });
  const habitCompletionRate = habitRates.length
    ? Math.round((habitRates.reduce((a, b) => a + b, 0) / habitRates.length) * 100)
    : 0;

  const analytics = {
    period: { startDate: range.startKey, endDate: range.endKey, timezone },
    goals: {
      total: totalGoals,
      active: countFor(goalsByStatus, 'ACTIVE'),
      completed: countFor(goalsByStatus, 'COMPLETED'),
      completionRate: percent(countFor(goalsByStatus, 'COMPLETED'), totalGoals),
      averageActiveProgress: Math.round(activeGoalProgress._avg.progress ?? 0),
    },
    tasks: {
      total: totalTasks,
      completed: completedTasks,
      completionRate: percent(completedTasks, totalTasks),
      timeEfficiency: percent(totalActualTime, totalEstimatedTime),
      totalEstimatedTime,
      totalActualTime,
    },
    habits: {
      total: habits.length,
      completionRate: habitCompletionRate,
    },
    focus: {
      sessions: focus._count._all,
      totalMinutes: Math.round((focus._sum.durationSeconds ?? 0) / 60),
      // Share of sessions that ran to the end rather than being stopped early.
      completionRate: percent(completedFocus, focus._count._all),
    },
    reflections: {
      days: reflections._count._all,
      averagePerformance: round1(reflections._avg.performance),
      averageEnergy: round1(reflections._avg.energy),
      averageMood: round1(reflections._avg.mood),
    },
  };

  res.json({
    success: true,
    data: { analytics }
  });
});

// Get weekly trends: two queries for the whole range, bucketed in memory
router.get('/weekly-trends', async (req: AuthRequest, res) => {
  const { id: userId, timezone } = req.user!;
  const range = resolveRange(dateRangeSchema.parse(req.query), timezone, 28);

  const [tasks, completions] = await Promise.all([
    prisma.task.findMany({
      where: { userId, createdAt: { gte: range.start, lt: range.endExclusive } },
      select: { createdAt: true },
    }),
    prisma.habitCompletion.findMany({
      where: { habit: { userId }, date: { gte: dateOnly(range.startKey), lte: dateOnly(range.endKey) } },
      select: { date: true },
    }),
  ]);

  const weekCount = Math.ceil(daysBetween(range.startKey, range.endKey) / 7);
  const weeklyData = Array.from({ length: weekCount }, (_, i) => ({
    week: addDays(range.startKey, i * 7),
    tasks: 0,
    habitCompletions: 0,
  }));
  const weekIndex = (dateKey: string) => Math.floor((daysBetween(range.startKey, dateKey) - 1) / 7);

  for (const task of tasks) {
    weeklyData[weekIndex(dateKeyInZone(task.createdAt, timezone))].tasks++;
  }
  for (const completion of completions) {
    weeklyData[weekIndex(completion.date.toISOString().slice(0, 10))].habitCompletions++;
  }

  res.json({
    success: true,
    data: { weeklyTrends: weeklyData }
  });
});

// Get goal progress analytics
router.get('/goal-progress', async (req: AuthRequest, res) => {
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
});

// Get time allocation analytics (logged task minutes per goal)
router.get('/time-allocation', async (req: AuthRequest, res) => {
  const { id: userId, timezone } = req.user!;
  const range = resolveRange(dateRangeSchema.parse(req.query), timezone, 30);

  const byGoal = await prisma.task.groupBy({
    by: ['goalId'],
    where: {
      userId,
      createdAt: { gte: range.start, lt: range.endExclusive },
      actualTime: { not: null },
    },
    _sum: { actualTime: true },
  });

  const goalIds = byGoal.map(g => g.goalId).filter((id): id is string => id !== null);
  const goals = goalIds.length
    ? await prisma.goal.findMany({ where: { id: { in: goalIds }, userId }, select: { id: true, title: true } })
    : [];
  const titleById = new Map(goals.map(g => [g.id, g.title]));

  const totalTime = byGoal.reduce((sum, g) => sum + (g._sum.actualTime ?? 0), 0);
  const timeAllocation = byGoal
    .map(g => {
      const time = g._sum.actualTime ?? 0;
      return {
        goalId: g.goalId,
        goal: (g.goalId && titleById.get(g.goalId)) || 'No Goal',
        time,
        percentage: percent(time, totalTime),
      };
    })
    .sort((a, b) => b.time - a.time);

  res.json({
    success: true,
    data: { timeAllocation }
  });
});

export default router;
