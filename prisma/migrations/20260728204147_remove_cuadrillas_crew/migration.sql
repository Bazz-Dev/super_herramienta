-- Cuadrillas (Crew) descartado — módulo sin uso en la operación real, ver
-- docs/ARQUITECTURA.md. Ninguna otra tabla tiene FK Restrict hacia Crew
-- (confirmado en GAP_REGISTER G35), así que este drop es aislado.
PRAGMA foreign_keys=OFF;
DROP TABLE IF EXISTS "_CrewToTechnician";
DROP TABLE IF EXISTS "crews";
PRAGMA foreign_keys=ON;
