-- AlterTable
ALTER TABLE "client_documents" ADD COLUMN "followUpAt" DATETIME;
ALTER TABLE "client_documents" ADD COLUMN "proposalAmount" INTEGER;
ALTER TABLE "client_documents" ADD COLUMN "proposalNote" TEXT;
ALTER TABLE "client_documents" ADD COLUMN "proposalStatus" TEXT;
ALTER TABLE "client_documents" ADD COLUMN "responseAt" DATETIME;
ALTER TABLE "client_documents" ADD COLUMN "sentAt" DATETIME;
ALTER TABLE "client_documents" ADD COLUMN "viewedAt" DATETIME;

-- CreateIndex
CREATE INDEX "client_documents_proposalStatus_idx" ON "client_documents"("proposalStatus");
