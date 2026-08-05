-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_quote_sequence_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT NOT NULL,
    CONSTRAINT "quote_sequence_config_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_quote_sequence_config" ("id", "nextNumber", "tenantId", "updatedAt", "updatedById") SELECT "id", "nextNumber", "tenantId", "updatedAt", "updatedById" FROM "quote_sequence_config";
DROP TABLE "quote_sequence_config";
ALTER TABLE "new_quote_sequence_config" RENAME TO "quote_sequence_config";
CREATE UNIQUE INDEX "quote_sequence_config_tenantId_key" ON "quote_sequence_config"("tenantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
