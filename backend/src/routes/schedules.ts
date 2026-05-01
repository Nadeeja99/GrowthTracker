import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { createScheduleSchema, updateScheduleSchema, paginationSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

router.post('/', async (req: AuthRequest, res) => {
  try {
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
      },
      include: { goal: { select: { id: true, title: true } } },
    });

    logger.info('Schedule created', { scheduleId: schedule.id, userId });

    res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: { schedule },
    });
  } catch (error: any) {
    logger.error('Create schedule error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create schedule' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
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
      include: { goal: { select: { id: true, title: true } } },
      orderBy: { startTime: 'asc' },
    });

    res.json({ success: true, data: { schedules } });
  } catch (error) {
    logger.error('Get schedules error:', error);
    res.status(500).json({ success: false, error: 'Failed to get schedules' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const schedule = await prisma.schedule.findFirst({
      where: { id, userId },
      include: { goal: { select: { id: true, title: true } } },
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    res.json({ success: true, data: { schedule } });
  } catch (error) {
    logger.error('Get schedule error:', error);
    res.status(500).json({ success: false, error: 'Failed to get schedule' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
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
      },
      include: { goal: { select: { id: true, title: true } } },
    });

    logger.info('Schedule updated', { scheduleId: id, userId });

    res.json({
      success: true,
      message: 'Schedule updated successfully',
      data: { schedule: updatedSchedule },
    });
  } catch (error: any) {
    logger.error('Update schedule error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update schedule' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = await prisma.schedule.findFirst({ where: { id, userId } });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    await prisma.schedule.delete({ where: { id } });

    logger.info('Schedule deleted', { scheduleId: id, userId });

    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    logger.error('Delete schedule error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete schedule' });
  }
});

export default router;
