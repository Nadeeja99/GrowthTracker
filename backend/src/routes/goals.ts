import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { createGoalSchema, updateGoalSchema, paginationSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new goal
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validatedData = createGoalSchema.parse(req.body);
    const userId = req.user!.id;

    const goal = await prisma.goal.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        priority: validatedData.priority,
        user: {
          connect: { id: userId }
        },
        targetDate: validatedData.targetDate ? new Date(validatedData.targetDate) : null,
      },
      include: {
        milestones: true,
        _count: {
          select: { tasks: true }
        }
      }
    });

    logger.info('Goal created', { goalId: goal.id, userId });

    res.status(201).json({
      success: true,
      message: 'Goal created successfully',
      data: { goal }
    });
  } catch (error) {
    logger.error('Create goal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create goal'
    });
  }
});

// Get all goals for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { page, limit } = paginationSchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where: { userId },
        include: {
          milestones: true,
          _count: {
            select: { tasks: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.goal.count({ where: { userId } })
    ]);

    res.json({
      success: true,
      data: {
        goals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    logger.error('Get goals error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get goals'
    });
  }
});

// Get a specific goal
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: {
        milestones: {
          orderBy: { createdAt: 'asc' }
        },
        tasks: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }

    res.json({
      success: true,
      data: { goal }
    });
  } catch (error) {
    logger.error('Get goal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get goal'
    });
  }
});

// Update a goal
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validatedData = updateGoalSchema.parse(req.body);

    const goal = await prisma.goal.findFirst({
      where: { id, userId }
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }

    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: {
        title: validatedData.title,
        description: validatedData.description,
        priority: validatedData.priority,
        status: validatedData.status,
        progress: validatedData.progress,
        targetDate: validatedData.targetDate ? new Date(validatedData.targetDate) : undefined,
      },
      include: {
        milestones: true,
        _count: {
          select: { tasks: true }
        }
      }
    });

    logger.info('Goal updated', { goalId: id, userId });

    res.json({
      success: true,
      message: 'Goal updated successfully',
      data: { goal: updatedGoal }
    });
  } catch (error) {
    logger.error('Update goal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update goal'
    });
  }
});

// Delete a goal
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const goal = await prisma.goal.findFirst({
      where: { id, userId }
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }

    await prisma.goal.delete({
      where: { id }
    });

    logger.info('Goal deleted', { goalId: id, userId });

    res.json({
      success: true,
      message: 'Goal deleted successfully'
    });
  } catch (error) {
    logger.error('Delete goal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete goal'
    });
  }
});

export default router;
