-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Branch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "costCenter" TEXT,
    "jobNumber" INTEGER,
    "importRef" TEXT,
    "quoteRef" TEXT,
    "hasTechReport" BOOLEAN NOT NULL DEFAULT false,
    "reportId" TEXT,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'requerimiento',
    "status" TEXT NOT NULL DEFAULT 'ejecutado',
    "executionDate" DATETIME,
    "technicianId" TEXT,
    "notes" TEXT,
    "extraNotes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "netAmount" INTEGER,
    "taxAmount" INTEGER,
    "purchaseOrder" TEXT,
    "purchaseOrderDate" DATETIME,
    "invoiceNumber" TEXT,
    "invoiceDate" DATETIME,
    "creditDays" INTEGER,
    "paymentMethodRaw" TEXT,
    "collectionStatus" TEXT NOT NULL DEFAULT 'sin_oc',
    "paymentDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobCost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'materiales',
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "date" DATETIME,
    "supplier" TEXT,
    "documentRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobCost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Branch_tenantId_idx" ON "Branch"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_clientId_name_key" ON "Branch"("clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Job_importRef_key" ON "Job"("importRef");

-- CreateIndex
CREATE INDEX "Job_tenantId_clientId_idx" ON "Job"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "Job_branchId_idx" ON "Job"("branchId");

-- CreateIndex
CREATE INDEX "JobCost_jobId_idx" ON "JobCost"("jobId");
