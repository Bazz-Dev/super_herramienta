-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "originTicketId" TEXT;

-- CreateIndex
CREATE INDEX "jobs_originTicketId_idx" ON "jobs"("originTicketId");
