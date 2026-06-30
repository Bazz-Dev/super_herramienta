/*
  Warnings:

  - You are about to drop the column `driveFolderUrl` on the `tickets` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'no_urgente',
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'nuevo',
    "otNumber" TEXT,
    "estimatedDate" DATETIME,
    "closedDate" DATETIME,
    "workSummary" TEXT,
    "clientComment" TEXT,
    "internalNotes" TEXT,
    "folderKey" TEXT,
    "parentTicketId" TEXT,
    "showToClient" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "jobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "tickets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tickets" ("assignedToId", "branchId", "category", "clientComment", "clientId", "closedDate", "createdAt", "createdById", "deletedAt", "description", "estimatedDate", "id", "internalNotes", "jobId", "otNumber", "parentTicketId", "showToClient", "status", "tenantId", "ticketCode", "title", "updatedAt", "urgency", "workSummary") SELECT "assignedToId", "branchId", "category", "clientComment", "clientId", "closedDate", "createdAt", "createdById", "deletedAt", "description", "estimatedDate", "id", "internalNotes", "jobId", "otNumber", "parentTicketId", "showToClient", "status", "tenantId", "ticketCode", "title", "updatedAt", "urgency", "workSummary" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
CREATE UNIQUE INDEX "tickets_ticketCode_key" ON "tickets"("ticketCode");
CREATE UNIQUE INDEX "tickets_jobId_key" ON "tickets"("jobId");
CREATE INDEX "tickets_tenantId_idx" ON "tickets"("tenantId");
CREATE INDEX "tickets_clientId_idx" ON "tickets"("clientId");
CREATE INDEX "tickets_status_idx" ON "tickets"("status");
CREATE INDEX "tickets_deletedAt_idx" ON "tickets"("deletedAt");
CREATE INDEX "tickets_assignedToId_idx" ON "tickets"("assignedToId");
CREATE INDEX "tickets_createdById_idx" ON "tickets"("createdById");
CREATE INDEX "tickets_branchId_idx" ON "tickets"("branchId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
