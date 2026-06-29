-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "ticketId" TEXT,
    "assignmentId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'otro',
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "receiptUrl" TEXT,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "approvedById" TEXT,
    "rejectedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "expenses_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "expenses_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expenses_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expenses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_expenses" ("amount", "approvedById", "assignmentId", "category", "createdAt", "date", "description", "id", "receiptUrl", "rejectedReason", "status", "technicianId", "tenantId", "ticketId", "updatedAt") SELECT "amount", "approvedById", "assignmentId", "category", "createdAt", "date", "description", "id", "receiptUrl", "rejectedReason", "status", "technicianId", "tenantId", "ticketId", "updatedAt" FROM "expenses";
DROP TABLE "expenses";
ALTER TABLE "new_expenses" RENAME TO "expenses";
CREATE INDEX "expenses_technicianId_idx" ON "expenses"("technicianId");
CREATE INDEX "expenses_tenantId_status_idx" ON "expenses"("tenantId", "status");
CREATE INDEX "expenses_ticketId_idx" ON "expenses"("ticketId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
