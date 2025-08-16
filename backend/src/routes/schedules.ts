import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { createScheduleSchema, updateScheduleSchema, paginationSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new schedule
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
        user: {
          connect: { id: userId }
        },
      }
    });

    logger.info('Schedule created', { scheduleId: schedule.id, userId });

    res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: { schedule }
    });
  } catch (error) {
    logger.error('Create schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create schedule'
    });
  }
});

// Get all schedules for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { page, limit } = paginationSchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        where: { userId },
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.schedule.count({ where: { userId } })
    ]);

    res.json({
      success: true,
      data: {
        schedules,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    logger.error('Get schedules error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get schedules'
    });
  }
});

// Get schedules by date range
router.get('/range', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        startTime: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        }
      },
      orderBy: { startTime: 'asc' }
    });

    res.json({
      success: true,
      data: { schedules }
    });
  } catch (error) {
    logger.error('Get schedules by range error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get schedules'
    });
  }
});

// Get a specific schedule
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const schedule = await prisma.schedule.findFirst({
      where: { id, userId }
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    res.json({
      success: true,
      data: { schedule }
    });
  } catch (error) {
    logger.error('Get schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get schedule'
    });
  }
});

// Update a schedule
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validatedData = updateScheduleSchema.parse(req.body);

    const schedule = await prisma.schedule.findFirst({
      where: { id, userId }
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
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
      }
    });

    logger.info('Schedule updated', { scheduleId: id, userId });

    res.json({
      success: true,
      message: 'Schedule updated successfully',
      data: { schedule: updatedSchedule }
    });
  } catch (error) {
    logger.error('Update schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update schedule'
    });
  }
});

// Delete a schedule
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const schedule = await prisma.schedule.findFirst({
      where: { id, userId }
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    await prisma.schedule.delete({
      where: { id }
    });

    logger.info('Schedule deleted', { scheduleId: id, userId });

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    logger.error('Delete schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete schedule'
    });
  }
});

export default router;
