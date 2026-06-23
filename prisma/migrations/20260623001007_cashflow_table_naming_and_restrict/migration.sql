/*
  Warnings:

  - You are about to drop the `Branch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Job` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JobCost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Branch";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Job";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "JobCost";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "branches_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jobs" (
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
    CONSTRAINT "jobs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jobs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_costs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'materiales',
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "date" DATETIME,
    "supplier" TEXT,
    "documentRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_costs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "branches_tenantId_idx" ON "branches"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_clientId_name_key" ON "branches"("clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_importRef_key" ON "jobs"("importRef");

-- CreateIndex
CREATE INDEX "jobs_tenantId_clientId_idx" ON "jobs"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "jobs_branchId_idx" ON "jobs"("branchId");

-- CreateIndex
CREATE INDEX "job_costs_jobId_idx" ON "job_costs"("jobId");
