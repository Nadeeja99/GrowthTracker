// Finding notes. Two methods that fail differently: keywords catch exact words
// (names, "physio") that embeddings blur, and embeddings catch "exhausted" for
// a question about being tired. Their rankings are merged by position, because
// their scores aren't comparable.
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { dateKeyInZone, dateOnly } from '../../utils/dates';
import { AiModel } from '../ai/model';
import { recordEmbeddingUsage } from '../ai/request';
import { reportError } from '../monitoring';
import { logger } from '../../utils/logger';
import { DateRange, journalDateRange } from './dateRange';
import { syncEmbeddings, toVectorLiteral } from './embeddings';

export interface JournalNote {
  date: string;
  notes: string;
  performance: number | null;
  energy: number | null;
  mood: number | null;
}

type Row = Omit<JournalNote, 'date'> & { id: string; date: Date };

/** Notes the model reads: enough to answer, few enough to keep the rest private. */
export const NOTES_IN_ANSWER = 8;
const CANDIDATES = 20;
export const SEARCH_RESULTS = 20;
/** The usual constant for reciprocal rank fusion; it softens the top ranks' lead. */
const RRF_K = 60;

const toNote = ({ date, notes, performance, energy, mood }: Row): JournalNote =>
  ({ date: date.toISOString().slice(0, 10), notes, performance, energy, mood });

const NOTE_COLUMNS = Prisma.sql`r.id, r.date, r.notes, r.performance, r.energy, r.mood`;

const inRange = (range: DateRange | null) =>
  (range ? Prisma.sql`AND r.date >= ${dateOnly(range.start)} AND r.date <= ${dateOnly(range.end)}` : Prisma.empty);

/** Ranked by matching words. Any word can match, so a whole question still finds notes. */
function keywordMatches(userId: string, text: string, range: DateRange | null, limit: number) {
  return prisma.$queryRaw<Row[]>`
    SELECT ${NOTE_COLUMNS}
    FROM reflections r, (SELECT replace(plainto_tsquery('english', ${text})::text, '&', '|')::tsquery AS query) q
    WHERE r."userId" = ${userId} AND to_tsvector('english', coalesce(r.notes, '')) @@ q.query ${inRange(range)}
    ORDER BY ts_rank(to_tsvector('english', r.notes), q.query) DESC, r.date DESC
    LIMIT ${limit}`;
}

function meaningMatches(userId: string, vector: number[], range: DateRange | null) {
  return prisma.$queryRaw<Row[]>`
    SELECT ${NOTE_COLUMNS}
    FROM reflections r JOIN journal_embeddings e ON e."reflectionId" = r.id
    WHERE r."userId" = ${userId} AND e.model = ${env.OPENAI_EMBEDDING_MODEL} AND btrim(coalesce(r.notes, '')) <> '' ${inRange(range)}
    ORDER BY e.embedding OPERATOR(extensions.<=>) ${toVectorLiteral(vector)}::extensions.vector
    LIMIT ${CANDIDATES}`;
}

/** A question like "how was last week?" has no useful words, only a period. */
function latestInRange(userId: string, range: DateRange) {
  return prisma.$queryRaw<Row[]>`
    SELECT ${NOTE_COLUMNS}
    FROM reflections r
    WHERE r."userId" = ${userId} AND btrim(coalesce(r.notes, '')) <> '' ${inRange(range)}
    ORDER BY r.date DESC
    LIMIT ${CANDIDATES}`;
}

/** Merges rankings: a note scores for its position in each list it appears in. */
export function fuseRankings<T extends { id: string }>(lists: T[][], limit: number): T[] {
  const scored = new Map<string, { item: T; score: number }>();
  for (const list of lists) {
    list.forEach((item, position) => {
      const entry = scored.get(item.id) ?? { item, score: 0 };
      entry.score += 1 / (RRF_K + position + 1);
      scored.set(item.id, entry);
    });
  }
  return [...scored.values()].sort((a, b) => b.score - a.score).slice(0, limit).map(entry => entry.item);
}

export const countNotes = (userId: string) =>
  prisma.reflection.count({ where: { userId, AND: [{ notes: { not: null } }, { notes: { not: '' } }] } });

/** Free keyword search, which needs no AI provider or opt-in. */
export async function searchJournal(userId: string, query: string): Promise<JournalNote[]> {
  return (await keywordMatches(userId, query, null, SEARCH_RESULTS)).map(toNote);
}

export interface Retrieved {
  notes: JournalNote[];
  /** 'keywords' means the embedding service failed, so exact words were used alone. */
  method: 'hybrid' | 'keywords';
  range: DateRange | null;
}

/** The notes most likely to answer `question`. */
export async function retrieveNotes(
  user: { id: string; timezone: string },
  question: string,
  model: AiModel,
  signal: AbortSignal
): Promise<Retrieved> {
  const range = journalDateRange(question, dateKeyInZone(new Date(), user.timezone));

  let vector: number[] | null = null;
  let tokens = 0;
  try {
    tokens += await syncEmbeddings(user.id, model, signal);
    const embedded = await model.embed({ texts: [question], signal });
    tokens += embedded.inputTokens;
    vector = embedded.vectors[0];
  } catch (error) {
    if (signal.aborted) throw error;
    // Answers still work from keywords, for example if a restricted API key
    // isn't allowed to use the embeddings endpoint.
    logger.warn('Journal embeddings failed; using keywords only', { userId: user.id, error: (error as Error).message });
    reportError(error, { feature: 'journal_embedding' });
  }
  await recordEmbeddingUsage(user.id, tokens);

  const lists = await Promise.all([
    keywordMatches(user.id, question, range, CANDIDATES),
    vector ? meaningMatches(user.id, vector, range) : [],
    range ? latestInRange(user.id, range) : [],
  ]);
  return { notes: fuseRankings(lists, NOTES_IN_ANSWER).map(toNote), method: vector ? 'hybrid' : 'keywords', range };
}
