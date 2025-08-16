import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { createTaskSchema, updateTaskSchema, paginationSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new task
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validatedData = createTaskSchema.parse(req.body);
    const userId = req.user!.id;

    const task = await prisma.task.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        priority: validatedData.priority,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        estimatedTime: validatedData.estimatedTime,
        user: {
          connect: { id: userId }
        },
        goal: validatedData.goalId ? {
          connect: { id: validatedData.goalId }
        } : undefined,
      },
      include: {
        goal: {
          select: { id: true, title: true }
        },
        tags: true
      }
    });

    logger.info('Task created', { taskId: task.id, userId });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: { task }
    });
  } catch (error) {
    logger.error('Create task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create task'
    });
  }
});

// Get all tasks for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { page, limit } = paginationSchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: { userId },
        include: {
          goal: {
            select: { id: true, title: true }
          },
          tags: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.task.count({ where: { userId } })
    ]);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    logger.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tasks'
    });
  }
});

// Get a specific task
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const task = await prisma.task.findFirst({
      where: { id, userId },
      include: {
        goal: {
          select: { id: true, title: true }
        },
        tags: true
      }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: { task }
    });
  } catch (error) {
    logger.error('Get task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get task'
    });
  }
});

// Update a task
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validatedData = updateTaskSchema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: { id, userId }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: validatedData.title,
        description: validatedData.description,
        priority: validatedData.priority,
        status: validatedData.status,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
        estimatedTime: validatedData.estimatedTime,
        actualTime: validatedData.actualTime,
        goal: validatedData.goalId ? {
          connect: { id: validatedData.goalId }
        } : undefined,
        completedAt: validatedData.status === 'COMPLETED' ? new Date() : undefined,
      },
      include: {
        goal: {
          select: { id: true, title: true }
        },
        tags: true
      }
    });

    logger.info('Task updated', { taskId: id, userId });

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: { task: updatedTask }
    });
  } catch (error) {
    logger.error('Update task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update task'
    });
  }
});

// Delete a task
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const task = await prisma.task.findFirst({
      where: { id, userId }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    await prisma.task.delete({
      where: { id }
    });

    logger.info('Task deleted', { taskId: id, userId });

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    logger.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete task'
    });
  }
});

export default router;
