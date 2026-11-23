import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { estimateQuerySchema } from '../utils/validation';
import { MODEL, predictDuration, roundMinutes } from '../services/estimates/calibration';
import { timedHistory } from '../services/estimates/history';

// "Tasks like this usually take you about…": the estimate-calibration model
// (ml/MODEL_CARD.md) applied to the person's own finished, timed tasks. It
// runs in-process from a small JSON file: no AI provider, no cost per request,
// and nothing leaves the server.
const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  const query = estimateQuerySchema.parse(req.query);
  const history = await timedHistory(req.user!.id, query.excludeTaskId);

  // Until their own record outweighs the population average (model card,
  // "When suggestions appear"), say how many more timed tasks are needed instead.
  if (history.length < MODEL.minHistory) {
    return void res.json({
      success: true,
      data: { estimate: null, timedTasks: history.length, minHistory: MODEL.minHistory, modelVersion: MODEL.metadata.version },
    });
  }

  const prediction = predictDuration(
    MODEL,
    { estimateMinutes: query.minutes, priority: query.priority, subtasks: query.subtasks, hasDueDate: query.hasDueDate, goalId: query.goalId ?? null },
    history,
  );
  res.json({
    success: true,
    data: {
      estimate: {
        minutes: query.minutes,
        suggestedMinutes: roundMinutes(prediction.predictedMinutes),
        lowMinutes: roundMinutes(prediction.lowMinutes),
        highMinutes: roundMinutes(prediction.highMinutes),
        ratio: Math.round((prediction.predictedMinutes / query.minutes) * 100) / 100,
        coverage: MODEL.intervals.coverage,
        basedOn: { tasks: prediction.historyUsed, goalTasks: query.goalId ? prediction.goalHistoryUsed : 0 },
      },
      timedTasks: history.length,
      minHistory: MODEL.minHistory,
      modelVersion: MODEL.metadata.version,
    },
  });
});

export default router;
