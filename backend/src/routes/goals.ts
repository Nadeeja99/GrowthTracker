import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { createGoalSchema, updateGoalSchema, createMilestoneSchema, paginationSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { optionalDate } from '../utils/prismaRelations';
import { goalInclude, hasMilestones, syncGoalProgress } from '../utils/goalProgress';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new goal
router.post('/', async (req: AuthRequest, res) => {
  const validatedData = createGoalSchema.parse(req.body);
  const userId = req.user!.id;

  const goal = await prisma.goal.create({
    data: {
      title: validatedData.title,
      description: validatedData.description,
      priority: validatedData.priority,
      color: validatedData.color,
      targetHoursWeekly: validatedData.targetHoursWeekly,
      targetHoursDaily: validatedData.targetHoursDaily,
      user: {
        connect: { id: userId }
      },
      targetDate: validatedData.targetDate ? new Date(validatedData.targetDate) : null,
    },
    include: goalInclude
  });

  logger.info('Goal created', { goalId: goal.id, userId });

  res.status(201).json({
    success: true,
    message: 'Goal created successfully',
    data: { goal }
  });
});

// Get all goals for user
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { page, limit } = paginationSchema.parse(req.query);
  const skip = (page - 1) * limit;

  const [goals, total] = await Promise.all([
    prisma.goal.findMany({
      where: { userId },
      include: goalInclude,
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
});

// Get a specific goal
router.get('/:id', async (req: AuthRequest, res) => {
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
});

// Update a goal
router.put('/:id', async (req: AuthRequest, res) => {
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
      // Milestone-driven goals derive progress; ignore manual values for them.
      progress: (await hasMilestones(prisma, id)) ? undefined : validatedData.progress,
      targetDate: optionalDate(validatedData.targetDate),
      color: validatedData.color,
      targetHoursWeekly: validatedData.targetHoursWeekly,
      targetHoursDaily: validatedData.targetHoursDaily,
    },
    include: goalInclude
  });

  logger.info('Goal updated', { goalId: id, userId });

  res.json({
    success: true,
    message: 'Goal updated successfully',
    data: { goal: updatedGoal }
  });
});

// Delete a goal
router.delete('/:id', async (req: AuthRequest, res) => {
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
});

// Add a milestone to a goal
router.post('/:id/milestones', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const validatedData = createMilestoneSchema.parse(req.body);

  const goal = await prisma.goal.findFirst({ where: { id, userId }, select: { id: true } });
  if (!goal) {
    return res.status(404).json({ success: false, error: 'Goal not found' });
  }

  const [milestone, updatedGoal] = await prisma.$transaction(async tx => {
    const created = await tx.milestone.create({
      data: {
        title: validatedData.title,
        targetDate: optionalDate(validatedData.targetDate),
        goalId: id,
      },
    });
    await syncGoalProgress(tx, id);
    return [created, await tx.goal.findUniqueOrThrow({ where: { id }, include: goalInclude })];
  });

  logger.info('Milestone created', { milestoneId: milestone.id, goalId: id, userId });

  res.status(201).json({ success: true, data: { milestone, goal: updatedGoal } });
});

export default router;
