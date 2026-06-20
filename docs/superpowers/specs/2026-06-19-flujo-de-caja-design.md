# Diseño — Módulo Flujo de Caja (INGEGAR Platform)

> Fecha: 2026-06-19 · Estado: aprobado para plan de implementación

## 1. Contexto y objetivo

INGEGAR lleva hoy su flujo de caja en un Excel (`Flujo de Caja Just Burger
General 2026.xlsx`, una pestaña por mes). El objetivo es un **módulo en el
sistema** para:

1. **Migrar** los datos históricos (205 trabajos ene–jun 2026, $73.135.006 neto)
   limpios al modelo de BD.
2. **Administrar y alimentar** desde la app: sucursales, trabajos (ingreso +
   cobranza) y costos por trabajo.
3. **Medir** indicadores de cobranza y rentabilidad.

Es un módulo **multi-cliente** desde el diseño (filtrable por cliente). Hoy se
carga solo Just Burger; otros clientes y los costos se suman después con el mismo
esquema.

## 2. Naturaleza de los datos (hallazgos del Excel real)

- Cada fila = **un trabajo facturable**: ingreso (neto/IVA/total) + seguimiento
  de cobranza (OC, factura, estado de pago). Es la **cara de ingresos** del flujo;
  los **costos** aún no existen y se alimentarán por trabajo (→ margen).
- Las 3 columnas "Descripción" y las 3 "Fecha ejecución" están **fusionadas**
  (0 trabajos con fechas múltiples) → se usa **una** de cada una.
- `Estatus` = **tipo** (Requerimiento 106 / Emergencia 49 / Preventivo 49 / 1
  "Término preventivo"). `Estado` = estado del trabajo (todos "Ejecutado").
- Estado de cobro: **SIN OC 82 · PENDIENTE PAGO 64 · PAGADO 56**.
- **Centro de costo** cambió de formato cada mes y **N° trabajo se reinicia** →
  **no son llaves estables**. La BD usa un **id propio (cuid)** y guarda esos
  códigos como atributos.
- Sucursales con duplicados por tipeo/acento/mayúscula → se normalizan a una
  **lista administrable** (ver §5).

## 3. Decisiones clave

| Tema | Decisión |
|------|----------|
| Alcance v1 | Ingresos + cobranza (migración) + captura de costos por trabajo (margen). Sin egresos generales de empresa (YAGNI). |
| Multi-cliente | `Branch` y `Job` cuelgan del **`Client`** existente (Recursos). Just Burger es un Client. Dashboard filtrable por cliente. |
| Sucursal | Entidad **`Branch`** administrable, por cliente. |
| Llave de trabajo | `id` surrogate (cuid). `costCenter` / `jobNumber` son atributos. |
| Tenant | Todo scoped por `tenantId` (regla `tenantScope` existente). |
| Nombre en menú | **Flujo de Caja** (`/flujo`). |

## 4. Modelo de datos (Prisma)

Reusa `Client` (ya existe, tenant-scoped). Modelos nuevos:

```prisma
model Branch {
  id        String   @id @default(cuid())
  tenantId  String
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  name      String                       // canónico, ej. "Quilín"
  active    Boolean  @default(true)
  jobs      Job[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([clientId, name])
}

enum JobType { requerimiento emergencia preventivo proyecto otro }
enum JobStatus { pendiente en_proceso ejecutado anulado }
enum CollectionStatus { sin_oc pendiente_pago pagado }   // "vencido" se calcula

model Job {
  id                String   @id @default(cuid())
  tenantId          String
  clientId          String
  client            Client   @relation(fields: [clientId], references: [id])
  branchId          String
  branch            Branch   @relation(fields: [branchId], references: [id])

  // Identificación
  costCenter        String?
  jobNumber         Int?
  importRef         String?  @unique   // clave determinista de migración (idempotencia)
  quoteRef          String?            // PPTO
  hasTechReport     Boolean  @default(false)  // I.T.
  reportId          String?            // enlace futuro a Informe Técnico
  description       String
  type              JobType  @default(requerimiento)
  status            JobStatus @default(ejecutado)
  executionDate     DateTime?
  technicianId      String?            // enlace a Recursos (Technician)
  notes             String?
  extraNotes        String?

  // Ingreso (CLP enteros)
  currency          String   @default("CLP")
  netAmount         Int?
  taxAmount         Int?               // IVA; si falta se calcula 19%

  // Cobranza
  purchaseOrder     String?            // OC
  purchaseOrderDate DateTime?
  invoiceNumber     String?            // FACTURA
  invoiceDate       DateTime?
  creditDays        Int?               // de "30 días" → 30
  paymentMethodRaw  String?            // original "30 días" / "2 CUOTAS"
  collectionStatus  CollectionStatus @default(sin_oc)
  paymentDate       DateTime?

  costs             JobCost[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([tenantId, clientId])
}

enum CostCategory { materiales mano_obra subcontrato transporte otros }

model JobCost {
  id          String   @id @default(cuid())
  jobId       String
  job         Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  category    CostCategory @default(materiales)
  description String?
  amount      Int                       // neto CLP
  date        DateTime?
  supplier    String?
  documentRef String?                   // boleta/factura del gasto
  createdAt   DateTime @default(now())
}
```

`Client` gana las relaciones inversas `branches Branch[]` y `jobs Job[]`.

### Derivados (calculados, no se persisten)

- `total = netAmount + taxAmount`
- `dueDate = invoiceDate + creditDays`
- `daysOverdue` / `vencido` = `collectionStatus == pendiente_pago && hoy > dueDate`
- `margin = netAmount − Σ costs.amount` · `marginPct = margin / netAmount`

## 5. Homologación Excel → modelo

### Mapeo de columnas (índice 1-based, considerando celdas fusionadas)

| Col | Excel | Campo |
|-----|-------|-------|
| 1 | Centro de costo | `costCenter` |
| 2 | N° trabajo | `jobNumber` |
| 3 | I.T. (SI/NO) | `hasTechReport` |
| 4 | PPTO | `quoteRef` |
| 5 | Sucursal | `branchId` (vía normalización) |
| 6 | Descripcion (fusión 6–8) | `description` |
| 9 | Fecha ejecución (fusión 9–11) | `executionDate` |
| 12 | Observaciones | `notes` |
| 13 | Estatus | `type` |
| 14 | Estado | `status` |
| 15 | Observación adicionales | `extraNotes` |
| 16 | Monto neto | `netAmount` |
| 17 | IVA | `taxAmount` |
| 18 | Total | (se descarta; se recalcula) |
| 19–20 | OC / Fecha OC | `purchaseOrder` / `purchaseOrderDate` |
| 21–22 | Factura / Fecha factura | `invoiceNumber` / `invoiceDate` |
| 23 | Método de pago | `creditDays` + `paymentMethodRaw` |
| 24 | ESTADO (pago) | `collectionStatus` |
| 25 | Fecha pago | `paymentDate` |
| 26 | Fecha pago (dup) | (se descarta) |

### Reglas de normalización

- **Montos:** parsear `$80.000` / `$15.200,00` → entero CLP. Si `netAmount` y
  `taxAmount` faltan pero hay total, derivar; si falta IVA, `round(neto*0.19)`.
- **Fechas:** las celdas ya son `Date` en Excel → ISO.
- **`creditDays`:** "30 días" → 30; "2 CUOTAS"/texto no numérico → `null` +
  guardar original en `paymentMethodRaw`.
- **`type`:** mapear a enum; "Término preventivo" → `preventivo`; desconocido →
  `otro`.
- **`collectionStatus`:** PAGADO → `pagado`; PENDIENTE PAGO → `pendiente_pago`;
  SIN OC / vacío → `sin_oc`.
- **`hasTechReport`:** "SI" → true.

### Mapa de alias de sucursales (todas las redundantes unidas)

Canónicas: Toesca · Manuel Montt · La Reina · **Huechuraba** (←Huechurana) ·
Providencia · **Rotonda Atenas** (←Rotonda) · Machalí · Villa Alemana · Isidora
(←"Isidora ") · Tranqueras · **Viña del Mar** (←ViñA, ViñA Del Mar) · **Quilín**
(←Quilin, QuilíN) · **La Florida** (←Dk La Florida) · **Lo Barnechea**
(←Dk Lo Barnechea). Normalización base: trim, colapsar espacios, corregir
acentos/mayúsculas; luego aplicar el mapa de alias. Branches inexistentes se
crean al vuelo durante la migración.

## 6. Migración

- Script `scripts/import-flujo.ts` (devDependency **exceljs**): lee el `.xlsx`,
  aplica §5, crea/asegura el `Client` "Just Burger" y sus `Branch`, e inserta los
  `Job`. **Idempotente**: cada fila genera un `importRef` determinista
  (`flujo2026#<HOJA>#<nº fila>`) y el script hace **upsert** sobre `importRef`,
  de modo que re-correr la migración actualiza en vez de duplicar.
- Emite además un **CSV consolidado** `design-reference/flujo-consolidado.csv`
  (una fila por trabajo, columnas normalizadas) como respaldo auditable.
- Funciona contra SQLite local y Turso (usa el adapter existente).

## 7. Indicadores (dashboard del módulo)

- **KPIs (período + filtro cliente):** Facturado · Por cobrar · Cobrado ·
  Sin facturar (sin OC) · Vencido.
- **Aging** de cuentas por cobrar (0–30 / 31–60 / 60+) y **días promedio de
  cobro** (`paymentDate − invoiceDate`).
- **Margen total y %** (se activa al cargar costos).
- Cortes por **sucursal, tipo, mes (tendencia), técnico**; top trabajos por
  monto / margen.
- Cálculo en `src/lib/cashflow/metrics.ts` (funciones puras, testeables).

## 8. Arquitectura / UI (sigue patrones existentes)

- `src/lib/cashflow/` — `schemas.ts` (Zod), `metrics.ts`, `labels.ts`, `dates.ts`.
- `src/lib/cashflow/queries.ts` — lecturas scoped (`tenantScope`), con filtro por
  `clientId`.
- `src/app/(app)/flujo/` — `page.tsx` (dashboard + KPIs + filtro cliente/período),
  `trabajos/` (lista + new + [id]), `sucursales/` (CRUD), y costos dentro del
  detalle de trabajo. `actions.ts` (`'use server'`, Zod + `revalidatePath`).
- `src/components/cashflow/` — tablas, filtros, formularios, tarjetas KPI, gráfico
  de tendencia (componente simple SVG/canvas; sin nueva dependencia pesada).
- **Sidebar:** agregar "Flujo de Caja" (`/flujo`).
- Branding/UX consistentes (ámbar, Inter, íconos SVG, `cursor-pointer`,
  focus-visible, empty states).

## 9. Fuera de alcance (YAGNI v1)

- Egresos generales de empresa (sueldos, arriendo) — solo costos **por trabajo**.
- Conciliación bancaria / integración con SII o bancos.
- Proyección/forecast de caja futura.
- Reportes PDF del flujo (se puede sumar después reusando `src/lib/pdf/render.ts`).

## 10. Testing

- Unit (`tests/unit/`): normalización (montos, fechas, creditDays, alias de
  sucursal), `metrics.ts` (facturado/por cobrar/cobrado/aging/margen), bordes
  (sin OC, sin neto, sin costos).
- E2E (`tests/e2e/`): el módulo carga, filtra por cliente, crea sucursal, crea
  trabajo, agrega costo y el margen aparece.
- Verificación de migración: el script reporta 205 trabajos y total $73.135.006
  contra el conteo del Excel.
