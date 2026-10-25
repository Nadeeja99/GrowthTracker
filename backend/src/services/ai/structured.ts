// One-shot AI features (weekly review, week plan, goal breakdown): ask for a
// JSON document that follows a strict schema, then validate it again here,
// because a schema the model was asked to follow is not a guarantee.
import { z } from 'zod';
import { HttpError } from '../../utils/httpError';
import { logger } from '../../utils/logger';
import { friendlyAiError } from './model';
import { beginAiRequest } from './request';
import { AiFeature } from './usage';

export interface StructuredRequest<T> {
  user: { id: string; email: string; timezone: string };
  feature: AiFeature;
  instructions: string;
  input: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  validator: z.ZodType<T>;
  maxOutputTokens: number;
}

/** Resolves with the validated document and the model that wrote it. */
export async function generateStructured<T>(req: StructuredRequest<T>): Promise<{ value: T; model: string }> {
  const ai = await beginAiRequest(req.user, req.feature);
  try {
    let result;
    try {
      result = await ai.model.generate({
        instructions: req.instructions,
        input: req.input,
        schemaName: req.schemaName,
        schema: req.jsonSchema,
        maxOutputTokens: req.maxOutputTokens,
      });
    } catch (error) {
      await ai.finish('error');
      logger.error('AI request failed', { userId: req.user.id, feature: req.feature, error: (error as Error).message });
      throw new HttpError(502, friendlyAiError(error));
    }

    const tokens = { inputTokens: result.inputTokens, outputTokens: result.outputTokens };
    const parsed = result.truncated ? null : safeParse(result.json, req.validator);
    if (!parsed) {
      await ai.finish('error', tokens);
      logger.warn('AI output rejected', { userId: req.user.id, feature: req.feature, truncated: result.truncated });
      throw new HttpError(502, 'The AI returned an incomplete answer. Please try again.');
    }

    await ai.finish('ok', tokens);
    logger.info('AI request completed', { userId: req.user.id, feature: req.feature, ...tokens });
    return { value: parsed, model: ai.model.name };
  } finally {
    ai.release();
  }
}

function safeParse<T>(json: string, validator: z.ZodType<T>): T | null {
  try {
    const result = validator.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
