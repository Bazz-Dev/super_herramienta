-- AlterTable
ALTER TABLE "ticket_items" ADD COLUMN "category" TEXT;
ALTER TABLE "ticket_items" ADD COLUMN "comment" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ticket_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" TEXT,
    CONSTRAINT "ticket_documents_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ticket_documents_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ticket_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ticket_documents" ("fileUrl", "id", "mimeType", "name", "ticketId", "uploadedAt", "uploadedById") SELECT "fileUrl", "id", "mimeType", "name", "ticketId", "uploadedAt", "uploadedById" FROM "ticket_documents";
DROP TABLE "ticket_documents";
ALTER TABLE "new_ticket_documents" RENAME TO "ticket_documents";
CREATE INDEX "ticket_documents_ticketId_idx" ON "ticket_documents"("ticketId");
CREATE INDEX "ticket_documents_itemId_idx" ON "ticket_documents"("itemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
