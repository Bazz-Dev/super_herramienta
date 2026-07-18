-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_client_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'otro',
    "title" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "dataJson" TEXT,
    "metadata" TEXT,
    "ticketId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "proposalStatus" TEXT,
    "proposalAmount" INTEGER,
    "sentAt" DATETIME,
    "viewedAt" DATETIME,
    "responseAt" DATETIME,
    "followUpAt" DATETIME,
    "proposalNote" TEXT,
    CONSTRAINT "client_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "client_documents_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_client_documents" ("clientId", "createdAt", "createdById", "dataJson", "fileKey", "followUpAt", "id", "metadata", "proposalAmount", "proposalNote", "proposalStatus", "responseAt", "sentAt", "tenantId", "title", "type", "updatedAt", "viewedAt") SELECT "clientId", "createdAt", "createdById", "dataJson", "fileKey", "followUpAt", "id", "metadata", "proposalAmount", "proposalNote", "proposalStatus", "responseAt", "sentAt", "tenantId", "title", "type", "updatedAt", "viewedAt" FROM "client_documents";
DROP TABLE "client_documents";
ALTER TABLE "new_client_documents" RENAME TO "client_documents";
CREATE INDEX "client_documents_tenantId_idx" ON "client_documents"("tenantId");
CREATE INDEX "client_documents_clientId_idx" ON "client_documents"("clientId");
CREATE INDEX "client_documents_ticketId_idx" ON "client_documents"("ticketId");
CREATE INDEX "client_documents_proposalStatus_idx" ON "client_documents"("proposalStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
