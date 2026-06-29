-- CreateTable
CREATE TABLE "expenses" (
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
    CONSTRAINT "expenses_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "expenses_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expenses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "expenses_technicianId_idx" ON "expenses"("technicianId");

-- CreateIndex
CREATE INDEX "expenses_tenantId_status_idx" ON "expenses"("tenantId", "status");

-- CreateIndex
CREATE INDEX "expenses_ticketId_idx" ON "expenses"("ticketId");
