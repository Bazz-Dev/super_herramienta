-- CreateIndex
CREATE UNIQUE INDEX "technicians_tenantId_rut_key" ON "technicians"("tenantId", "rut");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_tenantId_plate_key" ON "vehicles"("tenantId", "plate");
