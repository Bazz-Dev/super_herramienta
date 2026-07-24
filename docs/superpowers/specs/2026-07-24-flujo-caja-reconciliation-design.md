# Flujo de Caja — reconciliación e importación de datos — diseño

> Sub-proyecto 2. Depende del schema de `2026-07-24-flujo-caja-job-schema-design.md`.
> Decisión ya tomada con el dueño: **match + actualizar**, no reemplazo total,
> no "dejar ambos" — cada trabajo del archivo nuevo se empareja con uno
> existente en Turso cuando corresponde, se crea cuando no.

## Hallazgos concretos sobre los 286 registros del archivo

(Analizados directamente del JSON embebido en el HTML de referencia — no
son estimaciones.)

- **270 Just Burger, 8 Tarragona, 3 Decathlon, 2 Pandora, 2 Unity, 1 JLL.**
  Tarragona, Pandora y JLL no existen hoy como `Client`.
- **101 de los 270 registros de Just Burger** (37%) tienen `"SIN CENTRO DE
  COSTO"` como identificador en el Excel fuente — no es un error de lectura,
  es que esos trabajos nunca tuvieron código asignado en el sistema actual.
  No bloquea el match (tienen fecha/sucursal/monto/descripción reales) pero
  reduce la confianza del emparejamiento por ID para ese subconjunto.
- **`normalizeBranchName()` ya existente cubre casi todas las variantes
  sucias** (mayúsculas, tildes, "DK La Florida" vs "La Florida", etc.) — no
  necesita cambios.
- **3 registros están genuinamente rotos** y se excluyen del auto-apply,
  quedan en la sección "Requiere revisión manual" del reporte:
  - `IMP-PAN-0007` (Pandora): campo sucursal contiene 7 malls concatenados
    con comas.
  - `260528-DC-RQ-02` (Decathlon): 3 fechas concatenadas con `|` en
    `requestDate`/`executionDate`.
  - `SIN CENTRO DE COSTO-25` (Just Burger): fecha incompleta ("04/06/",
    sin año) en `poDate`.

## Algoritmo de match (por registro del archivo nuevo, contra `Job` de Turso)

Ejecutar en este orden, primer hit gana:

1. **`importRef` reconstruido.** Los Just Burger/Decathlon/Unity ya
   importados por `scripts/import-flujo.ts` tienen
   `importRef = "{PREFIX}#{hoja}#{fila}"` (`JB#`/`DC#`/`UTY#`). El archivo
   nuevo trae `source.sheet` + `source.row` para cada registro con ese mismo
   origen — se reconstruye el mismo `importRef` y se busca exacto. Si el
   Excel fuente no tuvo filas insertadas/reordenadas desde el import
   original, esto da un match 1:1 exacto al mismo trabajo. **Confianza
   alta pero no ciega**: se valida contra un segundo criterio (mismo cliente
   + sucursal normalizada + monto neto igual) antes de aplicar; si no
   calzan, cae al siguiente nivel en vez de forzar el match.
2. **N° de factura exacto** (`invoiceNumber` no vacío) + mismo cliente.
3. **N° de presupuesto exacto** (`quoteNumber` no vacío) + mismo cliente.
4. **Fuzzy**: mismo cliente + sucursal normalizada + misma fecha
   (`executionDate` o `requestDate`) + `amountNet` idéntico. Sin tolerancia
   de monto — si el monto no calza exacto, no es el mismo trabajo o el
   trabajo cambió de valor, cualquiera de los dos casos amerita revisión
   humana, no un umbral arbitrario.
5. **Sin match** → candidato a **INSERT** (trabajo nuevo).

Si dos o más registros nuevos matchean el mismo `Job` existente, o un
registro nuevo matchea con la misma confianza contra dos `Job` existentes
distintos → va a "Requiere revisión manual", nunca se resuelve por default.

### Qué se escribe en un UPDATE (match confirmado)

- **Solo se completan los campos nuevos** del sub-proyecto 1
  (`processFlow`, `commercialStage`, `operationalStage`,
  `documentationStage`, `financialStage`, `docOt/docPhotos/docReport/
  docClientSent`, `code`, `rejectionReason/rejectionDate`, `nonBillable`,
  `lastContactDate/nextContactDate/contactNote`) — estos no tenían valor
  antes, no hay nada que puedan pisar.
- **Los campos "clásicos" (`netAmount`, `invoiceNumber`, `poNumber`, etc.)
  solo se actualizan si el valor actual en Turso está vacío/null.** Nunca se
  sobreescribe un valor ya cargado — si alguien completó manualmente un dato
  en el sistema actual, ese dato manda sobre el Excel.
- `JobCost`, `technicianId`, `originTicketId`, `originProposalId` — **nunca
  se tocan** por este script, sin excepción.

### Qué se crea en un INSERT (sin match)

Fila `Job` nueva completa (campos clásicos + nuevos), con `code` generado
según el esquema `YYMMDD-CLI-TT-NN` (o `IMP-CLI-NNNN` si no hay
`requestDate` confiable) y `importRef` nuevo (`FLUJO2026B#{sheet}#{row}` —
prefijo distinto al de la carga original, para no colisionar nunca con un
`importRef` viejo por accidente).

## Clientes nuevos (Tarragona, Pandora, JLL)

Antes de crear cada `Client`, chequeo de duplicado (pedido explícito del
dueño, mismo criterio en todos los selectores de cliente de la app):
nombre normalizado (mayúsculas, sin tildes, sin sufijos tipo "SPA"/"LTDA"/
"CHILE") contra los `Client` ya existentes del tenant. Si hay una
coincidencia parcial (ej. "Tarragona" ya existiera como "Tarragona Chile
SpA") se detiene ese cliente específico y queda en el reporte para
confirmación manual — no se crea nada duplicado por asumir que son
distintos.

## El reporte de dry-run (obligatorio antes de cualquier escritura)

El script corre siempre primero en modo `--dry-run` (default; se necesita
`--apply` explícito para escribir) y produce:

```
RESUMEN
  270 Just Burger · 8 Tarragona · 3 Decathlon · 2 Pandora · 2 Unity · 1 JLL

MATCHES EXACTOS (importRef reconstruido + validado)     — N registros, auto-apply
MATCHES POR FACTURA/PRESUPUESTO                          — N registros, auto-apply
MATCHES FUZZY (cliente+sucursal+fecha+monto)              — N registros, auto-apply
SIN MATCH → trabajos nuevos a crear                       — N registros
CLIENTES NUEVOS A CREAR                                   — Tarragona, Pandora, JLL (o los que no den duplicado)

REQUIERE REVISIÓN MANUAL (no se toca sin decisión explícita):
  - Multi-match ambiguo: [lista con ambos candidatos]
  - IMP-PAN-0007: sucursal con 7 malls concatenados
  - 260528-DC-RQ-02: 3 fechas concatenadas
  - SIN CENTRO DE COSTO-25: fecha incompleta en poDate
  - Cliente nuevo con posible duplicado: [si aplica]
```

## Bloqueante actual (no de diseño — de acceso)

El entorno local no tiene `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` en `.env`
— solo `DATABASE_URL=file:./prisma/dev.db` (SQLite local). El script se
construye completo y se corre en `--dry-run` contra dev.db para verificar
que no explota, pero **el dry-run real (el que importa, contra los datos
verdaderos de Turso) necesita que el dueño provea las credenciales de Turso
para esta sesión, o que corra el comando él mismo** — coherente con la
regla no negociable de `CLAUDE.md` de nunca apuntar scripts a Turso sin que
el dueño esté al tanto en el momento exacto en que se ejecuta.
