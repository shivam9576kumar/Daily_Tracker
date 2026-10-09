-- CreateIndex
CREATE INDEX "plans_user_id_status_idx" ON "plans"("user_id", "status");

-- CreateIndex
CREATE INDEX "assignments_user_id_status_idx" ON "assignments"("user_id", "status");
