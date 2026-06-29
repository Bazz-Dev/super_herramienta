-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "tickets_deletedAt_idx" ON "tickets"("deletedAt");
