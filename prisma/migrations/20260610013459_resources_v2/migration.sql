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
