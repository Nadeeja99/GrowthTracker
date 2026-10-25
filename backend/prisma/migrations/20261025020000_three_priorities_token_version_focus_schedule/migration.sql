-- Priority now has three levels; fold URGENT into HIGH before the enum shrinks,
-- otherwise the cast below would fail for existing URGENT rows.
UPDATE "goals" SET "priority" = 'HIGH' WHERE "priority" = 'URGENT';
UPDATE "tasks" SET "priority" = 'HIGH' WHERE "priority" = 'URGENT';

-- AlterEnum
BEGIN;
CREATE TYPE "Priority_new" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
ALTER TABLE "goals" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "goals" ALTER COLUMN "priority" TYPE "Priority_new" USING ("priority"::text::"Priority_new");
ALTER TABLE "tasks" ALTER COLUMN "priority" TYPE "Priority_new" USING ("priority"::text::"Priority_new");
ALTER TYPE "Priority" RENAME TO "Priority_old";
ALTER TYPE "Priority_new" RENAME TO "Priority";
DROP TYPE "Priority_old";
ALTER TABLE "goals" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
ALTER TABLE "tasks" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
COMMIT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "focus_sessions" ADD COLUMN     "scheduleId" TEXT;

-- CreateIndex
CREATE INDEX "focus_sessions_scheduleId_idx" ON "focus_sessions"("scheduleId");

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

