# Flujo de Caja — extensión del modelo `Job` — diseño

> Sub-proyecto 1 de la reescritura de Flujo de Caja. Ver
> `2026-06-19-flujo-de-caja-design.md` (modelo original) y el prototipo de
> referencia `flujo de caja produccion/INGEGAR_Control_IngegarONE_UI_Acordeon_2026 (1).html`
> (286 trabajos reales embebidos, capas de UI acumuladas v8→v13; la vista
> final es una lista acordeón agrupada por cliente→período).

## Decisión ya tomada con el dueño

Extender `Job` de forma aditiva. `JobCost`, `originTicketId`,
`originProposalId`, Pipeline y todo lo que ya funciona en producción **no se
toca**. `status` (`JobStatus`) y `collectionStatus` (`CollectionStatus`) —
de los que dependen `computeMetrics()`, `computeMonthlyTrend()` y el
dashboard/flujo actuales (confirmado por grep: son la única fuente de los
KPIs de facturación/cobranza hoy) — **se mantienen intactos como columnas
reales**, pero pasan a ser *derivados* de los campos nuevos y más
granulares, escritos por un helper compartido en cada punto de escritura.
Así el motor de métricas existente sigue funcionando sin cambios, y la UI
nueva trabaja con el detalle real que trae el prototipo.

## Por qué el prototipo necesita más que `status`/`collectionStatus`

El archivo separa cada trabajo en 4 pistas de estado en paralelo (venta,
ejecución, papeleo, cobranza) más un eje de origen (`processFlow`) que hoy no
existe en absoluto: si el trabajo se cotizó antes de ejecutarse (Flujo B,
226/286 registros reales) o se ejecutó primero y se valoriza/cobra después
(Flujo A — emergencia, 60/286). `collectionStatus` (3 estados) no alcanza
para representar "con OC pero sin facturar" vs "facturado pendiente de
pago" vs "vencido" como estados distintos y accionables — que es
exactamente lo que la vista de Cobranza del prototipo necesita.

## Cambios de schema (migración aditiva, sin tocar filas existentes)

```prisma
enum ProcessFlow {
  pre_quote        // Flujo B: se cotiza antes de ejecutar
  post_execution   // Flujo A: se ejecuta primero (emergencia), se valoriza después
}

enum CommercialStage {
  intake
  quote_draft
  quote_sent
  valuation_pending   // solo Flujo A: ejecutado, aún sin precio
  approved
  rejected
}

enum OperationalStage {
  pending
  scheduled
  in_progress
  executed
  client_review
  closed
}

enum DocumentationStage {
  pending
  partial
  ready
  sent
}

enum FinancialStage {
  no_po
  po_requested
  po_received
  to_invoice
  invoiced
  payment_pending
  overdue
  paid
}

model Job {
  // ... campos existentes intactos ...

  code                String?              @unique   // YYMMDD-CLI-TT-NN | IMP-CLI-NNNN, ver más abajo
  processFlow         ProcessFlow          @default(pre_quote)
  commercialStage     CommercialStage      @default(intake)
  operationalStage    OperationalStage     @default(pending)
  documentationStage  DocumentationStage   @default(pending)
  financialStage      FinancialStage       @default(no_po)

  docOt               Boolean?             // null = sin dato, no "no listo"
  docPhotos           Boolean?
  docReport           Boolean?
  docClientSent       Boolean?

  rejectionReason     String?
  rejectionDate       DateTime?

  nonBillable         Boolean              @default(false)
  nonBillableReason   String?

  lastContactDate     DateTime?
  nextContactDate     DateTime?
  contactNote         String?

  @@index([code])
  @@index([processFlow, commercialStage])
  @@index([financialStage])
}
```

`workflowType` del prototipo (`requirement`/`emergency`/`preventive`) **no
suma columna nueva** — mapea 1:1 sobre el `type: JobType` que ya existe
(`requerimiento`/`emergencia`/`preventivo`, más `proyecto`/`otro` que el
prototipo no usa pero el schema ya soporta). Los campos
`billingRule`/`billingMode`/`billingPlan`/`billingReadiness`/`billingSchedule`
del prototipo **tampoco se agregan**: en los 286 registros reales están
vacíos en el 100% de los casos (se calculan al vuelo en el HTML, no hay dato
real que migrar) — igual que `MANDATORY_DOC_TYPES` en este mismo proyecto,
se recalculan en TypeScript cuando la UI los necesite, no se persisten sin
un caso de uso real detrás. Si en el futuro aparece facturación por cuotas
real, se agrega entonces.

### Derivación hacia `status` / `collectionStatus`

`src/lib/cashflow/derive-legacy-status.ts` (nuevo, funciones puras):

```ts
function deriveJobStatus(operationalStage: OperationalStage): JobStatus
function deriveCollectionStatus(financialStage: FinancialStage): CollectionStatus
```

Mapeo directo (`executed`/`client_review`→`ejecutado`, `closed`→`ejecutado`
salvo `nonBillable`→`anulado`; `no_po`/`po_requested`/`po_received`→`sin_oc`,
`to_invoice`/`invoiced`/`overdue`→`pendiente_pago`, `paid`→`pagado`). Se
llaman desde toda acción que escriba `operationalStage`/`financialStage`
(server actions nuevas de sub-proyecto 3, y el script de reconciliación de
sub-proyecto 2), nunca se dejan desincronizados manualmente.

### El código legible (`code`)

Seguimos el esquema que el propio prototipo ya usa de forma consistente
para el 100% de sus 286 registros:

- **Trabajos nuevos**: `YYMMDD-CLI-TT-NN` — fecha de solicitud, código de
  cliente de 3 letras (`JBU`, `DEC`, `UTY`, `TAR`, `PAN`, `JLL` — normalizado
  a 3 letras siempre, el archivo trae algunos de 2 y otros de 3, se pareja
  en la importación), tipo de trabajo en 2 letras (`RQ` requerimiento, `EM`
  emergencia, `PR` preventivo, `PY` proyecto), correlativo del día.
- **Trabajos importados en bloque** (histórico sin fecha de solicitud
  confiable): `IMP-CLI-NNNN`, correlativo simple por cliente.

`code` es independiente del `id` (cuid, sigue siendo la PK real) y del
`jobNumber` legacy (entero, se mantiene igual, sin relación con este
esquema). Se genera en el server action de creación (sub-proyecto 3) y en
el script de importación (sub-proyecto 2); nunca se edita a mano una vez
creado.

## Fuera de alcance de este sub-proyecto

- Ejecutar la migración contra Turso producción — eso ocurre en el mismo
  turno que el sub-proyecto 2 (reconciliación), con confirmación explícita,
  igual que toda migración de este proyecto (regla no negociable de
  `CLAUDE.md`).
- Las Server Actions/UI que escriben estos campos nuevos — sub-proyecto 3.
- El script de importación/reconciliación en sí — sub-proyecto 2.
