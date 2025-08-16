import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { updateUserSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Update user profile
router.put('/profile', async (req: AuthRequest, res) => {
  try {
    const validatedData = updateUserSchema.parse(req.body);
    const userId = req.user!.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        timezone: true,
        avatar: true,
        updatedAt: true,
      }
    });

    logger.info('User profile updated', { userId });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// Get user statistics
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const [totalGoals, activeGoals, completedGoals, totalTasks, completedTasks, totalHabits] = await Promise.all([
      prisma.goal.count({ where: { userId } }),
      prisma.goal.count({ where: { userId, status: 'ACTIVE' } }),
      prisma.goal.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.task.count({ where: { userId } }),
      prisma.task.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.habit.count({ where: { userId } }),
    ]);

    const stats = {
      goals: {
        total: totalGoals,
        active: activeGoals,
        completed: completedGoals,
        completionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      habits: {
        total: totalHabits,
      },
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    logger.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user statistics'
    });
  }
});

export default router;
