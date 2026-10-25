import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { createScheduleSchema, updateScheduleSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

const scheduleInclude = {
  goal: { select: { id: true, title: true } },
  task: { select: { id: true, title: true, status: true } },
};

router.post('/', async (req: AuthRequest, res) => {
  const validatedData = createScheduleSchema.parse(req.body);
  const userId = req.user!.id;

  const schedule = await prisma.schedule.create({
    data: {
      title: validatedData.title,
      description: validatedData.description,
      startTime: new Date(validatedData.startTime),
      endTime: new Date(validatedData.endTime),
      allDay: validatedData.allDay,
      recurring: validatedData.recurring,
      status: validatedData.status,
      notes: validatedData.notes,
      actualTimeSpent: validatedData.actualTimeSpent,
      user: { connect: { id: userId } },
      goal: validatedData.goalId ? { connect: { id: validatedData.goalId } } : undefined,
      task: validatedData.taskId ? { connect: { id: validatedData.taskId } } : undefined,
    },
    include: scheduleInclude,
  });

  logger.info('Schedule created', { scheduleId: schedule.id, userId });

  res.status(201).json({
    success: true,
    message: 'Schedule created successfully',
    data: { schedule },
  });
});

router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { startDate, endDate } = req.query;

  const where: any = { userId };

  if (startDate && endDate) {
    where.startTime = {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string),
    };
  }

  const schedules = await prisma.schedule.findMany({
    where,
    include: scheduleInclude,
    orderBy: { startTime: 'asc' },
  });

  res.json({ success: true, data: { schedules } });
});

router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const schedule = await prisma.schedule.findFirst({
    where: { id, userId },
    include: scheduleInclude,
  });

  if (!schedule) {
    return res.status(404).json({ success: false, error: 'Schedule not found' });
  }

  res.json({ success: true, data: { schedule } });
});

router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const validatedData = updateScheduleSchema.parse(req.body);

  const existing = await prisma.schedule.findFirst({ where: { id, userId } });

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Schedule not found' });
  }

  const updatedSchedule = await prisma.schedule.update({
    where: { id },
    data: {
      title: validatedData.title,
      description: validatedData.description,
      startTime: validatedData.startTime ? new Date(validatedData.startTime) : undefined,
      endTime: validatedData.endTime ? new Date(validatedData.endTime) : undefined,
      allDay: validatedData.allDay,
      recurring: validatedData.recurring,
      status: validatedData.status,
      notes: validatedData.notes,
      actualTimeSpent: validatedData.actualTimeSpent,
      goal: validatedData.goalId !== undefined
        ? validatedData.goalId
          ? { connect: { id: validatedData.goalId } }
          : { disconnect: true }
        : undefined,
      task: validatedData.taskId !== undefined
        ? validatedData.taskId
          ? { connect: { id: validatedData.taskId } }
          : { disconnect: true }
        : undefined,
    },
    include: scheduleInclude,
  });

  logger.info('Schedule updated', { scheduleId: id, userId });

  res.json({
    success: true,
    message: 'Schedule updated successfully',
    data: { schedule: updatedSchedule },
  });
});

router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const existing = await prisma.schedule.findFirst({ where: { id, userId } });

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Schedule not found' });
  }

  await prisma.schedule.delete({ where: { id } });

  logger.info('Schedule deleted', { scheduleId: id, userId });

  res.json({ success: true, message: 'Schedule deleted successfully' });
});

export default router;
