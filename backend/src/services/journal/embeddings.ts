// Keeps a user's note embeddings up to date. This runs when they ask a
// question, not when they save a review: nothing leaves the app until they
// use the feature, and it needs no background job (the free API sleeps).
import { createHash } from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AiModel, EMBEDDING_DIMENSIONS } from '../ai/model';

/** Newest notes first, so a long journal is searchable before it's fully indexed. */
const MAX_PER_SYNC = 300;
const BATCH_SIZE = 100;

const hashOf = (text: string) => createHash('sha256').update(`${env.OPENAI_EMBEDDING_MODEL}\n${text}`).digest('hex');

export const toVectorLiteral = (vector: number[]) => `[${vector.join(',')}]`;

/** Embeds new and edited notes and forgets emptied ones. Returns the tokens used. */
export async function syncEmbeddings(userId: string, model: AiModel, signal?: AbortSignal): Promise<number> {
  const rows = await prisma.reflection.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    select: { id: true, notes: true, embedding: { select: { contentHash: true } } },
  });

  const emptied = rows.filter(row => row.embedding && !row.notes?.trim()).map(row => row.id);
  if (emptied.length) await prisma.journalEmbedding.deleteMany({ where: { reflectionId: { in: emptied } } });

  const changed = rows
    .map(row => ({ id: row.id, text: row.notes?.trim() ?? '', saved: row.embedding?.contentHash }))
    .filter(row => row.text)
    .map(row => ({ ...row, hash: hashOf(row.text) }))
    .filter(row => row.hash !== row.saved)
    .slice(0, MAX_PER_SYNC);

  let tokens = 0;
  for (let i = 0; i < changed.length; i += BATCH_SIZE) {
    const batch = changed.slice(i, i + BATCH_SIZE);
    const { vectors, inputTokens } = await model.embed({ texts: batch.map(row => row.text), signal });
    tokens += inputTokens;
    if (vectors.length !== batch.length || vectors.some(vector => vector.length !== EMBEDDING_DIMENSIONS)) {
      throw new Error('The embedding service returned an unexpected shape');
    }
    await prisma.$executeRaw`
      INSERT INTO journal_embeddings ("reflectionId", model, "contentHash", embedding, "updatedAt")
      SELECT id, ${env.OPENAI_EMBEDDING_MODEL}, hash, vector::extensions.vector, now()
      FROM unnest(${batch.map(row => row.id)}::text[], ${batch.map(row => row.hash)}::text[], ${vectors.map(toVectorLiteral)}::text[]) AS input(id, hash, vector)
      ON CONFLICT ("reflectionId") DO UPDATE
      SET model = EXCLUDED.model, "contentHash" = EXCLUDED."contentHash", embedding = EXCLUDED.embedding, "updatedAt" = now()`;
  }
  return tokens;
}
