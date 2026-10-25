import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { weekPlanRequestSchema, weekStartSchema } from '../utils/validation';
import { dateOnly } from '../utils/dates';
import { generateWeeklyReview, serializeReview } from '../services/features/weeklyReview';
import { generateWeekPlan } from '../services/features/weekPlan';
import { suggestMilestones } from '../services/features/goalBreakdown';

// One-shot AI features. They share the coach's opt-in and daily budget.
const router = Router();

router.use(authenticate);

// The saved review for a week, if one was generated (free: no AI call).
router.get('/weekly-review', async (req: AuthRequest, res) => {
  const { weekStart } = weekStartSchema.parse(req.query);
  const review = await prisma.weeklyReview.findUnique({
    where: { userId_weekStart: { userId: req.user!.id, weekStart: dateOnly(weekStart) } },
  });
  res.json({ success: true, data: { review: review ? serializeReview(review) : null } });
});

// Generates (or regenerates) the review for a week.
router.post('/weekly-review', async (req: AuthRequest, res) => {
  const { weekStart } = weekStartSchema.parse(req.body);
  const review = await generateWeeklyReview(req.user!, weekStart);
  res.status(201).json({ success: true, data: { review } });
});

// Proposes time blocks for a week; the client adds the chosen ones via /api/schedules/bulk.
router.post('/week-plan', async (req: AuthRequest, res) => {
  const { weekStart, window } = weekPlanRequestSchema.parse(req.body);
  const plan = await generateWeekPlan(req.user!, weekStart, window);
  res.json({ success: true, data: { plan } });
});

// Suggests milestones for a goal; the client adds the chosen ones.
router.post('/goals/:goalId/milestones', async (req: AuthRequest, res) => {
  const milestones = await suggestMilestones(req.user!, req.params.goalId);
  res.json({ success: true, data: { milestones } });
});

export default router;
