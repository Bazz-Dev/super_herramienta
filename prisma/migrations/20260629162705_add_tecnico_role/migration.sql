-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'client',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "technicianId" TEXT,
    CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "users_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("active", "clientId", "createdAt", "email", "id", "name", "passwordHash", "role", "tenantId", "updatedAt") SELECT "active", "clientId", "createdAt", "email", "id", "name", "passwordHash", "role", "tenantId", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_technicianId_key" ON "users"("technicianId");
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
