import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { updateUserSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { dateKeyInZone } from '../utils/dates';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Update user profile
router.put('/profile', async (req: AuthRequest, res) => {
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
      createdAt: true,
      updatedAt: true,
    }
  });

  logger.info('User profile updated', { userId });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
});

// Everything stored about the user, as one JSON file (GDPR data portability).
// Credentials (password hash, session version, reset links) are left out.
router.get('/me/export', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const [account, goals, tasks, schedules, habits, reflections, focusSessions, coachMessages, weeklyReviews, aiUsage] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true, email: true, username: true, firstName: true, lastName: true, avatar: true,
          timezone: true, aiCoachEnabled: true, morningDigestAt: true, eveningDigestAt: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.goal.findMany({ where: { userId }, include: { milestones: true }, orderBy: { createdAt: 'asc' } }),
      prisma.task.findMany({ where: { userId }, include: { subtasks: true, tags: true }, orderBy: { createdAt: 'asc' } }),
      prisma.schedule.findMany({ where: { userId }, orderBy: { startTime: 'asc' } }),
      prisma.habit.findMany({ where: { userId }, include: { completions: true }, orderBy: { createdAt: 'asc' } }),
      prisma.reflection.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
      prisma.focusSession.findMany({ where: { userId }, orderBy: { startedAt: 'asc' } }),
      prisma.coachMessage.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.weeklyReview.findMany({ where: { userId }, orderBy: { weekStart: 'asc' } }),
      prisma.aiUsage.findMany({
        where: { userId },
        select: { feature: true, model: true, status: true, inputTokens: true, outputTokens: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

  const exportedAt = new Date();
  const filename = `growthtracker-export-${dateKeyInZone(exportedAt, account.timezone)}.json`;
  res.set({
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  logger.info('Data exported', { userId });
  res.json({
    exportVersion: 1,
    exportedAt,
    account,
    goals,
    tasks,
    schedules,
    habits,
    reflections,
    focusSessions,
    coachMessages,
    weeklyReviews,
    aiUsage,
  });
});

export default router;
