-- AlterTable
ALTER TABLE "users" ADD COLUMN "username" TEXT;
-- CreateIndex
CREATE INDEX "branches_clientId_idx" ON "branches"("clientId");
-- CreateIndex
CREATE INDEX "expenses_assignmentId_idx" ON "expenses"("assignmentId");
-- CreateIndex
CREATE INDEX "ticket_collaborators_technicianId_idx" ON "ticket_collaborators"("technicianId");
-- CreateIndex
CREATE INDEX "tickets_assignedToId_idx" ON "tickets"("assignedToId");
-- CreateIndex
CREATE INDEX "tickets_createdById_idx" ON "tickets"("createdById");
-- CreateIndex
CREATE INDEX "tickets_branchId_idx" ON "tickets"("branchId");
-- CreateUniqueIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
