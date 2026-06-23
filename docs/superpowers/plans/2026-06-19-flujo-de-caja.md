# Flujo de Caja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-client cash-flow module for INGEGAR: migrate the Just Burger 2026 Excel into the DB, administer/feed jobs + costs + branches from the app, and surface collection and margin indicators filterable by client.

**Architecture:** New Prisma models (`Branch`, `Job`, `JobCost`) hanging off the existing `Client`, all tenant-scoped. Pure, tested functions for normalization (`src/lib/cashflow/normalize.ts`) and metrics (`src/lib/cashflow/metrics.ts`). An idempotent `exceljs` import script loads history. UI under `/flujo` mirrors the existing Recursos/Cotizador patterns (server components + `'use server'` actions + Zod).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5.9, Prisma 7 (SQLite/Turso via adapter), Zod 4, exceljs (dev, import only), node:test + tsx (unit), Playwright (e2e).

## Global Constraints

- UI in Spanish, code/identifiers in English.
- Commits: English, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- Prisma client is imported ONLY from `src/lib/prisma.ts`. After schema changes, restart the dev server (client cached in `globalThis`).
- All reads/writes are tenant-scoped via `tenantScope(session.user)` from `src/lib/tenant.ts`; the actor's `tenantId` is taken from the session.
- Money is stored as integer CLP (no decimals).
- Enums follow the existing schema style (the project already uses Prisma enums with SQLite: `Role`, `AssetStatus`, `AssignmentStatus`, `AssigneeRole`).
- Branding: amber `#f5b100` (`bg-brand`/`text-brand`), `text-ink`, Inter, SVG icons, `cursor-pointer`, focus-visible, empty states.
- Migration target numbers (verification): **205 jobs**, **net total $73.135.006**.
- Unit test runner: `node --import tsx --test "tests/unit/*.test.ts"` (script `npm run test:unit`).

---

### Task 1: Prisma schema — Branch, Job, JobCost, enums

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `CLAUDE.md` (document the new module — fold into this task's commit)

**Interfaces:**
- Produces: Prisma models `Branch`, `Job`, `JobCost` and enums `JobType` (`requerimiento|emergencia|preventivo|proyecto|otro`), `JobStatus` (`pendiente|en_proceso|ejecutado|anulado`), `CollectionStatus` (`sin_oc|pendiente_pago|pagado`), `CostCategory` (`materiales|mano_obra|subcontrato|transporte|otros`). `Client` gains inverse relations `branches Branch[]` and `jobs Job[]`.

- [ ] **Step 1: Inspect the existing `Client` model and an existing enum**

Run: `grep -n "model Client" -A 20 prisma/schema.prisma` and `grep -n "enum AssetStatus" -A 8 prisma/schema.prisma`
Expected: see `Client`'s fields and confirm enum syntax used in this repo. Note the exact relation style (`@relation`, `onDelete`).

- [ ] **Step 2: Add the enums and models to `prisma/schema.prisma`**

Append at the end of the file:

```prisma
enum JobType {
  requerimiento
  emergencia
  preventivo
  proyecto
  otro
}

enum JobStatus {
  pendiente
  en_proceso
  ejecutado
  anulado
}

enum CollectionStatus {
  sin_oc
  pendiente_pago
  pagado
}

enum CostCategory {
  materiales
  mano_obra
  subcontrato
  transporte
  otros
}

model Branch {
  id        String   @id @default(cuid())
  tenantId  String
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  name      String
  active    Boolean  @default(true)
  jobs      Job[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([clientId, name])
  @@index([tenantId])
}

model Job {
  id                String           @id @default(cuid())
  tenantId          String
  clientId          String
  client            Client           @relation(fields: [clientId], references: [id])
  branchId          String
  branch            Branch           @relation(fields: [branchId], references: [id])

  costCenter        String?
  jobNumber         Int?
  importRef         String?          @unique
  quoteRef          String?
  hasTechReport     Boolean          @default(false)
  reportId          String?
  description       String
  type              JobType          @default(requerimiento)
  status            JobStatus        @default(ejecutado)
  executionDate     DateTime?
  technicianId      String?
  notes             String?
  extraNotes        String?

  currency          String           @default("CLP")
  netAmount         Int?
  taxAmount         Int?

  purchaseOrder     String?
  purchaseOrderDate DateTime?
  invoiceNumber     String?
  invoiceDate       DateTime?
  creditDays        Int?
  paymentMethodRaw  String?
  collectionStatus  CollectionStatus @default(sin_oc)
  paymentDate       DateTime?

  costs             JobCost[]
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  @@index([tenantId, clientId])
  @@index([branchId])
}

model JobCost {
  id          String       @id @default(cuid())
  jobId       String
  job         Job          @relation(fields: [jobId], references: [id], onDelete: Cascade)
  category    CostCategory @default(materiales)
  description String?
  amount      Int
  date        DateTime?
  supplier    String?
  documentRef String?
  createdAt   DateTime     @default(now())

  @@index([jobId])
}
```

- [ ] **Step 3: Add inverse relations to the `Client` model**

Inside the existing `model Client { ... }`, add these two lines alongside its other fields:

```prisma
  branches Branch[]
  jobs     Job[]
```

- [ ] **Step 4: Validate the schema**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀"

- [ ] **Step 5: Create and apply the migration**

Run: `npm run db:migrate -- --name cashflow_module`
Expected: migration created under `prisma/migrations/`, applied, and "Generated Prisma Client". If it prompts for a name non-interactively, the `--name` flag covers it.

- [ ] **Step 6: Smoke-check the generated client**

Run: `node --import tsx -e "import {prisma} from './src/lib/prisma'; (async()=>{console.log(typeof prisma.job.findMany, typeof prisma.branch.findMany, typeof prisma.jobCost.findMany); process.exit(0)})()"`
Expected: `function function function`

- [ ] **Step 7: Document the module in CLAUDE.md**

Add a short `### Módulo Flujo de Caja` section under the other module sections describing: models (`Branch`/`Job`/`JobCost`), tenant + client scoping, `/flujo` route, and that history is loaded via `scripts/import-flujo.ts`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations CLAUDE.md
git commit -m "feat(cashflow): Branch/Job/JobCost Prisma models + enums"
```

---

### Task 2: Labels, dates, and Zod schemas

**Files:**
- Create: `src/lib/cashflow/labels.ts`
- Create: `src/lib/cashflow/dates.ts`
- Create: `src/lib/cashflow/schemas.ts`
- Test: `tests/unit/cashflow-schemas.test.ts`

**Interfaces:**
- Produces: `JOB_TYPE_LABELS`, `JOB_STATUS_LABELS`, `COLLECTION_LABELS`, `COLLECTION_COLORS`, `COST_CATEGORY_LABELS` (all `Record<string,string>`); `toDateInput(d: Date|null|undefined): string` and `fromDateInput(s: string|null|undefined): Date|null`; Zod schemas `branchInput`, `jobInput`, `jobCostInput` with inferred types `BranchInput`, `JobInput`, `JobCostInput`.

- [ ] **Step 1: Write labels**

Create `src/lib/cashflow/labels.ts`:

```ts
export const JOB_TYPE_LABELS: Record<string, string> = {
  requerimiento: 'Requerimiento',
  emergencia: 'Emergencia',
  preventivo: 'Preventivo',
  proyecto: 'Proyecto',
  otro: 'Otro',
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  ejecutado: 'Ejecutado',
  anulado: 'Anulado',
}

export const COLLECTION_LABELS: Record<string, string> = {
  sin_oc: 'Sin OC',
  pendiente_pago: 'Pendiente pago',
  pagado: 'Pagado',
}

// Tailwind classes for status chips.
export const COLLECTION_COLORS: Record<string, string> = {
  sin_oc: 'bg-gray-100 text-gray-600',
  pendiente_pago: 'bg-amber-100 text-amber-700',
  pagado: 'bg-green-100 text-green-700',
}

export const COST_CATEGORY_LABELS: Record<string, string> = {
  materiales: 'Materiales',
  mano_obra: 'Mano de obra',
  subcontrato: 'Subcontrato',
  transporte: 'Transporte',
  otros: 'Otros',
}
```

- [ ] **Step 2: Write date helpers**

Create `src/lib/cashflow/dates.ts`:

```ts
// Helpers for <input type="date"> (value = "YYYY-MM-DD"), UTC-safe.
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

export function fromDateInput(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}
```

- [ ] **Step 3: Write Zod schemas**

Create `src/lib/cashflow/schemas.ts`:

```ts
import { z } from 'zod'

const jobTypes = ['requerimiento', 'emergencia', 'preventivo', 'proyecto', 'otro'] as const
const jobStatuses = ['pendiente', 'en_proceso', 'ejecutado', 'anulado'] as const
const collectionStatuses = ['sin_oc', 'pendiente_pago', 'pagado'] as const
const costCategories = ['materiales', 'mano_obra', 'subcontrato', 'transporte', 'otros'] as const

export const branchInput = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1, 'El nombre es obligatorio'),
  active: z.boolean().default(true),
})

export const jobInput = z.object({
  clientId: z.string().min(1),
  branchId: z.string().min(1, 'La sucursal es obligatoria'),
  description: z.string().min(1, 'La descripción es obligatoria'),
  type: z.enum(jobTypes).default('requerimiento'),
  status: z.enum(jobStatuses).default('ejecutado'),
  executionDate: z.string().optional(),
  costCenter: z.string().optional(),
  jobNumber: z.coerce.number().int().optional(),
  quoteRef: z.string().optional(),
  hasTechReport: z.coerce.boolean().default(false), // checkbox: absent key must default to false
  technicianId: z.string().optional(),
  notes: z.string().optional(),
  extraNotes: z.string().optional(),
  netAmount: z.coerce.number().int().nonnegative().optional(),
  taxAmount: z.coerce.number().int().nonnegative().optional(),
  purchaseOrder: z.string().optional(),
  purchaseOrderDate: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  creditDays: z.coerce.number().int().nonnegative().optional(),
  paymentMethodRaw: z.string().optional(),
  collectionStatus: z.enum(collectionStatuses).default('sin_oc'),
  paymentDate: z.string().optional(),
})

export const jobCostInput = z.object({
  jobId: z.string().min(1),
  category: z.enum(costCategories).default('materiales'),
  description: z.string().optional(),
  amount: z.coerce.number().int().nonnegative(),
  date: z.string().optional(),
  supplier: z.string().optional(),
  documentRef: z.string().optional(),
})

export type BranchInput = z.infer<typeof branchInput>
export type JobInput = z.infer<typeof jobInput>
export type JobCostInput = z.infer<typeof jobCostInput>
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/cashflow-schemas.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jobInput, jobCostInput } from '../../src/lib/cashflow/schemas'
import { toDateInput, fromDateInput } from '../../src/lib/cashflow/dates'

test('jobInput: requires description + branchId, coerces numbers', () => {
  const ok = jobInput.safeParse({ clientId: 'c1', branchId: 'b1', description: 'X', netAmount: '80000' })
  assert.ok(ok.success)
  assert.equal(ok.data.netAmount, 80000)
  assert.equal(ok.data.collectionStatus, 'sin_oc')
})

test('jobInput: rejects empty description', () => {
  const bad = jobInput.safeParse({ clientId: 'c1', branchId: 'b1', description: '' })
  assert.equal(bad.success, false)
})

test('jobCostInput: coerces amount', () => {
  const ok = jobCostInput.safeParse({ jobId: 'j1', amount: '15000' })
  assert.ok(ok.success)
  assert.equal(ok.data.amount, 15000)
})

test('date helpers round-trip', () => {
  assert.equal(toDateInput(new Date('2026-04-01T00:00:00.000Z')), '2026-04-01')
  assert.equal(fromDateInput('2026-04-01')?.toISOString(), '2026-04-01T00:00:00.000Z')
  assert.equal(fromDateInput(''), null)
})
```

- [ ] **Step 5: Run the test (fail then pass)**

Run: `node --import tsx --test tests/unit/cashflow-schemas.test.ts`
Expected: all 4 tests PASS (files already written in steps 1–3). If a path is wrong, fix it.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cashflow/labels.ts src/lib/cashflow/dates.ts src/lib/cashflow/schemas.ts tests/unit/cashflow-schemas.test.ts
git commit -m "feat(cashflow): labels, date helpers, Zod input schemas"
```

---

### Task 3: Normalization helpers (Excel → model)

**Files:**
- Create: `src/lib/cashflow/normalize.ts`
- Test: `tests/unit/cashflow-normalize.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `parseMoneyCLP(v: unknown): number | null` — `"$80.000"`/`"$15.200,00"`/`80000` → `80000`.
  - `parseCreditDays(v: unknown): number | null` — `"30 días"` → `30`; `"2 CUOTAS"` → `null`.
  - `normalizeType(v: unknown): 'requerimiento'|'emergencia'|'preventivo'|'proyecto'|'otro'`.
  - `normalizeCollectionStatus(v: unknown): 'sin_oc'|'pendiente_pago'|'pagado'`.
  - `normalizeBranchName(v: unknown): string | null` — trim/collapse/case + alias map.
  - `BRANCH_ALIASES: Record<string,string>` (lowercased key → canonical name).

- [ ] **Step 1: Write the implementation**

Create `src/lib/cashflow/normalize.ts`:

```ts
// Pure helpers to homologate the Excel cash-flow data into the DB model.

export function parseMoneyCLP(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Math.round(v)
  // "$15.200,00" → strip currency + thousands dots, drop decimal part.
  const s = String(v).trim().replace(/[^\d,.-]/g, '')
  if (!s) return null
  const noThousands = s.replace(/\./g, '')
  const intPart = noThousands.split(',')[0]
  const n = Number(intPart)
  return Number.isFinite(n) ? n : null
}

export function parseCreditDays(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Math.round(v)
  const m = String(v).match(/(\d+)\s*d/i) // "30 días"
  return m ? Number(m[1]) : null
}

export function normalizeType(
  v: unknown,
): 'requerimiento' | 'emergencia' | 'preventivo' | 'proyecto' | 'otro' {
  const s = String(v ?? '').trim().toLowerCase()
  if (s.includes('emerg')) return 'emergencia'
  if (s.includes('prevent')) return 'preventivo' // incl. "Término preventivo"
  if (s.includes('requer')) return 'requerimiento'
  if (s.includes('proyecto')) return 'proyecto'
  return 'otro'
}

export function normalizeCollectionStatus(
  v: unknown,
): 'sin_oc' | 'pendiente_pago' | 'pagado' {
  const s = String(v ?? '').trim().toUpperCase()
  if (s === 'PAGADO') return 'pagado'
  if (s.startsWith('PENDIENTE')) return 'pendiente_pago'
  return 'sin_oc' // "SIN OC" or empty
}

// Lowercased raw → canonical branch name. All redundant variants merged.
export const BRANCH_ALIASES: Record<string, string> = {
  'huechurana': 'Huechuraba',
  'rotonda': 'Rotonda Atenas',
  'viña': 'Viña del Mar',
  'viña del mar': 'Viña del Mar',
  'quilin': 'Quilín',
  'quilín': 'Quilín',
  'dk la florida': 'La Florida',
  'dk lo barnechea': 'Lo Barnechea',
  'dk lo barnechea ': 'Lo Barnechea',
}

export function normalizeBranchName(v: unknown): string | null {
  if (v == null) return null
  const collapsed = String(v).trim().replace(/\s+/g, ' ')
  if (!collapsed) return null
  const key = collapsed.toLowerCase()
  if (BRANCH_ALIASES[key]) return BRANCH_ALIASES[key]
  // Title-case fallback (handles "ISIDORA", "isidora ", "Manuel Montt").
  return collapsed
    .toLowerCase()
    .replace(/\b([a-záéíóúñ])/g, (c) => c.toUpperCase())
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/cashflow-normalize.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMoneyCLP,
  parseCreditDays,
  normalizeType,
  normalizeCollectionStatus,
  normalizeBranchName,
} from '../../src/lib/cashflow/normalize'

test('parseMoneyCLP', () => {
  assert.equal(parseMoneyCLP('$80.000'), 80000)
  assert.equal(parseMoneyCLP('$15.200,00'), 15200)
  assert.equal(parseMoneyCLP(95200), 95200)
  assert.equal(parseMoneyCLP(''), null)
  assert.equal(parseMoneyCLP(null), null)
})

test('parseCreditDays', () => {
  assert.equal(parseCreditDays('30 días'), 30)
  assert.equal(parseCreditDays('2 CUOTAS'), null)
  assert.equal(parseCreditDays(45), 45)
})

test('normalizeType', () => {
  assert.equal(normalizeType('Emergencia'), 'emergencia')
  assert.equal(normalizeType('Término preventivo'), 'preventivo')
  assert.equal(normalizeType('Requerimiento'), 'requerimiento')
  assert.equal(normalizeType('algo raro'), 'otro')
})

test('normalizeCollectionStatus', () => {
  assert.equal(normalizeCollectionStatus('PAGADO'), 'pagado')
  assert.equal(normalizeCollectionStatus('PENDIENTE PAGO'), 'pendiente_pago')
  assert.equal(normalizeCollectionStatus('SIN OC'), 'sin_oc')
  assert.equal(normalizeCollectionStatus(''), 'sin_oc')
})

test('normalizeBranchName merges redundant variants', () => {
  assert.equal(normalizeBranchName('Isidora '), 'Isidora')
  assert.equal(normalizeBranchName('QuilíN'), 'Quilín')
  assert.equal(normalizeBranchName('Quilin'), 'Quilín')
  assert.equal(normalizeBranchName('Huechurana'), 'Huechuraba')
  assert.equal(normalizeBranchName('Rotonda'), 'Rotonda Atenas')
  assert.equal(normalizeBranchName('Dk La Florida'), 'La Florida')
  assert.equal(normalizeBranchName('Dk Lo Barnechea'), 'Lo Barnechea')
  assert.equal(normalizeBranchName('ViñA'), 'Viña del Mar')
})
```

- [ ] **Step 3: Run the test**

Run: `node --import tsx --test tests/unit/cashflow-normalize.test.ts`
Expected: all PASS. If "Rotonda Atenas" raw also exists it must title-case to itself — verify `normalizeBranchName('Rotonda Atenas') === 'Rotonda Atenas'` mentally; it does (no alias key, title-cased).

- [ ] **Step 4: Commit**

```bash
git add src/lib/cashflow/normalize.ts tests/unit/cashflow-normalize.test.ts
git commit -m "feat(cashflow): Excel normalization helpers (money, credit days, branch alias)"
```

---

### Task 4: Metrics (pure, the control layer)

**Files:**
- Create: `src/lib/cashflow/metrics.ts`
- Test: `tests/unit/cashflow-metrics.test.ts`

**Interfaces:**
- Consumes: nothing (operates on plain objects, not Prisma).
- Produces:
  - Type `JobLike = { netAmount: number|null; taxAmount: number|null; collectionStatus: 'sin_oc'|'pendiente_pago'|'pagado'; executionDate: Date|null; invoiceDate: Date|null; paymentDate: Date|null; creditDays: number|null; type: string; branchId: string; technicianId: string|null; clientId: string; costs: { amount: number }[] }`.
  - `jobTotal(j): number` = `(netAmount??0) + (taxAmount ?? round(netAmount*0.19))`.
  - `jobDueDate(j): Date|null` = `invoiceDate + creditDays` days.
  - `jobIsOverdue(j, now): boolean`.
  - `jobMargin(j): { margin: number|null; marginPct: number|null }`.
  - `computeMetrics(jobs: JobLike[], now: Date): CashflowMetrics` where `CashflowMetrics = { facturado: number; porCobrar: number; cobrado: number; vencido: number; sinOcBacklog: number; sinOcCount: number; avgCollectionDays: number|null; avgBillingLagDays: number|null; aging: { bucket: '0-30'|'31-60'|'60+'; amount: number }[]; marginTotal: number|null; mix: { type: string; count: number; amount: number }[] }`.

- [ ] **Step 1: Write the implementation**

Create `src/lib/cashflow/metrics.ts`:

```ts
export type JobLike = {
  netAmount: number | null
  taxAmount: number | null
  collectionStatus: 'sin_oc' | 'pendiente_pago' | 'pagado'
  executionDate: Date | null
  invoiceDate: Date | null
  paymentDate: Date | null
  creditDays: number | null
  type: string
  branchId: string
  technicianId: string | null
  clientId: string
  costs: { amount: number }[]
}

const DAY = 24 * 60 * 60 * 1000
const net = (j: JobLike) => j.netAmount ?? 0
const tax = (j: JobLike) => j.taxAmount ?? Math.round((j.netAmount ?? 0) * 0.19)

export function jobTotal(j: JobLike): number {
  return net(j) + tax(j)
}

export function jobDueDate(j: JobLike): Date | null {
  if (!j.invoiceDate || j.creditDays == null) return null
  return new Date(j.invoiceDate.getTime() + j.creditDays * DAY)
}

export function jobIsOverdue(j: JobLike, now: Date): boolean {
  if (j.collectionStatus !== 'pendiente_pago') return false
  const due = jobDueDate(j)
  return !!due && now.getTime() > due.getTime()
}

export function jobMargin(j: JobLike): { margin: number | null; marginPct: number | null } {
  if (j.netAmount == null) return { margin: null, marginPct: null }
  const cost = j.costs.reduce((s, c) => s + c.amount, 0)
  if (j.costs.length === 0) return { margin: null, marginPct: null }
  const margin = j.netAmount - cost
  return { margin, marginPct: j.netAmount === 0 ? null : margin / j.netAmount }
}

function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / DAY)
}

export type CashflowMetrics = {
  facturado: number
  porCobrar: number
  cobrado: number
  vencido: number
  sinOcBacklog: number
  sinOcCount: number
  avgCollectionDays: number | null
  avgBillingLagDays: number | null
  aging: { bucket: '0-30' | '31-60' | '60+'; amount: number }[]
  marginTotal: number | null
  mix: { type: string; count: number; amount: number }[]
}

export function computeMetrics(jobs: JobLike[], now: Date): CashflowMetrics {
  let facturado = 0,
    porCobrar = 0,
    cobrado = 0,
    vencido = 0,
    sinOcBacklog = 0,
    sinOcCount = 0
  const aging = { '0-30': 0, '31-60': 0, '60+': 0 }
  const collectionDays: number[] = []
  const billingLags: number[] = []
  const mixMap = new Map<string, { count: number; amount: number }>()
  let marginSum = 0
  let marginSeen = false

  for (const j of jobs) {
    const amount = net(j)
    if (j.collectionStatus === 'sin_oc') {
      sinOcBacklog += amount
      sinOcCount++
    } else {
      facturado += amount
      if (j.collectionStatus === 'pendiente_pago') {
        porCobrar += amount
        if (jobIsOverdue(j, now)) vencido += amount
        const ref = j.invoiceDate ?? null
        const age = daysBetween(ref, now)
        if (age != null) {
          if (age <= 30) aging['0-30'] += amount
          else if (age <= 60) aging['31-60'] += amount
          else aging['60+'] += amount
        }
      }
      if (j.collectionStatus === 'pagado') {
        cobrado += amount
        const d = daysBetween(j.invoiceDate, j.paymentDate)
        if (d != null) collectionDays.push(d)
      }
    }
    const lag = daysBetween(j.executionDate, j.invoiceDate)
    if (lag != null && lag >= 0) billingLags.push(lag)

    const m = mixMap.get(j.type) ?? { count: 0, amount: 0 }
    m.count++
    m.amount += amount
    mixMap.set(j.type, m)

    const mg = jobMargin(j)
    if (mg.margin != null) {
      marginSum += mg.margin
      marginSeen = true
    }
  }

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null)

  return {
    facturado,
    porCobrar,
    cobrado,
    vencido,
    sinOcBacklog,
    sinOcCount,
    avgCollectionDays: avg(collectionDays),
    avgBillingLagDays: avg(billingLags),
    aging: [
      { bucket: '0-30', amount: aging['0-30'] },
      { bucket: '31-60', amount: aging['31-60'] },
      { bucket: '60+', amount: aging['60+'] },
    ],
    marginTotal: marginSeen ? marginSum : null,
    mix: [...mixMap.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.amount - a.amount),
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/cashflow-metrics.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMetrics, jobMargin, jobIsOverdue, type JobLike } from '../../src/lib/cashflow/metrics'

const base: JobLike = {
  netAmount: 100000, taxAmount: 19000, collectionStatus: 'sin_oc',
  executionDate: null, invoiceDate: null, paymentDate: null, creditDays: null,
  type: 'requerimiento', branchId: 'b1', technicianId: null, clientId: 'c1', costs: [],
}
const NOW = new Date('2026-06-19T00:00:00.000Z')

test('sin_oc feeds the backlog, not facturado', () => {
  const m = computeMetrics([{ ...base }], NOW)
  assert.equal(m.sinOcBacklog, 100000)
  assert.equal(m.sinOcCount, 1)
  assert.equal(m.facturado, 0)
})

test('pendiente_pago counts as por cobrar; overdue when past due date', () => {
  const j: JobLike = {
    ...base, collectionStatus: 'pendiente_pago',
    invoiceDate: new Date('2026-04-01T00:00:00.000Z'), creditDays: 30,
  }
  assert.equal(jobIsOverdue(j, NOW), true)
  const m = computeMetrics([j], NOW)
  assert.equal(m.porCobrar, 100000)
  assert.equal(m.vencido, 100000)
  assert.equal(m.aging.find((a) => a.bucket === '60+')!.amount, 100000)
})

test('pagado counts as cobrado and feeds avg collection days', () => {
  const j: JobLike = {
    ...base, collectionStatus: 'pagado',
    invoiceDate: new Date('2026-04-01T00:00:00.000Z'),
    paymentDate: new Date('2026-05-01T00:00:00.000Z'),
  }
  const m = computeMetrics([j], NOW)
  assert.equal(m.cobrado, 100000)
  assert.equal(m.avgCollectionDays, 30)
})

test('margin only when costs exist', () => {
  assert.deepEqual(jobMargin({ ...base }), { margin: null, marginPct: null })
  const withCost = jobMargin({ ...base, costs: [{ amount: 40000 }] })
  assert.equal(withCost.margin, 60000)
  assert.equal(Math.round(withCost.marginPct! * 100), 60)
})

test('mix aggregates by type', () => {
  const m = computeMetrics(
    [{ ...base, type: 'emergencia' }, { ...base, type: 'emergencia' }, { ...base, type: 'preventivo' }],
    NOW,
  )
  assert.equal(m.mix.find((x) => x.type === 'emergencia')!.count, 2)
})
```

- [ ] **Step 3: Run the test**

Run: `node --import tsx --test tests/unit/cashflow-metrics.test.ts`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cashflow/metrics.ts tests/unit/cashflow-metrics.test.ts
git commit -m "feat(cashflow): pure metrics (collection, aging, SIN OC backlog, margin, mix)"
```

---

### Task 5: Import script + CSV consolidation

**Files:**
- Create: `scripts/import-flujo.ts`
- Modify: `package.json` (add `exceljs` to `devDependencies` and an `import:flujo` script)
- Output (gitignored): `design-reference/flujo-consolidado.csv`

**Interfaces:**
- Consumes: `parseMoneyCLP`, `parseCreditDays`, `normalizeType`, `normalizeCollectionStatus`, `normalizeBranchName` (Task 3); `prisma` from `src/lib/prisma`.
- Produces: rows in `Branch`/`Job` for client "Just Burger"; a console summary with job count + net total; the CSV file.

- [ ] **Step 1: Add exceljs as a dev dependency**

Run: `npm install --save-dev exceljs`
Expected: `exceljs` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Add the npm script**

In `package.json` `"scripts"`, add:

```json
"import:flujo": "node --import tsx scripts/import-flujo.ts"
```

- [ ] **Step 3: Write the import script**

Create `scripts/import-flujo.ts`:

```ts
import { writeFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { prisma } from '../src/lib/prisma'
import {
  parseMoneyCLP,
  parseCreditDays,
  normalizeType,
  normalizeCollectionStatus,
  normalizeBranchName,
} from '../src/lib/cashflow/normalize'

const FILE = 'design-reference/Flujo de Caja Just Burger General 2026.xlsx'
const TENANT_SLUG = 'ingegar' // jobs are owned by the INGEGAR tenant
const CLIENT_NAME = 'Just Burger'

const cell = (row: ExcelJS.Row, i: number): unknown => {
  const v = row.values[i] as unknown
  if (v == null) return null
  if (typeof v === 'object') {
    const o = v as { result?: unknown; text?: unknown }
    return o.result ?? o.text ?? null
  }
  return v
}
const asDate = (v: unknown): Date | null => (v instanceof Date ? v : null)
const str = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} no existe (corre db:seed)`)

  // Ensure the client exists (tenant-scoped).
  let client = await prisma.client.findFirst({ where: { tenantId: tenant.id, name: CLIENT_NAME } })
  if (!client) {
    client = await prisma.client.create({ data: { tenantId: tenant.id, name: CLIENT_NAME } })
  }

  const branchCache = new Map<string, string>() // name -> id
  async function branchId(name: string): Promise<string> {
    if (branchCache.has(name)) return branchCache.get(name)!
    const b = await prisma.branch.upsert({
      where: { clientId_name: { clientId: client!.id, name } },
      update: {},
      create: { tenantId: tenant!.id, clientId: client!.id, name },
    })
    branchCache.set(name, b.id)
    return b.id
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(FILE)

  const csvRows: string[] = [
    'importRef,branch,type,description,executionDate,netAmount,taxAmount,collectionStatus,invoiceNumber,invoiceDate,creditDays',
  ]
  let count = 0
  let netSum = 0

  for (const ws of wb.worksheets) {
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const description = str(cell(row, 6))
      const rawBranch = cell(row, 5)
      const netAmount = parseMoneyCLP(cell(row, 16))
      if (!description && netAmount == null) continue // empty row

      const branchName = normalizeBranchName(rawBranch) ?? 'Sin sucursal'
      const bId = await branchId(branchName)
      const importRef = `flujo2026#${ws.name}#${r}`
      const taxAmount = parseMoneyCLP(cell(row, 17))
      const collectionStatus = normalizeCollectionStatus(cell(row, 24))
      const invoiceDate = asDate(cell(row, 22))
      const data = {
        tenantId: tenant.id,
        clientId: client.id,
        branchId: bId,
        costCenter: str(cell(row, 1)),
        jobNumber: typeof cell(row, 2) === 'number' ? (cell(row, 2) as number) : null,
        quoteRef: str(cell(row, 4)),
        hasTechReport: String(cell(row, 3) ?? '').trim().toUpperCase() === 'SI',
        description: description ?? '(sin descripción)',
        type: normalizeType(cell(row, 13)),
        status: 'ejecutado' as const,
        executionDate: asDate(cell(row, 9)),
        notes: str(cell(row, 12)),
        extraNotes: str(cell(row, 15)),
        netAmount,
        taxAmount: taxAmount ?? (netAmount != null ? Math.round(netAmount * 0.19) : null),
        purchaseOrder: str(cell(row, 19)),
        purchaseOrderDate: asDate(cell(row, 20)),
        invoiceNumber: str(cell(row, 21)),
        invoiceDate,
        creditDays: parseCreditDays(cell(row, 23)),
        paymentMethodRaw: str(cell(row, 23)),
        collectionStatus,
        paymentDate: asDate(cell(row, 25)),
      }

      await prisma.job.upsert({ where: { importRef }, update: data, create: { ...data, importRef } })
      count++
      netSum += netAmount ?? 0
      csvRows.push(
        [importRef, branchName, data.type, JSON.stringify(description ?? ''), data.executionDate?.toISOString().slice(0, 10) ?? '',
          netAmount ?? '', data.taxAmount ?? '', collectionStatus, data.invoiceNumber ?? '',
          invoiceDate?.toISOString().slice(0, 10) ?? '', data.creditDays ?? ''].join(','),
      )
    }
  }

  await writeFile('design-reference/flujo-consolidado.csv', csvRows.join('\n'), 'utf8')
  console.log(`Importados ${count} trabajos. Neto total: $${netSum.toLocaleString('es-CL')}`)
  console.log(`Sucursales: ${branchCache.size}. CSV: design-reference/flujo-consolidado.csv`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
```

- [ ] **Step 4: Gitignore the CSV artifact**

Append to `.gitignore`:

```
design-reference/flujo-consolidado.csv
```

- [ ] **Step 5: Run the import and verify the numbers**

Run: `npm run import:flujo`
Expected: `Importados 205 trabajos. Neto total: $73.135.006` (±, if a stray empty row differs, investigate but small deltas from blank rows are acceptable). `Sucursales: 14` (±1).

- [ ] **Step 6: Re-run to confirm idempotency**

Run: `npm run import:flujo` again, then
Run: `node --import tsx -e "import {prisma} from './src/lib/prisma'; (async()=>{console.log('jobs', await prisma.job.count()); process.exit(0)})()"`
Expected: `jobs 205` (NOT 410 — upsert on `importRef` prevented duplicates).

- [ ] **Step 7: Commit**

```bash
git add scripts/import-flujo.ts package.json package-lock.json .gitignore
git commit -m "feat(cashflow): idempotent Excel import script (205 jobs) + consolidated CSV"
```

---

### Task 6: Scoped queries

**Files:**
- Create: `src/lib/cashflow/queries.ts`

**Interfaces:**
- Consumes: `prisma`, `tenantScope` from `src/lib/tenant.ts`, `JobLike` shape from metrics.
- Produces:
  - `listClientsForCashflow(actor)` → `{ id, name }[]` (clients that have ≥1 job, scoped).
  - `listJobs(actor, { clientId?, from?, to? })` → jobs with `branch` + `costs` included, scoped, ordered by `executionDate desc`.
  - `getJob(actor, id)` → single job with `branch`, `client`, `costs`.
  - `listBranches(actor, clientId)` → branches for a client, scoped.

- [ ] **Step 1: Inspect `tenantScope`**

Run: `cat src/lib/tenant.ts`
Expected: confirm `tenantScope(actor)` returns a Prisma `where` fragment and the actor shape (`{ role, tenantId }`).

- [ ] **Step 2: Write the queries**

Create `src/lib/cashflow/queries.ts`:

```ts
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'

type Actor = Parameters<typeof tenantScope>[0]

export async function listClientsForCashflow(actor: Actor) {
  const rows = await prisma.client.findMany({
    where: { ...tenantScope(actor), jobs: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return rows
}

export async function listJobs(
  actor: Actor,
  opts: { clientId?: string; from?: Date; to?: Date } = {},
) {
  return prisma.job.findMany({
    where: {
      ...tenantScope(actor),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.from || opts.to
        ? { executionDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
        : {}),
    },
    include: { branch: true, costs: true },
    orderBy: [{ executionDate: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getJob(actor: Actor, id: string) {
  return prisma.job.findFirst({
    where: { id, ...tenantScope(actor) },
    include: { branch: true, client: true, costs: { orderBy: { createdAt: 'desc' } } },
  })
}

export async function listBranches(actor: Actor, clientId: string) {
  return prisma.branch.findMany({
    where: { ...tenantScope(actor), clientId },
    orderBy: { name: 'asc' },
  })
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `tenantScope`'s actor type differs, adjust the `Actor` alias to match.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cashflow/queries.ts
git commit -m "feat(cashflow): tenant-scoped queries with client + period filters"
```

---

### Task 7: Server actions (CRUD)

**Files:**
- Create: `src/app/(app)/flujo/actions.ts`

**Interfaces:**
- Consumes: `auth` from `src/auth`, `prisma`, Zod schemas from Task 2, `tenantScope`.
- Produces server actions: `createBranch`, `updateBranch`, `deleteBranch`, `createJob`, `updateJob`, `deleteJob`, `addCost`, `deleteCost`. Each reads the session, validates with Zod, writes scoped, and `revalidatePath('/flujo')` (+ the relevant subpath).

- [ ] **Step 1: Inspect an existing actions file for the exact pattern**

Run: `cat "src/app/(app)/recursos/clientes/actions.ts"`
Expected: see how the repo reads `auth()`, derives `tenantId`, parses `FormData`, validates with Zod, writes via `prisma`, calls `revalidatePath`, and `redirect`. Mirror it precisely (error handling, return shape).

- [ ] **Step 2: Write the actions**

Create `src/app/(app)/flujo/actions.ts` following that pattern. Full content:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { branchInput, jobInput, jobCostInput } from '@/lib/cashflow/schemas'
import { fromDateInput } from '@/lib/cashflow/dates'

async function actor() {
  const session = await auth()
  if (!session?.user) throw new Error('No autorizado')
  return session.user
}

function jobData(p: ReturnType<typeof jobInput.parse>) {
  return {
    branchId: p.branchId,
    description: p.description,
    type: p.type,
    status: p.status,
    executionDate: fromDateInput(p.executionDate),
    costCenter: p.costCenter ?? null,
    jobNumber: p.jobNumber ?? null,
    quoteRef: p.quoteRef ?? null,
    hasTechReport: p.hasTechReport,
    technicianId: p.technicianId || null,
    notes: p.notes ?? null,
    extraNotes: p.extraNotes ?? null,
    netAmount: p.netAmount ?? null,
    taxAmount: p.taxAmount ?? null,
    purchaseOrder: p.purchaseOrder ?? null,
    purchaseOrderDate: fromDateInput(p.purchaseOrderDate),
    invoiceNumber: p.invoiceNumber ?? null,
    invoiceDate: fromDateInput(p.invoiceDate),
    creditDays: p.creditDays ?? null,
    paymentMethodRaw: p.paymentMethodRaw ?? null,
    collectionStatus: p.collectionStatus,
    paymentDate: fromDateInput(p.paymentDate),
  }
}

export async function createBranch(form: FormData) {
  const u = await actor()
  const p = branchInput.parse({
    clientId: form.get('clientId'),
    name: form.get('name'),
    active: form.get('active') === 'on',
  })
  await prisma.branch.create({ data: { tenantId: u.tenantId, clientId: p.clientId, name: p.name, active: p.active } })
  revalidatePath('/flujo/sucursales')
}

export async function updateBranch(id: string, form: FormData) {
  const u = await actor()
  const p = branchInput.parse({ clientId: form.get('clientId'), name: form.get('name'), active: form.get('active') === 'on' })
  await prisma.branch.updateMany({ where: { id, ...tenantScope(u) }, data: { name: p.name, active: p.active } })
  revalidatePath('/flujo/sucursales')
}

export async function deleteBranch(id: string) {
  const u = await actor()
  await prisma.branch.deleteMany({ where: { id, ...tenantScope(u) } })
  revalidatePath('/flujo/sucursales')
}

export async function createJob(form: FormData) {
  const u = await actor()
  const p = jobInput.parse(Object.fromEntries(form))
  await prisma.job.create({ data: { tenantId: u.tenantId, clientId: p.clientId, ...jobData(p) } })
  revalidatePath('/flujo')
  redirect('/flujo/trabajos')
}

export async function updateJob(id: string, form: FormData) {
  const u = await actor()
  const p = jobInput.parse(Object.fromEntries(form))
  await prisma.job.updateMany({ where: { id, ...tenantScope(u) }, data: jobData(p) })
  revalidatePath('/flujo')
  redirect('/flujo/trabajos')
}

export async function deleteJob(id: string) {
  const u = await actor()
  await prisma.job.deleteMany({ where: { id, ...tenantScope(u) } })
  revalidatePath('/flujo')
  redirect('/flujo/trabajos')
}

export async function addCost(form: FormData) {
  await actor()
  const p = jobCostInput.parse(Object.fromEntries(form))
  await prisma.jobCost.create({
    data: {
      jobId: p.jobId,
      category: p.category,
      description: p.description ?? null,
      amount: p.amount,
      date: fromDateInput(p.date),
      supplier: p.supplier ?? null,
      documentRef: p.documentRef ?? null,
    },
  })
  revalidatePath(`/flujo/trabajos/${p.jobId}`)
}

export async function deleteCost(id: string, jobId: string) {
  await actor()
  await prisma.jobCost.delete({ where: { id } })
  revalidatePath(`/flujo/trabajos/${jobId}`)
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `session.user` lacks `tenantId` typing, confirm against `src/types/next-auth.d.ts` (it augments `tenantId`).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/flujo/actions.ts"
git commit -m "feat(cashflow): server actions for branches, jobs, and costs"
```

---

### Task 8: UI primitives — KPI cards + money format

**Files:**
- Create: `src/lib/cashflow/format.ts`
- Create: `src/components/cashflow/kpi-card.tsx`
- Test: `tests/unit/cashflow-format.test.ts`

**Interfaces:**
- Produces: `clp(n: number): string` (e.g. `73135006` → `"$73.135.006"`); `KpiCard` component `{ label: string; value: string; hint?: string; tone?: 'default'|'warn'|'danger'|'good' }`.

- [ ] **Step 1: Write the formatter + test**

Create `src/lib/cashflow/format.ts`:

```ts
const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
export function clp(n: number | null | undefined): string {
  return CLP.format(n ?? 0)
}
export function pct(x: number | null | undefined): string {
  return x == null ? '—' : `${Math.round(x * 100)}%`
}
```

Create `tests/unit/cashflow-format.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clp, pct } from '../../src/lib/cashflow/format'

test('clp formats CLP without decimals', () => {
  assert.equal(clp(73135006).replace(/ /g, ' '), '$73.135.006')
  assert.equal(clp(null).replace(/ /g, ' '), '$0')
})
test('pct', () => {
  assert.equal(pct(0.6), '60%')
  assert.equal(pct(null), '—')
})
```

Run: `node --import tsx --test tests/unit/cashflow-format.test.ts` → PASS.

- [ ] **Step 2: Write the KPI card**

Create `src/components/cashflow/kpi-card.tsx`:

```tsx
const TONES: Record<string, string> = {
  default: 'border-gray-200',
  warn: 'border-amber-300 bg-amber-50',
  danger: 'border-red-300 bg-red-50',
  good: 'border-green-300 bg-green-50',
}

export function KpiCard({
  label, value, hint, tone = 'default',
}: { label: string; value: string; hint?: string; tone?: 'default' | 'warn' | 'danger' | 'good' }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${TONES[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/cashflow/format.ts src/components/cashflow/kpi-card.tsx tests/unit/cashflow-format.test.ts
git commit -m "feat(cashflow): CLP formatter + KPI card component"
```

---

### Task 9: Dashboard page (`/flujo`)

**Files:**
- Create: `src/app/(app)/flujo/page.tsx`
- Create: `src/components/cashflow/client-filter.tsx`

**Interfaces:**
- Consumes: `listClientsForCashflow`, `listJobs` (Task 6), `computeMetrics` (Task 4), `clp`/`pct` (Task 8), `KpiCard` (Task 8), `JOB_TYPE_LABELS` (Task 2).
- Produces: the dashboard server component reading `searchParams.cliente` for the client filter.

- [ ] **Step 1: Write the client filter (client component)**

Create `src/components/cashflow/client-filter.tsx`:

```tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export function ClientFilter({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const sp = useSearchParams()
  const current = sp.get('cliente') ?? ''
  return (
    <select
      aria-label="Filtrar por cliente"
      value={current}
      onChange={(e) => {
        const v = e.target.value
        router.push(v ? `/flujo?cliente=${v}` : '/flujo')
      }}
      className="cursor-pointer rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      <option value="">Todos los clientes</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: Write the dashboard page (server component)**

Create `src/app/(app)/flujo/page.tsx`:

```tsx
import Link from 'next/link'
import { auth } from '@/auth'
import { listClientsForCashflow, listJobs } from '@/lib/cashflow/queries'
import { computeMetrics, type JobLike } from '@/lib/cashflow/metrics'
import { clp } from '@/lib/cashflow/format'
import { KpiCard } from '@/components/cashflow/kpi-card'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { JOB_TYPE_LABELS } from '@/lib/cashflow/labels'

export default async function FlujoPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const session = await auth()
  const actor = session!.user
  const { cliente } = await searchParams

  const [clients, jobs] = await Promise.all([
    listClientsForCashflow(actor),
    listJobs(actor, { clientId: cliente }),
  ])
  const m = computeMetrics(jobs as unknown as JobLike[], new Date())

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Flujo de Caja</h1>
          <p className="mt-1 text-sm text-gray-500">Cobranza y rentabilidad por trabajo.</p>
        </div>
        <div className="flex items-center gap-2">
          <ClientFilter clients={clients} />
          <Link href="/flujo/trabajos" className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-600">
            Ver trabajos
          </Link>
        </div>
      </div>

      {/* A. Caja / cobranza */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Facturado" value={clp(m.facturado)} />
        <KpiCard label="Por cobrar" value={clp(m.porCobrar)} tone="warn" />
        <KpiCard label="Cobrado" value={clp(m.cobrado)} tone="good" />
        <KpiCard label="Vencido" value={clp(m.vencido)} tone="danger" hint={m.avgCollectionDays != null ? `Cobro prom. ${m.avgCollectionDays} días` : undefined} />
      </div>

      {/* B. Palancas de control */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Sin facturar (SIN OC)" value={clp(m.sinOcBacklog)} tone="danger" hint={`${m.sinOcCount} trabajos en riesgo`} />
        <KpiCard label="Lag facturación" value={m.avgBillingLagDays != null ? `${m.avgBillingLagDays} días` : '—'} hint="ejecución → factura" />
        <KpiCard label="Margen total" value={m.marginTotal != null ? clp(m.marginTotal) : '—'} hint={m.marginTotal == null ? 'Carga costos para activar' : undefined} />
        <KpiCard label="Trabajos" value={String(jobs.length)} />
      </div>

      {/* Aging + mix */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Cuentas por cobrar (aging)</h2>
          <ul className="space-y-1.5 text-sm">
            {m.aging.map((a) => (
              <li key={a.bucket} className="flex justify-between"><span className="text-gray-500">{a.bucket} días</span><span className="tabular-nums">{clp(a.amount)}</span></li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Mix por tipo</h2>
          <ul className="space-y-1.5 text-sm">
            {m.mix.map((x) => (
              <li key={x.type} className="flex justify-between"><span className="text-gray-500">{JOB_TYPE_LABELS[x.type] ?? x.type} ({x.count})</span><span className="tabular-nums">{clp(x.amount)}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + manual smoke**

Run: `npm run typecheck` → no errors.
Run dev (`npm run dev`), log in, visit `/flujo`. Expected: KPIs populated from the imported data; "Facturado" + "Sin facturar" sum near $73M; client filter shows "Just Burger".

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/flujo/page.tsx" src/components/cashflow/client-filter.tsx
git commit -m "feat(cashflow): dashboard with collection + control KPIs and client filter"
```

---

### Task 10: Jobs list, detail (with costs), and form

**Files:**
- Create: `src/app/(app)/flujo/trabajos/page.tsx` (list)
- Create: `src/app/(app)/flujo/trabajos/new/page.tsx`
- Create: `src/app/(app)/flujo/trabajos/[id]/page.tsx` (detail + costs)
- Create: `src/components/cashflow/job-form.tsx`
- Create: `src/components/cashflow/cost-list.tsx`
- Create: `src/components/cashflow/collection-chip.tsx`

**Interfaces:**
- Consumes: queries (Task 6), actions (Task 7), labels (Task 2), `clp` (Task 8), metrics helpers `jobTotal`/`jobMargin` (Task 4), `toDateInput` (Task 2).
- Produces: full jobs CRUD UI. Reuse `Field`/`TextInput`/`Select`/`TextArea`/`Button` from `@/components/quotes/ui` and chip styling from `COLLECTION_COLORS`.

- [ ] **Step 1: Inspect an existing list + form for the pattern**

Run: `cat "src/app/(app)/recursos/clientes/page.tsx"` and `cat src/components/resources/client-form.tsx`
Expected: the exact list table styling, the "← atrás" link, and how forms bind a server action (`<form action={createJob}>`, hidden ids, `Field` usage). Mirror it.

- [ ] **Step 2: Write `collection-chip.tsx`**

```tsx
import { COLLECTION_LABELS, COLLECTION_COLORS } from '@/lib/cashflow/labels'
export function CollectionChip({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLLECTION_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {COLLECTION_LABELS[status] ?? status}
    </span>
  )
}
```

- [ ] **Step 3: Write the job form (`job-form.tsx`)**

Client component binding to `createJob`/`updateJob`. Fields grouped: Identificación (clientId hidden or select, branchId select from `branches` prop, description, type select from `JOB_TYPE_LABELS`, status, executionDate, costCenter, jobNumber, quoteRef, hasTechReport checkbox, technicianId optional select from `technicians` prop), Ingreso (netAmount, taxAmount), Cobranza (purchaseOrder, purchaseOrderDate, invoiceNumber, invoiceDate, creditDays, paymentMethodRaw, collectionStatus select from `COLLECTION_LABELS`, paymentDate). Use `toDateInput` for date defaults. Props: `{ action: (fd: FormData) => void; branches: {id,name}[]; technicians: {id,name}[]; clientId: string; initial?: Job }`. Submit button "Guardar trabajo". Reuse `Field`, `TextInput`, `Select`, `TextArea`, `Button` from `@/components/quotes/ui`.

- [ ] **Step 4: Write the cost list (`cost-list.tsx`)**

Client component: a table of `costs` ({category label, description, amount via `clp`, date, supplier}) each with a delete button calling `deleteCost(id, jobId)`; plus an inline add form binding `addCost` (hidden `jobId`, category select from `COST_CATEGORY_LABELS`, description, amount, date, supplier, documentRef). Shows the running margin: `neto − Σ costos` via `clp`.

- [ ] **Step 5: Write the list page (`trabajos/page.tsx`)**

Server component: read `searchParams.cliente`, `listJobs(actor, {clientId})`, render a table: Fecha ejec. · Sucursal · Descripción · Tipo (`JOB_TYPE_LABELS`) · Neto (`clp`) · Estado pago (`<CollectionChip>`). Each row links to `/flujo/trabajos/[id]`. Header has "← Flujo" link and a "Nuevo trabajo" button → `/flujo/trabajos/new`. Empty state when no jobs.

- [ ] **Step 6: Write the new page (`trabajos/new/page.tsx`)**

Server component: load `listBranches` + technicians (reuse existing technician query from Recursos; if none handy, `prisma.technician.findMany({ where: tenantScope(actor) })` mapped to `{id,name}`). Resolve the default `clientId` (first client from `listClientsForCashflow`, or a `?cliente=` param). Render `<JobForm action={createJob} ... />`.

- [ ] **Step 7: Write the detail page (`trabajos/[id]/page.tsx`)**

Server component: `getJob(actor, id)`; if null → `notFound()`. Show header (description, branch, type chip, collection chip), an info grid (costCenter, jobNumber, quoteRef, OC, factura, fechas, creditDays, total via `jobTotal`), the edit form (`<JobForm action={updateJob.bind(null, id)} ... initial={job}/>`), and `<CostList costs={job.costs} jobId={job.id} netAmount={job.netAmount}/>`. Include a delete-job button (`deleteJob.bind(null, id)`).

- [ ] **Step 8: Typecheck + manual smoke**

Run: `npm run typecheck` → no errors.
Dev smoke: open `/flujo/trabajos`, open a job, add a cost → margin appears; edit a job → saved; create a new job → appears in list.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/flujo/trabajos" src/components/cashflow/job-form.tsx src/components/cashflow/cost-list.tsx src/components/cashflow/collection-chip.tsx
git commit -m "feat(cashflow): jobs list/detail/form + per-job costs with live margin"
```

---

### Task 11: Branches CRUD + sidebar link

**Files:**
- Create: `src/app/(app)/flujo/sucursales/page.tsx`
- Create: `src/components/cashflow/branch-form.tsx`
- Modify: `src/components/ui/sidebar.tsx`

**Interfaces:**
- Consumes: `listBranches`, `listClientsForCashflow`, branch actions (Task 7).
- Produces: a branches admin page and the "Flujo de Caja" sidebar entry.

- [ ] **Step 1: Write the branch form**

Create `src/components/cashflow/branch-form.tsx`: client component binding `createBranch`/`updateBranch`. Fields: `clientId` (hidden or select from `clients` prop), `name` (TextInput), `active` (checkbox, default checked). Submit "Guardar sucursal". Reuse quotes `ui` primitives.

- [ ] **Step 2: Write the branches page**

Create `src/app/(app)/flujo/sucursales/page.tsx`: server component. Resolve `clientId` from `?cliente=` or first client. `listBranches(actor, clientId)`. Render a list (name + active chip + delete button via `deleteBranch.bind(null, id)`) and the add form `<BranchForm action={createBranch} clients={clients} clientId={clientId}/>`. Header "← Flujo".

- [ ] **Step 3: Add the sidebar link**

In `src/components/ui/sidebar.tsx`, add to `LINKS` after the Informes entry:

```tsx
  { href: '/flujo', label: 'Flujo de Caja', icon: CashIcon },
```

And add the icon function near the others:

```tsx
function CashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  )
}
```

- [ ] **Step 4: Typecheck + smoke**

Run: `npm run typecheck` → no errors.
Dev smoke: sidebar shows "Flujo de Caja"; `/flujo/sucursales` lists the imported branches; create + delete a branch works.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/flujo/sucursales" src/components/cashflow/branch-form.tsx src/components/ui/sidebar.tsx
git commit -m "feat(cashflow): branches admin + sidebar entry"
```

---

### Task 12: E2E test + full verification

**Files:**
- Create: `tests/e2e/cashflow.spec.ts`

- [ ] **Step 1: Write the e2e test**

Create `tests/e2e/cashflow.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@ingegarchile.cl')
  await page.getByLabel('Contraseña', { exact: true }).fill('ingegar123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('cashflow dashboard shows collection KPIs', async ({ page }) => {
  await login(page)
  await page.goto('/flujo')
  await expect(page.getByRole('heading', { name: 'Flujo de Caja' })).toBeVisible()
  await expect(page.getByText('Facturado')).toBeVisible()
  await expect(page.getByText('Sin facturar (SIN OC)')).toBeVisible()
  await expect(page.getByLabel('Filtrar por cliente')).toBeVisible()
})

test('jobs list is reachable and shows data', async ({ page }) => {
  await login(page)
  await page.goto('/flujo/trabajos')
  await expect(page.getByRole('heading', { name: /Trabajos/i })).toBeVisible()
})

test('branches admin exists', async ({ page }) => {
  await login(page)
  await page.goto('/flujo/sucursales')
  await expect(page.getByRole('heading', { name: /Sucursales/i })).toBeVisible()
})
```

- [ ] **Step 2: Run the full unit suite**

Run: `npm run test:unit`
Expected: all green (existing + new cashflow tests).

- [ ] **Step 3: Run the e2e**

Run: `npm run test:e2e -- cashflow`
Expected: 3 cashflow tests PASS (requires the import to have run so data exists).

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: clean lint, successful production build (new routes `/flujo`, `/flujo/trabajos`, `/flujo/sucursales` listed).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/cashflow.spec.ts
git commit -m "test(cashflow): e2e for dashboard, jobs list, branches admin"
```

---

## Notes for future iterations (out of v1 scope)

- Loading other clients' Excels: re-run an import variant per file (the normalization layer is shared; only the source path + client name change).
- Per-technician productivity board and per-branch concentration view (data already captured; add views).
- Cash-flow PDF export reusing `src/lib/pdf/render.ts`.
- Forecast / projected cash (needs expected payment dates).
