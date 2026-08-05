-- CreateTable
CREATE TABLE "quote_sequence_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_sequence_config_tenantId_key" ON "quote_sequence_config"("tenantId");
