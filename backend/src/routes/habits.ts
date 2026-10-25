import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { createHabitSchema, updateHabitSchema, createHabitCompletionSchema, paginationSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { addDays, dateKeyInZone, dateOnly } from '../utils/dates';

// Enough history for streaks and the heatmap without unbounded payloads.
const COMPLETION_HISTORY_DAYS = 366;

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new habit
router.post('/', async (req: AuthRequest, res) => {
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
});

// Get all habits for user
router.get('/', async (req: AuthRequest, res) => {
  const { id: userId, timezone } = req.user!;
  const { page, limit } = paginationSchema.parse(req.query);
  const skip = (page - 1) * limit;
  const since = dateOnly(addDays(dateKeyInZone(new Date(), timezone), -COMPLETION_HISTORY_DAYS));

  // Completions are included so clients need one request, not one per habit.
  const [habits, total] = await Promise.all([
    prisma.habit.findMany({
      where: { userId },
      include: {
        completions: { where: { date: { gte: since } }, orderBy: { date: 'desc' } },
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
});

// Get a specific habit with completions
router.get('/:id', async (req: AuthRequest, res) => {
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
});

// Update a habit
router.put('/:id', async (req: AuthRequest, res) => {
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
});

// Delete a habit
router.delete('/:id', async (req: AuthRequest, res) => {
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
});

// Mark habit as completed
router.post('/:id/complete', async (req: AuthRequest, res) => {
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
});

export default router;
