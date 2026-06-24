-- ClientOps module: tickets, portal per client, Drive integration

-- New columns on existing tables
ALTER TABLE "clients" ADD COLUMN "portalSlug" TEXT;
ALTER TABLE "clients" ADD COLUMN "portalTheme" TEXT;
ALTER TABLE "clients" ADD COLUMN "driveFolderId" TEXT;
CREATE UNIQUE INDEX "clients_portalSlug_key" ON "clients"("portalSlug");

ALTER TABLE "branches" ADD COLUMN "city" TEXT;

ALTER TABLE "users" ADD COLUMN "clientId" TEXT;

-- Tickets
CREATE TABLE "tickets" (
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
    "driveFolderUrl" TEXT,
    "parentTicketId" TEXT,
    "showToClient" BOOLEAN NOT NULL DEFAULT 1,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "jobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tickets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tickets_ticketCode_key" ON "tickets"("ticketCode");
CREATE UNIQUE INDEX "tickets_jobId_key" ON "tickets"("jobId");
CREATE INDEX "tickets_tenantId_idx" ON "tickets"("tenantId");
CREATE INDEX "tickets_clientId_idx" ON "tickets"("clientId");
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- Ticket history
CREATE TABLE "ticket_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_history_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ticket_history_ticketId_idx" ON "ticket_history"("ticketId");

-- Ticket items (sub-tasks)
CREATE TABLE "ticket_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_items_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ticket_items_ticketId_idx" ON "ticket_items"("ticketId");

-- Ticket documents (metadata only, file lives in Drive)
CREATE TABLE "ticket_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_documents_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ticket_documents_ticketId_idx" ON "ticket_documents"("ticketId");

-- Ticket collaborators (M:N technician <-> ticket)
CREATE TABLE "ticket_collaborators" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    CONSTRAINT "ticket_collaborators_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_collaborators_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ticket_collaborators_ticketId_technicianId_key" ON "ticket_collaborators"("ticketId", "technicianId");
