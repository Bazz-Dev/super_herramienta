-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "installmentsPlanned" INTEGER;

-- CreateTable
CREATE TABLE "job_installments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "netAmount" INTEGER,
    "purchaseOrder" TEXT,
    "purchaseOrderDate" DATETIME,
    "purchaseOrderFileUrl" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" DATETIME,
    "invoiceFileUrl" TEXT,
    "creditDays" INTEGER,
    "paymentDate" DATETIME,
    "paymentAmount" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_installments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "job_installments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "job_installments_jobId_idx" ON "job_installments"("jobId");
