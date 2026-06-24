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
