import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { updateMilestoneSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { optionalDate } from '../utils/prismaRelations';
import { goalInclude, syncGoalProgress } from '../utils/goalProgress';

const router = Router();

router.use(authenticate);

// Milestones are owned through their goal.
const findOwnedMilestone = (id: string, userId: string) =>
  prisma.milestone.findFirst({ where: { id, goal: { userId } }, select: { id: true, goalId: true } });

// Update a milestone (rename, complete, reschedule)
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const validatedData = updateMilestoneSchema.parse(req.body);

  const existing = await findOwnedMilestone(id, userId);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Milestone not found' });
  }

  const [milestone, goal] = await prisma.$transaction(async tx => {
    const updated = await tx.milestone.update({
      where: { id },
      data: {
        title: validatedData.title,
        completed: validatedData.completed,
        targetDate: optionalDate(validatedData.targetDate),
      },
    });
    await syncGoalProgress(tx, existing.goalId);
    return [updated, await tx.goal.findUniqueOrThrow({ where: { id: existing.goalId }, include: goalInclude })];
  });

  logger.info('Milestone updated', { milestoneId: id, userId });

  res.json({ success: true, data: { milestone, goal } });
});

// Delete a milestone
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const existing = await findOwnedMilestone(id, userId);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Milestone not found' });
  }

  const goal = await prisma.$transaction(async tx => {
    await tx.milestone.delete({ where: { id } });
    await syncGoalProgress(tx, existing.goalId);
    return tx.goal.findUniqueOrThrow({ where: { id: existing.goalId }, include: goalInclude });
  });

  logger.info('Milestone deleted', { milestoneId: id, userId });

  res.json({ success: true, data: { goal } });
});

export default router;
