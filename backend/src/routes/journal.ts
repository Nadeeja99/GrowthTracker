import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { journalAskSchema, journalSearchSchema } from '../utils/validation';
import { dateKeyInZone } from '../utils/dates';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';
import { AiModelError, friendlyAiError } from '../services/ai/model';
import { assertAiReady, beginAiRequest } from '../services/ai/request';
import { abortWhenClientLeaves, openEventStream } from '../services/ai/stream';
import { userQuota } from '../services/ai/usage';
import { journalInstructions, resolveCitations } from '../services/journal/answer';
import { countNotes, retrieveNotes, searchJournal } from '../services/journal/search';
import { reportError } from '../services/monitoring';

// Search and answers over the notes in daily reviews. Questions and answers
// aren't saved. Both routes are POST so the words stay out of URLs, which
// hosting providers log. Never log them here either.
const router = Router();

router.use(authenticate);

// Free: no AI provider or opt-in involved.
router.post('/search', async (req: AuthRequest, res) => {
  const { query } = journalSearchSchema.parse(req.body);
  res.json({ success: true, data: { notes: await searchJournal(req.user!.id, query) } });
});

/**
 * Answers a question from the journal as Server-Sent Events:
 *   delta { text }                               a fragment of the answer
 *   done  { answer, sources, method, usage }     citations checked against the notes used
 *   error { message }                            the answer failed
 * Problems detected before streaming starts are ordinary JSON errors.
 */
router.post('/ask', async (req: AuthRequest, res) => {
  const user = req.user!;
  const { question } = journalAskSchema.parse(req.body);

  const model = await assertAiReady(user.id);
  const totalNotes = await countNotes(user.id);
  if (!totalNotes) throw new HttpError(400, 'Your journal is empty. Add a note to a daily review, then ask again.');

  const ai = await beginAiRequest(user, 'journal');
  try {
    const controller = abortWhenClientLeaves(res);
    const found = await retrieveNotes(user, question, model, controller.signal).catch(async error => {
      await ai.finish(controller.signal.aborted ? 'aborted' : 'error');
      if (controller.signal.aborted) return null;
      throw error;
    });
    if (!found) return void res.end();

    const send = openEventStream(res);

    // No notes (say, none in the month they asked about): nothing to send the AI.
    if (!found.notes.length) {
      await ai.finish('skipped');
      send('done', { answer: 'I couldn’t find any notes for that in your journal.', sources: [], method: found.method, usage: await userQuota(user) });
      return void res.end();
    }

    try {
      const result = await ai.model.reply({
        instructions: journalInstructions({
          today: dateKeyInZone(new Date(), user.timezone),
          totalNotes,
          range: found.range,
          notes: found.notes,
        }),
        input: [{ role: 'user', content: question }],
        onText: text => send('delta', { text }),
        signal: controller.signal,
      });
      const { answer, sources } = resolveCitations(result.text, found.notes);
      await ai.finish('ok', { inputTokens: result.inputTokens, outputTokens: result.outputTokens });
      logger.info('Journal answered', {
        userId: user.id,
        notes: found.notes.length,
        cited: sources.length,
        method: found.method,
        truncated: result.truncated,
      });
      send('done', {
        answer: (answer || 'Sorry, I couldn’t come up with an answer. Try asking another way.') + (result.truncated ? ' …' : ''),
        sources,
        method: found.method,
        usage: await userQuota(user),
      });
    } catch (error) {
      const aborted = controller.signal.aborted;
      await ai.finish(aborted ? 'aborted' : 'error');
      if (!aborted) {
        logger.error('Journal answer failed', { userId: user.id, status: error instanceof AiModelError ? error.status : undefined, error: (error as Error).message });
        reportError(error, { feature: 'journal' });
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
