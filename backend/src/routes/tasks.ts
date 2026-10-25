import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { Prisma } from '@prisma/client';
import { createTaskSchema, updateTaskSchema, updateSubtaskSchema, paginationSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { assertGoalOwned } from '../utils/ownership';
import { relationUpdate, optionalDate } from '../utils/prismaRelations';

const router = Router();

const taskInclude = {
  goal: { select: { id: true, title: true } },
  tags: { orderBy: { name: 'asc' } },
  subtasks: { orderBy: { position: 'asc' } },
} satisfies Prisma.TaskInclude;

type SubtaskInput = { id?: string; title: string; completed: boolean };

// Applies a full, ordered subtask list: keeps and updates items whose id
// belongs to this task, creates the rest, deletes anything not listed.
async function syncSubtasks(tx: Prisma.TransactionClient, taskId: string, subtasks: SubtaskInput[]) {
  const existingIds = new Set(
    (await tx.subtask.findMany({ where: { taskId }, select: { id: true } })).map(st => st.id)
  );
  const keptIds = subtasks.map(st => st.id).filter((id): id is string => !!id && existingIds.has(id));

  await tx.subtask.deleteMany({ where: { taskId, id: { notIn: keptIds } } });
  await Promise.all(subtasks.map((st, position) =>
    st.id && existingIds.has(st.id)
      ? tx.subtask.update({ where: { id: st.id }, data: { title: st.title, completed: st.completed, position } })
      : tx.subtask.create({ data: { taskId, title: st.title, completed: st.completed, position } })
  ));
}

// All routes require authentication
router.use(authenticate);

// Create a new task
router.post('/', async (req: AuthRequest, res) => {
  const validatedData = createTaskSchema.parse(req.body);
  const userId = req.user!.id;

  if (validatedData.goalId) {
    await assertGoalOwned(userId, validatedData.goalId);
  }

  const task = await prisma.task.create({
    data: {
      title: validatedData.title,
      description: validatedData.description,
      priority: validatedData.priority,
      dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
      estimatedTime: validatedData.estimatedTime,
      status: validatedData.status,
      completedAt: validatedData.status === 'COMPLETED' ? new Date() : null,
      user: {
        connect: { id: userId }
      },
      goal: validatedData.goalId ? {
        connect: { id: validatedData.goalId }
      } : undefined,
      tags: validatedData.tags?.length
        ? { create: validatedData.tags.map(name => ({ name, userId })) }
        : undefined,
      subtasks: validatedData.subtasks?.length
        ? { create: validatedData.subtasks.map((st, position) => ({ title: st.title, completed: st.completed, position })) }
        : undefined,
    },
    include: taskInclude
  });

  logger.info('Task created', { taskId: task.id, userId });

  res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: { task }
  });
});

// Get all tasks for user
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { page, limit } = paginationSchema.parse(req.query);
  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      include: taskInclude,
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
});

// Get a specific task
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const task = await prisma.task.findFirst({
    where: { id, userId },
    include: taskInclude
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
});

// Update a task
router.put('/:id', async (req: AuthRequest, res) => {
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

  if (validatedData.goalId) {
    await assertGoalOwned(userId, validatedData.goalId);
  }

  // Keep the original completion time when a completed task is re-saved;
  // clear it when the task is reopened so completion analytics stay correct.
  let completedAt: Date | null | undefined;
  if (validatedData.status === 'COMPLETED') {
    completedAt = task.completedAt ?? new Date();
  } else if (validatedData.status !== undefined) {
    completedAt = null;
  }

  const updatedTask = await prisma.$transaction(async tx => {
    if (validatedData.tags !== undefined) {
      await tx.taskTag.deleteMany({ where: { taskId: id } });
      await tx.taskTag.createMany({ data: validatedData.tags.map(name => ({ name, userId, taskId: id })) });
    }
    if (validatedData.subtasks !== undefined) {
      await syncSubtasks(tx, id, validatedData.subtasks);
    }

    return tx.task.update({
      where: { id },
      data: {
        title: validatedData.title,
        description: validatedData.description,
        priority: validatedData.priority,
        status: validatedData.status,
        dueDate: optionalDate(validatedData.dueDate),
        estimatedTime: validatedData.estimatedTime,
        actualTime: validatedData.actualTime,
        goal: relationUpdate(validatedData.goalId),
        completedAt,
      },
      include: taskInclude
    });
  });

  logger.info('Task updated', { taskId: id, userId });

  res.json({
    success: true,
    message: 'Task updated successfully',
    data: { task: updatedTask }
  });
});

// Delete a task
router.delete('/:id', async (req: AuthRequest, res) => {
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
});

// Toggle or rename a single subtask
router.patch('/:taskId/subtasks/:subtaskId', async (req: AuthRequest, res) => {
  const { taskId, subtaskId } = req.params;
  const userId = req.user!.id;
  const validatedData = updateSubtaskSchema.parse(req.body);

  const subtask = await prisma.subtask.findFirst({
    where: { id: subtaskId, taskId, task: { userId } },
    select: { id: true },
  });
  if (!subtask) {
    return res.status(404).json({ success: false, error: 'Subtask not found' });
  }

  const updated = await prisma.subtask.update({ where: { id: subtaskId }, data: validatedData });

  res.json({ success: true, data: { subtask: updated } });
});

export default router;
