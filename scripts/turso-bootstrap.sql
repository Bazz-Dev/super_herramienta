-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandHex" TEXT NOT NULL DEFAULT '#f5b100',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'client',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
-- CreateTable
CREATE TABLE "technicians" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rut" TEXT,
    "specialty" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "technicians_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "crews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "crews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT,
    "crewId" TEXT,
    "assetId" TEXT,
    CONSTRAINT "assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignments_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crews" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CrewToTechnician" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CrewToTechnician_A_fkey" FOREIGN KEY ("A") REFERENCES "crews" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CrewToTechnician_B_fkey" FOREIGN KEY ("B") REFERENCES "technicians" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "technicians_tenantId_idx" ON "technicians"("tenantId");

-- CreateIndex
CREATE INDEX "crews_tenantId_idx" ON "crews"("tenantId");

-- CreateIndex
CREATE INDEX "assets_tenantId_idx" ON "assets"("tenantId");

-- CreateIndex
CREATE INDEX "assignments_tenantId_idx" ON "assignments"("tenantId");

-- CreateIndex
CREATE INDEX "assignments_start_idx" ON "assignments"("start");

-- CreateIndex
CREATE UNIQUE INDEX "_CrewToTechnician_AB_unique" ON "_CrewToTechnician"("A", "B");

-- CreateIndex
CREATE INDEX "_CrewToTechnician_B_index" ON "_CrewToTechnician"("B");
-- AlterTable
ALTER TABLE "technicians" ADD COLUMN "vehiclePlate" TEXT;

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rut" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "clients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    "holderId" TEXT,
    CONSTRAINT "assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assets_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "technicians" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_assets" ("category", "code", "createdAt", "id", "name", "notes", "status", "tenantId", "updatedAt") SELECT "category", "code", "createdAt", "id", "name", "notes", "status", "tenantId", "updatedAt" FROM "assets";
DROP TABLE "assets";
ALTER TABLE "new_assets" RENAME TO "assets";
CREATE INDEX "assets_tenantId_idx" ON "assets"("tenantId");
CREATE INDEX "assets_holderId_idx" ON "assets"("holderId");
CREATE TABLE "new_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "meetingUrl" TEXT,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT,
    "crewId" TEXT,
    "assetId" TEXT,
    "clientId" TEXT,
    CONSTRAINT "assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignments_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crews" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assignments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_assignments" ("assetId", "createdAt", "crewId", "description", "end", "id", "start", "status", "technicianId", "tenantId", "title", "updatedAt") SELECT "assetId", "createdAt", "crewId", "description", "end", "id", "start", "status", "technicianId", "tenantId", "title", "updatedAt" FROM "assignments";
DROP TABLE "assignments";
ALTER TABLE "new_assignments" RENAME TO "assignments";
CREATE INDEX "assignments_tenantId_idx" ON "assignments"("tenantId");
CREATE INDEX "assignments_start_idx" ON "assignments"("start");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "clients_tenantId_idx" ON "clients"("tenantId");
-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plate" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT,
    CONSTRAINT "vehicles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vehicles_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assignment_assignees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL DEFAULT 'tecnico',
    "assignmentId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    CONSTRAINT "assignment_assignees_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignment_assignees_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT,
    CONSTRAINT "assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assets_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_assets" ("category", "code", "createdAt", "id", "name", "notes", "status", "tenantId", "updatedAt") SELECT "category", "code", "createdAt", "id", "name", "notes", "status", "tenantId", "updatedAt" FROM "assets";
DROP TABLE "assets";
ALTER TABLE "new_assets" RENAME TO "assets";
CREATE INDEX "assets_tenantId_idx" ON "assets"("tenantId");
CREATE INDEX "assets_vehicleId_idx" ON "assets"("vehicleId");
CREATE TABLE "new_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "permissionRequested" BOOLEAN NOT NULL DEFAULT false,
    "meetingUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    CONSTRAINT "assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_assignments" ("clientId", "createdAt", "description", "end", "id", "meetingUrl", "start", "status", "tenantId", "title", "updatedAt") SELECT "clientId", "createdAt", "description", "end", "id", "meetingUrl", "start", "status", "tenantId", "title", "updatedAt" FROM "assignments";
DROP TABLE "assignments";
ALTER TABLE "new_assignments" RENAME TO "assignments";
CREATE INDEX "assignments_tenantId_idx" ON "assignments"("tenantId");
CREATE INDEX "assignments_start_idx" ON "assignments"("start");
CREATE TABLE "new_technicians" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rut" TEXT,
    "specialty" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "technicians_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_technicians" ("active", "createdAt", "email", "id", "name", "notes", "phone", "rut", "specialty", "tenantId", "updatedAt") SELECT "active", "createdAt", "email", "id", "name", "notes", "phone", "rut", "specialty", "tenantId", "updatedAt" FROM "technicians";
DROP TABLE "technicians";
ALTER TABLE "new_technicians" RENAME TO "technicians";
CREATE INDEX "technicians_tenantId_idx" ON "technicians"("tenantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_technicianId_key" ON "vehicles"("technicianId");

-- CreateIndex
CREATE INDEX "vehicles_tenantId_idx" ON "vehicles"("tenantId");

-- CreateIndex
CREATE INDEX "assignment_assignees_technicianId_idx" ON "assignment_assignees"("technicianId");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_assignees_assignmentId_technicianId_key" ON "assignment_assignees"("assignmentId", "technicianId");

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
-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "lastServiceDate" DATETIME;
ALTER TABLE "vehicles" ADD COLUMN "nextServiceDate" DATETIME;
ALTER TABLE "vehicles" ADD COLUMN "permisoCirculacionExpiry" DATETIME;
ALTER TABLE "vehicles" ADD COLUMN "revTecnicaExpiry" DATETIME;
ALTER TABLE "vehicles" ADD COLUMN "soapExpiry" DATETIME;

-- CreateTable
CREATE TABLE "technician_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "technicianId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'otro',
    "label" TEXT,
    "fileUrl" TEXT NOT NULL,
    "expiryDate" DATETIME,
    "notes" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "technician_documents_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_technicians" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rut" TEXT,
    "specialty" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "contractType" TEXT NOT NULL DEFAULT 'indefinido',
    "contractEndDate" DATETIME,
    "dailyRate" INTEGER,
    "birthDate" DATETIME,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "technicians_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_technicians" ("active", "createdAt", "email", "id", "name", "notes", "phone", "rut", "specialty", "tenantId", "updatedAt") SELECT "active", "createdAt", "email", "id", "name", "notes", "phone", "rut", "specialty", "tenantId", "updatedAt" FROM "technicians";
DROP TABLE "technicians";
ALTER TABLE "new_technicians" RENAME TO "technicians";
CREATE INDEX "technicians_tenantId_idx" ON "technicians"("tenantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "technician_documents_technicianId_idx" ON "technician_documents"("technicianId");
