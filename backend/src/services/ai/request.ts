// The checks every AI request goes through before anything is sent to the
// provider, and the usage record it leaves behind.
import { prisma } from '../../config/database';
import { HttpError } from '../../utils/httpError';
import { AiModel, getAiModel } from './model';
import { AiFeature, globalLimitReached, userQuota } from './usage';

type User = { id: string; email: string; timezone: string };

// One AI request at a time per user, so parallel requests can't bypass the daily cap.
const inFlight = new Set<string>();

export interface AiRequest {
  model: AiModel;
  /** Records the outcome (once; later calls are ignored). */
  finish(status: 'ok' | 'error' | 'aborted', tokens?: { inputTokens: number; outputTokens: number }): Promise<void>;
  /** Lets the user start another request. Call in `finally`. */
  release(): void;
}

/**
 * Requires a configured provider and the user's opt-in. Features call this
 * before gathering data, so users get the right message first.
 */
export async function assertAiReady(userId: string): Promise<AiModel> {
  const model = getAiModel();
  if (!model) throw new HttpError(503, 'AI features aren’t configured on this server.');
  const { aiCoachEnabled } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { aiCoachEnabled: true } });
  if (!aiCoachEnabled) throw new HttpError(403, 'Turn on the AI Coach first.');
  return model;
}

/**
 * Opens an AI request for `user`: requires a configured provider, the user's
 * opt-in, no other request in flight and quota left, then records a pending
 * usage row (which counts towards the cap until it is finished).
 */
export async function beginAiRequest(user: User, feature: AiFeature): Promise<AiRequest> {
  const model = await assertAiReady(user.id);

  if (inFlight.has(user.id)) throw new HttpError(409, 'Another AI request is still running. Try again in a moment.');
  inFlight.add(user.id);

  try {
    const quota = await userQuota(user);
    if (quota.remaining === 0) {
      throw new HttpError(429, `You’ve used all ${quota.limit} AI requests for today. They reset at midnight.`);
    }
    if (await globalLimitReached()) {
      throw new HttpError(503, 'AI features have reached their daily limit. Please try again tomorrow.');
    }

    const startedAt = Date.now();
    const usage = await prisma.aiUsage.create({ data: { userId: user.id, model: model.name, feature, status: 'pending' } });
    let finished = false;
    return {
      model,
      async finish(status, tokens) {
        if (finished) return;
        finished = true;
        await prisma.aiUsage
          .update({ where: { id: usage.id }, data: { status, ...tokens, durationMs: Date.now() - startedAt } })
          .catch(() => undefined);
      },
      release: () => inFlight.delete(user.id),
    };
  } catch (error) {
    inFlight.delete(user.id);
    throw error;
  }
}
