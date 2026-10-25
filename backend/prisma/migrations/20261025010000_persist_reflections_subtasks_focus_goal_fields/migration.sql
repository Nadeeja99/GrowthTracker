-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#3B82F6',
ADD COLUMN     "targetHoursDaily" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
ADD COLUMN     "targetHoursWeekly" DOUBLE PRECISION NOT NULL DEFAULT 10;

-- Data migration: goal settings used to be JSON-encoded in "description"
-- ({"color","targetHoursWeekly","targetHoursDaily"}). Copy valid values into
-- the new columns and clear the blob so description holds free text only.
-- Each row is handled in its own exception block, so a malformed blob is
-- left untouched instead of failing the whole migration.
DO $$
DECLARE
  r RECORD;
  meta JSONB;
BEGIN
  FOR r IN SELECT id, description FROM "goals" WHERE description LIKE '{%}' LOOP
    BEGIN
      meta := r.description::jsonb;
      IF jsonb_typeof(meta) = 'object'
         AND (meta ? 'color' OR meta ? 'targetHoursWeekly' OR meta ? 'targetHoursDaily') THEN
        UPDATE "goals" SET
          "color" = CASE WHEN meta->>'color' ~ '^#[0-9A-Fa-f]{6}$' THEN meta->>'color' ELSE "color" END,
          "targetHoursWeekly" = COALESCE((meta->>'targetHoursWeekly')::double precision, "targetHoursWeekly"),
          "targetHoursDaily" = COALESCE((meta->>'targetHoursDaily')::double precision, "targetHoursDaily"),
          "description" = NULL
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping goal % with unparseable description', r.id;
    END;
  END LOOP;
END $$;

-- CreateTable
CREATE TABLE "subtasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reflections" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "performance" INTEGER,
    "energy" INTEGER,
    "mood" INTEGER,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reflections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus_sessions" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "plannedSeconds" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subtasks_taskId_position_idx" ON "subtasks"("taskId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "reflections_userId_date_key" ON "reflections"("userId", "date");

-- CreateIndex
CREATE INDEX "focus_sessions_userId_startedAt_idx" ON "focus_sessions"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "focus_sessions_goalId_idx" ON "focus_sessions"("goalId");

-- CreateIndex
CREATE INDEX "focus_sessions_taskId_idx" ON "focus_sessions"("taskId");

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

