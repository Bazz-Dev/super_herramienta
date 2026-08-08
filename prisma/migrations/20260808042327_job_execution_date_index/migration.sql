-- CreateIndex
CREATE INDEX "jobs_tenantId_executionDate_idx" ON "jobs"("tenantId", "executionDate");
