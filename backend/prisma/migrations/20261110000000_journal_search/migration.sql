-- Supabase keeps extensions in their own schema, which it creates for every
-- project. Elsewhere (CI, local) this creates it, on an image with pgvector.
CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

-- CreateTable
CREATE TABLE "journal_embeddings" (
    "reflectionId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" extensions.vector(512) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_embeddings_pkey" PRIMARY KEY ("reflectionId")
);

-- AddForeignKey
ALTER TABLE "journal_embeddings" ADD CONSTRAINT "journal_embeddings_reflectionId_fkey" FOREIGN KEY ("reflectionId") REFERENCES "reflections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No vector index on purpose: every search covers one person's notes, a few
-- hundred rows found through reflections_userId_date_key, and scanning those
-- exactly is both fast and more accurate than an approximate index.

-- Every table needs RLS on Supabase (see tests/rls.test.ts).
ALTER TABLE "journal_embeddings" ENABLE ROW LEVEL SECURITY;
