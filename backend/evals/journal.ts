// Journal search and answer quality over a fixed, labelled set of invented
// notes (journal/notes.json) and questions (journal/questions.json).
//
// Retrieval: for each question, the notes each method would send to the model
// (keywords only, meaning only, and the app's hybrid), scored by recall@8 (how
// many of the right notes made the 8 sent) and MRR (how high the first right
// one ranked). Answers: whether the notes an answer cites are right ones.
import request from 'supertest';
import { app } from '../src/app';
import { getAiModel } from '../src/services/ai/model';
import { syncEmbeddings } from '../src/services/journal/embeddings';
import { NOTES_IN_ANSWER, rankingsForEvaluation } from '../src/services/journal/search';
import { addDays, dateKeyInZone } from '../src/utils/dates';
import { auth, registerUser, resetDatabase } from '../tests/helpers';
import { parseSse } from '../tests/fake-openai';
import notesFile from './journal/notes.json';
import questionsFile from './journal/questions.json';

type Method = 'keywords' | 'meaning' | 'hybrid';
const METHODS: Method[] = ['keywords', 'meaning', 'hybrid'];

export interface RetrievalScore {
  recallAt8: number;
  mrr: number;
  /** Questions where every right note (up to 8) was sent. */
  complete: number;
  questions: number;
}

export interface JournalReport {
  embeddings: boolean;
  retrieval: Record<Method, Record<'all' | 'words' | 'meaning' | 'period', RetrievalScore>>;
  answers: { asked: number; withCitations: number; citationPrecision: number; citedARightNote: number } | null;
  perQuestion: Array<{ id: string; kind: string; question: string; ranks: Record<Method, string[]>; relevant: string[]; cited?: string[] }>;
}

/** Recall at k, counting a question as fully answered once min(k, relevant) right notes are in. */
export function recallAtK(ranked: string[], relevant: string[], k = NOTES_IN_ANSWER): number {
  const hits = ranked.slice(0, k).filter(id => relevant.includes(id)).length;
  return hits / Math.min(k, relevant.length);
}

export function reciprocalRank(ranked: string[], relevant: string[]): number {
  const index = ranked.findIndex(id => relevant.includes(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

function summarise(rows: Array<{ recall: number; rr: number }>): RetrievalScore {
  const n = rows.length || 1;
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return {
    recallAt8: round(rows.reduce((s, r) => s + r.recall, 0) / n),
    mrr: round(rows.reduce((s, r) => s + r.rr, 0) / n),
    complete: rows.filter(r => r.recall === 1).length,
    questions: rows.length,
  };
}

export async function evaluateJournal({ ask = questionsFile.questions.length } = {}): Promise<JournalReport> {
  await resetDatabase();
  const user = await registerUser(app, { timezone: 'UTC' });
  await request(app).put('/api/coach/settings').set(auth(user.token)).send({ enabled: true }).expect(200);
  const today = dateKeyInZone(new Date(), 'UTC');
  const idByDate = new Map<string, string>();
  for (const note of notesFile.notes) {
    const date = addDays(today, -note.daysAgo);
    idByDate.set(date, note.id);
    await request(app).put(`/api/reflections/${date}`).set(auth(user.token)).send({ performance: 3, energy: 3, mood: 3, notes: note.text }).expect(200);
  }

  const model = getAiModel();
  if (!model) throw new Error('No AI model configured: set OPENAI_API_KEY, or use --provider fake');
  let embeddings = true;
  try {
    await syncEmbeddings(user.user.id, model);
  } catch {
    embeddings = false;
  }

  const perQuestion: JournalReport['perQuestion'] = [];
  const rows: Record<Method, Array<{ kind: string; recall: number; rr: number }>> = { keywords: [], meaning: [], hybrid: [] };
  for (const q of questionsFile.questions) {
    const vector = embeddings ? (await model.embed({ texts: [q.question] })).vectors[0] : null;
    const ranked = await rankingsForEvaluation({ id: user.user.id, timezone: 'UTC' }, q.question, vector);
    const ranks = Object.fromEntries(METHODS.map(m => [m, ranked[m].map(n => idByDate.get(n.date) ?? n.date)])) as Record<Method, string[]>;
    for (const m of METHODS) rows[m].push({ kind: q.kind, recall: recallAtK(ranks[m], q.relevant), rr: reciprocalRank(ranks[m], q.relevant) });
    perQuestion.push({ id: q.id, kind: q.kind, question: q.question, ranks, relevant: q.relevant });
  }

  let answers: JournalReport['answers'] = null;
  if (ask > 0) {
    let withCitations = 0;
    let right = 0;
    let cited = 0;
    let anyRight = 0;
    for (const entry of perQuestion.slice(0, ask)) {
      const res = await request(app).post('/api/journal/ask').set(auth(user.token)).send({ question: entry.question });
      const done = parseSse(res.text).find(e => e.event === 'done')?.data as { sources: Array<{ date: string }> } | undefined;
      entry.cited = (done?.sources ?? []).map(s => idByDate.get(s.date) ?? s.date);
      if (entry.cited.length) withCitations += 1;
      cited += entry.cited.length;
      right += entry.cited.filter(id => entry.relevant.includes(id)).length;
      if (entry.cited.some(id => entry.relevant.includes(id))) anyRight += 1;
    }
    answers = {
      asked: Math.min(ask, perQuestion.length),
      withCitations,
      citationPrecision: cited ? Math.round((right / cited) * 1000) / 1000 : 0,
      citedARightNote: anyRight,
    };
  }

  const retrieval = Object.fromEntries(METHODS.map(m => [m, {
    all: summarise(rows[m]),
    words: summarise(rows[m].filter(r => r.kind === 'words')),
    meaning: summarise(rows[m].filter(r => r.kind === 'meaning')),
    period: summarise(rows[m].filter(r => r.kind === 'period')),
  }])) as JournalReport['retrieval'];
  return { embeddings, retrieval, answers, perQuestion };
}
