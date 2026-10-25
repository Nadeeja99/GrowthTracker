-- The unused `analytics` table was removed from the schema. IF EXISTS keeps
-- this safe for databases where it was already dropped via `prisma db push`.
DROP TABLE IF EXISTS "analytics";
DROP TYPE IF EXISTS "AnalyticsType";

-- CreateIndex
CREATE INDEX "goals_userId_status_idx" ON "goals"("userId", "status");

-- CreateIndex
CREATE INDEX "milestones_goalId_idx" ON "milestones"("goalId");

-- CreateIndex
CREATE INDEX "tasks_userId_status_idx" ON "tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "tasks_userId_createdAt_idx" ON "tasks"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_goalId_idx" ON "tasks"("goalId");

-- CreateIndex
CREATE INDEX "task_tags_taskId_idx" ON "task_tags"("taskId");

-- CreateIndex
CREATE INDEX "schedules_userId_startTime_idx" ON "schedules"("userId", "startTime");

-- CreateIndex
CREATE INDEX "schedules_goalId_idx" ON "schedules"("goalId");

-- CreateIndex
CREATE INDEX "schedules_taskId_idx" ON "schedules"("taskId");

-- CreateIndex
CREATE INDEX "habits_userId_idx" ON "habits"("userId");

