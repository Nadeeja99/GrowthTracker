import { Router, Response } from 'express';
import { CoachMessage, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { coachMessageSchema, coachSettingsSchema } from '../utils/validation';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';
import { buildCoachContext } from '../services/coach/context';
import { coachInstructions } from '../services/coach/prompt';
import { CoachModelError, CoachModelResult, getCoachModel } from '../services/coach/model';
import { applySuggestion, CoachSuggestion, normalizeSuggestions } from '../services/coach/suggestions';
import { CoachQuota, globalLimitReached, userQuota } from '../services/coach/usage';

const router = Router();

router.use(authenticate);

/** Earlier turns sent with each message, for conversational context. */
const HISTORY_TURNS = 12;
const LIST_LIMIT = 50;

// One reply at a time per user, so parallel requests can't bypass the daily cap.
const inFlight = new Set<string>();

const serialize = (m: CoachMessage) => ({
  id: m.id,
  role: m.role === 'USER' ? 'user' as const : 'assistant' as const,
  content: m.content,
  suggestions: (m.suggestions as unknown as CoachSuggestion[] | null) ?? [],
  createdAt: m.createdAt,
});

// Status, opt-in, today's usage and the recent conversation.
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const [user, messages, usage] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { aiCoachEnabled: true } }),
    prisma.coachMessage.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: LIST_LIMIT }),
    userQuota(req.user!),
  ]);

  res.json({
    success: true,
    data: {
      configured: getCoachModel() !== null,
      enabled: user.aiCoachEnabled,
      usage,
      messages: messages.reverse().map(serialize),
    },
  });
});

// Opt in or out. Turning the coach off keeps the conversation; clearing it is separate.
router.put('/settings', async (req: AuthRequest, res) => {
  const { enabled } = coachSettingsSchema.parse(req.body);
  await prisma.user.update({ where: { id: req.user!.id }, data: { aiCoachEnabled: enabled } });
  logger.info('Coach setting changed', { userId: req.user!.id, enabled });
  res.json({ success: true, data: { enabled } });
});

router.delete('/messages', async (req: AuthRequest, res) => {
  const { count } = await prisma.coachMessage.deleteMany({ where: { userId: req.user!.id } });
  res.json({ success: true, data: { deleted: count } });
});

router.post('/messages/:messageId/suggestions/:suggestionId/apply', async (req: AuthRequest, res) => {
  const suggestion = await applySuggestion(req.user!.id, req.params.messageId, req.params.suggestionId);
  logger.info('Coach suggestion applied', { userId: req.user!.id, kind: suggestion.kind });
  res.status(201).json({ success: true, data: { suggestion } });
});

/**
 * Sends a message and streams the reply as Server-Sent Events:
 *   delta { text }                      a fragment of the reply
 *   done  { userMessage, message, usage } the saved turn, with validated suggestions
 *   error { message }                   the reply failed; nothing was saved
 * Problems detected before streaming starts are ordinary JSON errors.
 */
router.post('/messages', async (req: AuthRequest, res) => {
  const user = req.user!;
  const { message } = coachMessageSchema.parse(req.body);

  const model = getCoachModel();
  if (!model) throw new HttpError(503, 'AI Coach isn’t configured on this server.');

  const { aiCoachEnabled } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { aiCoachEnabled: true } });
  if (!aiCoachEnabled) throw new HttpError(403, 'Turn on AI Coach first.');

  if (inFlight.has(user.id)) throw new HttpError(409, 'The coach is still answering your previous message.');
  inFlight.add(user.id);

  try {
    const quota = await userQuota(user);
    if (quota.remaining === 0) {
      throw new HttpError(429, `You’ve used all ${quota.limit} coach messages for today. They reset at midnight.`);
    }
    if (await globalLimitReached()) {
      throw new HttpError(503, 'AI Coach has reached its daily limit. Please try again tomorrow.');
    }

    const [context, history] = await Promise.all([
      buildCoachContext(user.id, user.timezone),
      prisma.coachMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: HISTORY_TURNS }),
    ]);

    const startedAt = new Date();
    const usageRow = await prisma.aiUsage.create({ data: { userId: user.id, model: model.name, status: 'pending' } });
    await streamReply(res, {
      userId: user.id,
      message,
      startedAt,
      usageId: usageRow.id,
      run: (onText, signal) => model.reply({
        instructions: coachInstructions(context.snapshot),
        input: [
          ...history.reverse().map(m => ({ role: m.role === 'USER' ? 'user' as const : 'assistant' as const, content: m.content })),
          { role: 'user' as const, content: message },
        ],
        onText,
        signal,
      }),
      suggestions: args => normalizeSuggestions(args, context),
      quota: () => userQuota(user),
    });
  } finally {
    inFlight.delete(user.id);
  }
});

interface StreamJob {
  userId: string;
  message: string;
  startedAt: Date;
  usageId: string;
  run: (onText: (delta: string) => void, signal: AbortSignal) => Promise<CoachModelResult>;
  suggestions: (rawArgs: string | null) => CoachSuggestion[];
  quota: () => Promise<CoachQuota>;
}

async function streamReply(res: Response, job: StreamJob): Promise<void> {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform also stops the compression middleware from buffering the stream.
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // Stop generating (and paying for) a reply nobody will read.
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const result = await job.run(text => send('delta', { text }), controller.signal);
    const suggestions = job.suggestions(result.suggestionArgs);
    let content = result.text.trim() || (suggestions.length
      ? 'Here are a few things you could add:'
      : 'Sorry, I couldn’t come up with an answer. Try asking another way.');
    if (result.truncated) content += ' …';

    const [userMessage, reply] = await prisma.$transaction([
      prisma.coachMessage.create({ data: { userId: job.userId, role: 'USER', content: job.message, createdAt: job.startedAt } }),
      prisma.coachMessage.create({
        data: {
          userId: job.userId,
          role: 'ASSISTANT',
          content,
          suggestions: suggestions.length ? suggestions as unknown as Prisma.InputJsonValue : undefined,
        },
      }),
      prisma.aiUsage.update({
        where: { id: job.usageId },
        data: {
          status: 'ok',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          durationMs: Date.now() - job.startedAt.getTime(),
        },
      }),
    ]);

    logger.info('Coach replied', {
      userId: job.userId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      suggestions: suggestions.length,
      truncated: result.truncated,
      durationMs: Date.now() - job.startedAt.getTime(),
    });
    send('done', { userMessage: serialize(userMessage), message: serialize(reply), usage: await job.quota() });
  } catch (error) {
    const aborted = controller.signal.aborted;
    await prisma.aiUsage
      .update({ where: { id: job.usageId }, data: { status: aborted ? 'aborted' : 'error', durationMs: Date.now() - job.startedAt.getTime() } })
      .catch(() => undefined);
    if (!aborted) {
      logger.error('Coach reply failed', { userId: job.userId, status: error instanceof CoachModelError ? error.status : undefined, error: (error as Error).message });
      send('error', { message: friendlyError(error) });
    }
  } finally {
    res.end();
  }
}

function friendlyError(error: unknown): string {
  if (error instanceof CoachModelError) {
    if (error.status === 429) return 'The AI service is busy right now. Please try again in a minute.';
    if (error.status === 401 || error.status === 403) return 'AI Coach is temporarily unavailable.';
  }
  return 'The coach couldn’t answer just now. Please try again.';
}

export default router;
