import { Router } from 'express';
import { CoachMessage, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { coachMessageSchema, coachSettingsSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { buildCoachContext } from '../services/coach/context';
import { coachInstructions } from '../services/coach/prompt';
import { applySuggestion, CoachSuggestion, normalizeSuggestions, suggestActionsTool } from '../services/coach/suggestions';
import { AiModelError, friendlyAiError, getAiModel } from '../services/ai/model';
import { beginAiRequest } from '../services/ai/request';
import { userQuota } from '../services/ai/usage';

const router = Router();

router.use(authenticate);

/** Earlier turns sent with each message, for conversational context. */
const HISTORY_TURNS = 12;
const LIST_LIMIT = 50;

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
      configured: getAiModel() !== null,
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
 *   delta { text }                        a fragment of the reply
 *   done  { userMessage, message, usage } the saved turn, with validated suggestions
 *   error { message }                     the reply failed; nothing was saved
 * Problems detected before streaming starts are ordinary JSON errors.
 */
router.post('/messages', async (req: AuthRequest, res) => {
  const user = req.user!;
  const { message } = coachMessageSchema.parse(req.body);

  const ai = await beginAiRequest(user, 'coach');
  try {
    const [context, history] = await Promise.all([
      buildCoachContext(user.id, user.timezone),
      prisma.coachMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: HISTORY_TURNS }),
    ]).catch(async error => {
      await ai.finish('error');
      throw error;
    });

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

    const startedAt = new Date();
    try {
      const result = await ai.model.reply({
        instructions: coachInstructions(context.snapshot),
        input: [
          ...history.reverse().map(m => ({ role: m.role === 'USER' ? 'user' as const : 'assistant' as const, content: m.content })),
          { role: 'user' as const, content: message },
        ],
        tool: suggestActionsTool,
        onText: text => send('delta', { text }),
        signal: controller.signal,
      });
      const suggestions = normalizeSuggestions(result.toolArgs, context);
      let content = result.text.trim() || (suggestions.length
        ? 'Here are a few things you could add:'
        : 'Sorry, I couldn’t come up with an answer. Try asking another way.');
      if (result.truncated) content += ' …';

      const [userMessage, reply] = await prisma.$transaction([
        prisma.coachMessage.create({ data: { userId: user.id, role: 'USER', content: message, createdAt: startedAt } }),
        prisma.coachMessage.create({
          data: {
            userId: user.id,
            role: 'ASSISTANT',
            content,
            suggestions: suggestions.length ? suggestions as unknown as Prisma.InputJsonValue : undefined,
          },
        }),
      ]);
      await ai.finish('ok', { inputTokens: result.inputTokens, outputTokens: result.outputTokens });

      logger.info('Coach replied', {
        userId: user.id,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        suggestions: suggestions.length,
        truncated: result.truncated,
        durationMs: Date.now() - startedAt.getTime(),
      });
      send('done', { userMessage: serialize(userMessage), message: serialize(reply), usage: await userQuota(user) });
    } catch (error) {
      const aborted = controller.signal.aborted;
      await ai.finish(aborted ? 'aborted' : 'error');
      if (!aborted) {
        logger.error('Coach reply failed', { userId: user.id, status: error instanceof AiModelError ? error.status : undefined, error: (error as Error).message });
        send('error', { message: friendlyAiError(error) });
      }
    } finally {
      res.end();
    }
  } finally {
    ai.release();
  }
});

export default router;
