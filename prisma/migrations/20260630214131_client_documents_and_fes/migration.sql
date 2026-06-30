-- CreateTable
CREATE TABLE "client_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'otro',
    "title" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "metadata" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "client_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "signature_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "documentData" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "rutConfirmed" TEXT,
    "signedAt" DATETIME,
    "signedIp" TEXT,
    "rejectedAt" DATETIME,
    "rejectedNote" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "signature_requests_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "signature_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "client_documents_tenantId_idx" ON "client_documents"("tenantId");

-- CreateIndex
CREATE INDEX "client_documents_clientId_idx" ON "client_documents"("clientId");

-- CreateIndex
CREATE INDEX "signature_requests_tenantId_idx" ON "signature_requests"("tenantId");

-- CreateIndex
CREATE INDEX "signature_requests_technicianId_idx" ON "signature_requests"("technicianId");
