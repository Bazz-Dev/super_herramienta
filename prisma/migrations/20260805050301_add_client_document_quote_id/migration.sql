-- AlterTable
ALTER TABLE "client_documents" ADD COLUMN "quoteId" TEXT;

-- CreateIndex
CREATE INDEX "client_documents_quoteId_idx" ON "client_documents"("quoteId");
