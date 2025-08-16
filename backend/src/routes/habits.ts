import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { createHabitSchema, updateHabitSchema, createHabitCompletionSchema, paginationSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new habit
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validatedData = createHabitSchema.parse(req.body);
    const userId = req.user!.id;

    const habit = await prisma.habit.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        frequency: validatedData.frequency,
        targetCount: validatedData.targetCount,
        user: {
          connect: { id: userId }
        },
      }
    });

    logger.info('Habit created', { habitId: habit.id, userId });

    res.status(201).json({
      success: true,
      message: 'Habit created successfully',
      data: { habit }
    });
  } catch (error) {
    logger.error('Create habit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create habit'
    });
  }
});

// Get all habits for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { page, limit } = paginationSchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [habits, total] = await Promise.all([
      prisma.habit.findMany({
        where: { userId },
        include: {
          _count: {
            select: { completions: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.habit.count({ where: { userId } })
    ]);

    res.json({
      success: true,
      data: {
        habits,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    logger.error('Get habits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get habits'
    });
  }
});

// Get a specific habit with completions
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const habit = await prisma.habit.findFirst({
      where: { id, userId },
      include: {
        completions: {
          orderBy: { date: 'desc' },
          take: 30 // Last 30 completions
        }
      }
    });

    if (!habit) {
      return res.status(404).json({
        success: false,
        error: 'Habit not found'
      });
    }

    res.json({
      success: true,
      data: { habit }
    });
  } catch (error) {
    logger.error('Get habit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get habit'
    });
  }
});

// Update a habit
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validatedData = updateHabitSchema.parse(req.body);

    const habit = await prisma.habit.findFirst({
      where: { id, userId }
    });

    if (!habit) {
      return res.status(404).json({
        success: false,
        error: 'Habit not found'
      });
    }

    const updatedHabit = await prisma.habit.update({
      where: { id },
      data: validatedData
    });

    logger.info('Habit updated', { habitId: id, userId });

    res.json({
      success: true,
      message: 'Habit updated successfully',
      data: { habit: updatedHabit }
    });
  } catch (error) {
    logger.error('Update habit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update habit'
    });
  }
});

// Delete a habit
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const habit = await prisma.habit.findFirst({
      where: { id, userId }
    });

    if (!habit) {
      return res.status(404).json({
        success: false,
        error: 'Habit not found'
      });
    }

    await prisma.habit.delete({
      where: { id }
    });

    logger.info('Habit deleted', { habitId: id, userId });

    res.json({
      success: true,
      message: 'Habit deleted successfully'
    });
  } catch (error) {
    logger.error('Delete habit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete habit'
    });
  }
});

// Mark habit as completed
router.post('/:id/complete', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validatedData = createHabitCompletionSchema.parse(req.body);

    const habit = await prisma.habit.findFirst({
      where: { id, userId }
    });

    if (!habit) {
      return res.status(404).json({
        success: false,
        error: 'Habit not found'
      });
    }

    const completion = await prisma.habitCompletion.upsert({
      where: {
        habitId_date: {
          habitId: id,
          date: new Date(validatedData.date)
        }
      },
      update: {
        count: validatedData.count,
        notes: validatedData.notes,
      },
      create: {
        habitId: id,
        date: new Date(validatedData.date),
        count: validatedData.count,
        notes: validatedData.notes,
      }
    });

    logger.info('Habit completed', { habitId: id, userId, completionId: completion.id });

    res.json({
      success: true,
      message: 'Habit marked as completed',
      data: { completion }
    });
  } catch (error) {
    logger.error('Mark habit complete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark habit as completed'
    });
  }
});

export default router;
