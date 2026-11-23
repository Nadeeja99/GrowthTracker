import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { skipRiskQuerySchema } from '../utils/validation';
import { blockRisks } from '../services/skipRisk/blocks';
import { MODEL } from '../services/skipRisk/risk';

// "Likely to slip": the skip-risk model (ml/SKIP_RISK_MODEL_CARD.md) applied
// to upcoming blocks, from the person's own record of kept and skipped
// blocks. Runs in-process; nothing leaves the server.
const router = Router();

router.use(authenticate);

const DEFAULT_DAYS = 14;

router.get('/', async (req: AuthRequest, res) => {
  const user = req.user!;
  const { startDate, endDate } = skipRiskQuerySchema.parse(req.query);
  const now = new Date();
  const from = startDate && new Date(startDate) > now ? new Date(startDate) : now;
  const to = endDate ? new Date(endDate) : new Date(now.getTime() + DEFAULT_DAYS * 86_400_000);

  const upcoming = await prisma.schedule.findMany({
    where: { userId: user.id, status: 'PENDING', startTime: { gte: from, lt: to } },
    select: { id: true, startTime: true, endTime: true, createdAt: true, goalId: true },
    orderBy: { startTime: 'asc' },
    take: 200,
  });
  const { risks, history } = await blockRisks(
    user,
    upcoming.map(b => ({ id: b.id, startTime: b.startTime, endTime: b.endTime, plannedAt: b.createdAt, goalId: b.goalId })),
    { now }
  );
  res.json({
    success: true,
    data: { risks: risks ?? [], history, minHistory: MODEL.minHistory, threshold: MODEL.threshold, modelVersion: MODEL.metadata.version },
  });
});

export default router;
