# Flujo de Caja — Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the Flujo de Caja module: ETL for 3 clients (Just Burger, Decathlon, Unity), client selector on job form, enhanced management dashboard with per-client KPIs and monthly trend, and list UX improvements.

**Architecture:** All data flows through the existing `Job`/`Branch`/`Client`/`JobCost` Prisma models. The import script is idempotent via `importRef`. Dashboard enhancements add new pure-TS metric functions and new Server Components on the existing `/flujo` page. No new DB migrations needed.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + SQLite/Turso, ExcelJS (already installed), TypeScript, Tailwind v4, React 19 Server Components.

## Global Constraints

- UI text in Spanish, code/identifiers in English.
- All money in CLP integers (no decimals).
- `tenantScope(actor)` on every Prisma query — never leak cross-tenant data.
- Import is idempotent: `upsert` by `importRef`, never delete existing data.
- No new npm dependencies allowed — ExcelJS is already in devDependencies.
- Turso adapter chosen automatically by `DATABASE_URL` prefix (`libsql://`) in `src/lib/prisma.ts`.
- Brand color: `bg-brand` / `text-ink`. Font: Inter. Tailwind tokens in `globals.css`.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `scripts/import-flujo.ts` | Modify | Add Decathlon + Unity import, refactor to multi-client |
| `src/lib/cashflow/queries.ts` | Modify | Add `listJobsWithClient`, `getMonthlySummary`, `getClientSummaries` |
| `src/lib/cashflow/metrics.ts` | Modify | Add `computeClientBreakdown`, `computeMonthlyTrend`, `cobradoPct`, `avgTicket` |
| `src/lib/cashflow/labels.ts` | Modify | Export month name helper |
| `src/app/(app)/flujo/page.tsx` | Modify | Add client breakdown section, monthly trend, new KPI row |
| `src/app/(app)/flujo/trabajos/page.tsx` | Modify | Add client column, collectionStatus filter, footer totals |
| `src/app/(app)/flujo/trabajos/new/page.tsx` | Modify | Add visible client selector that reloads branches |
| `src/app/(app)/flujo/sucursales/page.tsx` | Modify | Add inline edit for branch name |
| `src/components/cashflow/client-selector.tsx` | Create | Client `<select>` that redirects on change (for new job page) |
| `src/components/cashflow/revenue-by-client.tsx` | Create | Per-client revenue bar list with KPIs |
| `src/components/cashflow/monthly-trend.tsx` | Create | Monthly revenue table (last 6–12 months) |
| `src/app/(app)/flujo/actions.ts` | Modify | Add `updateBranch` form action (UI already missing) |

---

## Task 1: Extend import script for Decathlon + Unity

**Files:**
- Modify: `scripts/import-flujo.ts`

**Interfaces:**
- Produces: idempotent upsert of clients `"Decathlon"` and `"Unity"` with their branches and jobs into the `ingegar` tenant.

- [ ] **Step 1: Replace the hard-coded single-file script with a multi-client runner**

Replace `scripts/import-flujo.ts` entirely with:

```typescript
import { writeFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { prisma } from '../src/lib/prisma.js'
import {
  parseMoneyCLP,
  parseCreditDays,
  normalizeType,
  normalizeCollectionStatus,
  normalizeBranchName,
} from '../src/lib/cashflow/normalize.js'

const TENANT_SLUG = 'ingegar'

const SOURCES = [
  {
    file: 'design-reference/Flujo de Caja Just Burger General 2026.xlsx',
    clientName: 'Just Burger',
    prefix: 'JB',
  },
  {
    file: 'design-reference/FLUJO DE CAJA DECATHLON GENERAL 20262.xlsx',
    clientName: 'Decathlon',
    prefix: 'DC',
  },
  {
    file: 'design-reference/FLUJO DE CAJA GENERAL UNITY 2026.xlsx',
    clientName: 'Unity',
    prefix: 'UTY',
  },
]

const cell = (row: ExcelJS.Row, i: number): unknown => {
  const v = (row.values as unknown[])[i]
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

async function importClient(
  tenantId: string,
  source: (typeof SOURCES)[0],
  csvRows: string[],
): Promise<{ count: number; net: number }> {
  let client = await prisma.client.findFirst({
    where: { tenantId, name: source.clientName },
  })
  if (!client) {
    client = await prisma.client.create({
      data: { tenantId, name: source.clientName },
    })
    console.log(`  Creado cliente: ${source.clientName}`)
  }

  const branchCache = new Map<string, string>()
  async function getBranchId(name: string): Promise<string> {
    if (branchCache.has(name)) return branchCache.get(name)!
    const b = await prisma.branch.upsert({
      where: { clientId_name: { clientId: client!.id, name } },
      update: {},
      create: { tenantId, clientId: client!.id, name },
    })
    branchCache.set(name, b.id)
    return b.id
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(source.file)

  let count = 0
  let netSum = 0

  for (const ws of wb.worksheets) {
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const description = str(cell(row, 6))
      const rawBranch = cell(row, 5)
      const netAmount = parseMoneyCLP(cell(row, 16))
      if (!description && netAmount == null) continue

      const branchName = normalizeBranchName(rawBranch) ?? 'Sin sucursal'
      const bId = await getBranchId(branchName)
      const importRef = `${source.prefix}#${ws.name}#${r}`
      const taxAmount = parseMoneyCLP(cell(row, 17))
      const collectionStatus = normalizeCollectionStatus(cell(row, 24))
      const invoiceDate = asDate(cell(row, 22))

      const data = {
        tenantId,
        clientId: client!.id,
        branchId: bId,
        costCenter: str(cell(row, 1)),
        jobNumber:
          typeof cell(row, 2) === 'number' ? Math.round(cell(row, 2) as number) : null,
        quoteRef: str(cell(row, 4)),
        hasTechReport:
          String(cell(row, 3) ?? '')
            .trim()
            .toUpperCase() === 'SI',
        description: description ?? '(sin descripción)',
        type: normalizeType(cell(row, 13)),
        status: 'ejecutado' as const,
        executionDate: asDate(cell(row, 9)),
        notes: str(cell(row, 12)),
        extraNotes: str(cell(row, 15)),
        netAmount,
        taxAmount:
          taxAmount ?? (netAmount != null ? Math.round(netAmount * 0.19) : null),
        purchaseOrder: str(cell(row, 19)),
        purchaseOrderDate: asDate(cell(row, 20)),
        invoiceNumber: str(cell(row, 21)),
        invoiceDate,
        creditDays: parseCreditDays(cell(row, 23)),
        paymentMethodRaw: str(cell(row, 23)),
        collectionStatus,
        paymentDate: asDate(cell(row, 25)),
      }

      await prisma.job.upsert({
        where: { importRef },
        update: data,
        create: { ...data, importRef },
      })
      count++
      netSum += netAmount ?? 0

      csvRows.push(
        [
          importRef,
          branchName,
          data.type,
          JSON.stringify(description ?? ''),
          data.executionDate?.toISOString().slice(0, 10) ?? '',
          netAmount ?? '',
          data.taxAmount ?? '',
          collectionStatus,
          data.invoiceNumber ?? '',
          invoiceDate?.toISOString().slice(0, 10) ?? '',
          data.creditDays ?? '',
        ].join(','),
      )
    }
  }

  console.log(
    `  ${source.clientName}: ${count} trabajos, ${branchCache.size} sucursales, neto $${netSum.toLocaleString('es-CL')}`,
  )
  return { count, net: netSum }
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant "${TENANT_SLUG}" no existe — corre npm run db:seed`)

  const csvRows = [
    'importRef,branch,type,description,executionDate,netAmount,taxAmount,collectionStatus,invoiceNumber,invoiceDate,creditDays',
  ]

  let totalCount = 0
  let totalNet = 0

  for (const source of SOURCES) {
    console.log(`\nImportando ${source.clientName}…`)
    const { count, net } = await importClient(tenant.id, source, csvRows)
    totalCount += count
    totalNet += net
  }

  await writeFile('design-reference/flujo-consolidado.csv', csvRows.join('\n'), 'utf8')

  console.log(`\n✓ Total: ${totalCount} trabajos importados.`)
  console.log(`  Neto consolidado: $${totalNet.toLocaleString('es-CL')}`)
  console.log(`  CSV actualizado: design-reference/flujo-consolidado.csv`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
```

- [ ] **Step 2: Run the import**

```bash
npm run import:flujo
```

Expected output:
```
Importando Just Burger…
  Just Burger: ~205 trabajos, N sucursales, neto $XX.XXX.XXX
Importando Decathlon…
  Decathlon: N trabajos, N sucursales, neto $X.XXX.XXX
Importando Unity…
  Unity: N trabajos, N sucursales, neto $X.XXX.XXX

✓ Total: NNN trabajos importados.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/import-flujo.ts design-reference/flujo-consolidado.csv
git commit -m "feat(cashflow): multi-client ETL — Decathlon + Unity added to import"
```

---

## Task 2: Client selector on new job form

**Files:**
- Create: `src/components/cashflow/client-selector.tsx`
- Modify: `src/app/(app)/flujo/trabajos/new/page.tsx`
- Modify: `src/components/cashflow/job-form.tsx`

**Interfaces:**
- `ClientSelector` — `'use client'` component, `clients: {id,name}[]`, `currentId: string`. On change redirects to `?cliente=<id>` via `router.push`.
- `JobForm` — receives `clients` prop (new), renders `ClientSelector` above sucursal field replacing hidden input.

- [ ] **Step 1: Create `client-selector.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function ClientSelector({
  clients,
  currentId,
}: {
  clients: { id: string; name: string }[]
  currentId: string
}) {
  const router = useRouter()
  const sp = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(sp.toString())
    params.set('cliente', e.target.value)
    router.push(`/flujo/trabajos/new?${params.toString()}`)
  }

  return (
    <select
      value={currentId}
      onChange={handleChange}
      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
    >
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: Update `new/page.tsx` to pass all clients**

Replace `new/page.tsx`:

```tsx
import Link from 'next/link'
import { requireActor } from '@/lib/resources/actor'
import { listBranches } from '@/lib/cashflow/queries'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { JobForm } from '@/components/cashflow/job-form'
import { createJob } from '../../actions'

export default async function NewTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const actor = await requireActor()
  const { cliente } = await searchParams

  const allClients = await prisma.client.findMany({
    where: tenantScope(actor),
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const clientId = (cliente && allClients.some((c) => c.id === cliente))
    ? cliente
    : allClients[0]?.id ?? ''

  const [branches, technicianRows] = await Promise.all([
    clientId ? listBranches(actor, clientId) : Promise.resolve([]),
    prisma.technician.findMany({
      where: { ...tenantScope(actor), active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/flujo/trabajos" className="text-xs text-gray-400 hover:text-gray-600">
        ← Trabajos
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Nuevo trabajo</h1>

      {!clientId && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No hay clientes registrados.{' '}
          <Link href="/recursos/clientes/new" className="underline">Crear cliente</Link>
        </p>
      )}

      <JobForm
        action={createJob}
        branches={branches}
        technicians={technicianRows}
        clients={allClients}
        clientId={clientId}
      />
    </div>
  )
}
```

- [ ] **Step 3: Update `JobForm` to render `ClientSelector`**

In `src/components/cashflow/job-form.tsx`, add `clients` prop and replace hidden input:

```tsx
// Add to imports
import { ClientSelector } from '@/components/cashflow/client-selector'

// Add to props destructure:
// clients: { id: string; name: string }[]

// Replace: <input type="hidden" name="clientId" value={clientId} />
// With:
<input type="hidden" name="clientId" value={clientId} />

// Add ABOVE the Sucursal field in the Identificación section:
{clients.length > 1 && (
  <Field label="Cliente *">
    <ClientSelector clients={clients} currentId={clientId} />
  </Field>
)}
```

Full updated signature:
```tsx
export function JobForm({
  action,
  branches,
  technicians,
  clients = [],
  clientId,
  initial,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  branches: { id: string; name: string }[]
  technicians: { id: string; name: string }[]
  clients?: { id: string; name: string }[]
  clientId: string
  initial?: JobInitial
})
```

The hidden `clientId` input stays — the selector is only for navigation/UX.

- [ ] **Step 4: Verify in dev server**

```bash
npm run dev
```

Go to `/flujo/trabajos/new`. Confirm client dropdown appears (when >1 client). Changing client should reload the page with updated branches.

- [ ] **Step 5: Commit**

```bash
git add src/components/cashflow/client-selector.tsx src/components/cashflow/job-form.tsx src/app/\(app\)/flujo/trabajos/new/page.tsx
git commit -m "feat(cashflow): client selector on new job form with branch reload"
```

---

## Task 3: Trabajos list — client column, status filter, totals

**Files:**
- Modify: `src/lib/cashflow/queries.ts`
- Modify: `src/app/(app)/flujo/trabajos/page.tsx`

**Interfaces:**
- `listJobs` updated to include `client: { name }` and accept `collectionStatus` filter.

- [ ] **Step 1: Update `listJobs` in `queries.ts`**

Add `collectionStatus` option and include `client`:

```typescript
export async function listJobs(
  actor: Actor,
  opts: {
    clientId?: string
    collectionStatus?: string
    from?: Date
    to?: Date
  } = {},
) {
  return prisma.job.findMany({
    where: {
      ...tenantScope(actor),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.collectionStatus ? { collectionStatus: opts.collectionStatus as never } : {}),
      ...(opts.from || opts.to
        ? {
            executionDate: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
    },
    include: { branch: true, client: { select: { id: true, name: true } }, costs: true },
    orderBy: [{ executionDate: 'desc' }, { createdAt: 'desc' }],
  })
}
```

- [ ] **Step 2: Rewrite `trabajos/page.tsx`**

```tsx
import Link from 'next/link'
import { requireActor } from '@/lib/resources/actor'
import { listJobs, listClientsForCashflow } from '@/lib/cashflow/queries'
import { JOB_TYPE_LABELS, COLLECTION_LABELS } from '@/lib/cashflow/labels'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'
import { CollectionChip } from '@/components/cashflow/collection-chip'
import { ClientFilter } from '@/components/cashflow/client-filter'

const STATUS_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'sin_oc', label: 'Sin OC' },
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pagado', label: 'Pagado' },
]

export default async function TrabajosPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; estado?: string }>
}) {
  const actor = await requireActor()
  const { cliente, estado } = await searchParams

  const [clients, jobs] = await Promise.all([
    listClientsForCashflow(actor),
    listJobs(actor, { clientId: cliente, collectionStatus: estado }),
  ])

  const totalNeto = jobs.reduce((s, j) => s + (j.netAmount ?? 0), 0)
  const showClientCol = !cliente && clients.length > 1

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/flujo" className="text-xs text-gray-400 hover:text-gray-600">← Flujo</Link>
          <h1 className="text-2xl font-bold">Trabajos</h1>
        </div>
        <Link
          href="/flujo/trabajos/new"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
        >
          + Nuevo trabajo
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ClientFilter clients={clients} />
        {STATUS_OPTS.map((o) => (
          <Link
            key={o.value}
            href={`/flujo/trabajos?${new URLSearchParams({ ...(cliente ? { cliente } : {}), ...(o.value ? { estado: o.value } : {}) }).toString()}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              (estado ?? '') === o.value
                ? 'bg-ink text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {jobs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Sin trabajos con este filtro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Fecha ejec.</th>
                {showClientCol && <th className="px-4 py-2.5 font-medium">Cliente</th>}
                <th className="px-4 py-2.5 font-medium">Sucursal</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium text-right">Neto</th>
                <th className="px-4 py-2.5 font-medium">Estado pago</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 text-gray-500">{j.executionDate ? toDateInput(j.executionDate) : '—'}</td>
                  {showClientCol && <td className="px-4 py-2.5 text-gray-600">{j.client.name}</td>}
                  <td className="px-4 py-2.5 text-gray-600">{j.branch.name}</td>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    <Link href={`/flujo/trabajos/${j.id}`} className="hover:text-brand-600 hover:underline">
                      {j.description}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{JOB_TYPE_LABELS[j.type] ?? j.type}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{clp(j.netAmount)}</td>
                  <td className="px-4 py-2.5"><CollectionChip status={j.collectionStatus} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={showClientCol ? 5 : 4} className="px-4 py-2.5 text-xs font-semibold text-gray-500">
                  {jobs.length} trabajos
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-ink">{clp(totalNeto)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/cashflow/queries.ts src/app/\(app\)/flujo/trabajos/page.tsx
git commit -m "feat(cashflow): jobs list — client column, status filter chips, footer total"
```

---

## Task 4: Enhanced Dashboard — per-client KPIs + monthly trend

**Files:**
- Modify: `src/lib/cashflow/queries.ts` — add `getClientSummaries`, `getMonthlySummary`
- Modify: `src/lib/cashflow/metrics.ts` — add `computeClientBreakdown`, `computeMonthlyTrend`
- Create: `src/components/cashflow/revenue-by-client.tsx`
- Create: `src/components/cashflow/monthly-trend.tsx`
- Modify: `src/app/(app)/flujo/page.tsx` — add new sections + KPI row

- [ ] **Step 1: Add new queries to `queries.ts`**

Append to `src/lib/cashflow/queries.ts`:

```typescript
export async function getClientSummaries(actor: Actor) {
  // One query: group by clientId. We compute in TS for consistency with computeMetrics.
  const jobs = await prisma.job.findMany({
    where: tenantScope(actor),
    select: {
      clientId: true,
      client: { select: { name: true } },
      netAmount: true,
      taxAmount: true,
      collectionStatus: true,
      invoiceDate: true,
      paymentDate: true,
      creditDays: true,
      executionDate: true,
      type: true,
      branchId: true,
      technicianId: true,
      costs: { select: { amount: true } },
    },
  })
  return jobs
}

export async function getMonthlySummary(actor: Actor, months = 12) {
  const from = new Date()
  from.setMonth(from.getMonth() - months + 1)
  from.setDate(1)
  from.setHours(0, 0, 0, 0)

  const jobs = await prisma.job.findMany({
    where: {
      ...tenantScope(actor),
      executionDate: { gte: from },
    },
    select: {
      executionDate: true,
      netAmount: true,
      collectionStatus: true,
      clientId: true,
      client: { select: { name: true } },
    },
    orderBy: { executionDate: 'asc' },
  })
  return jobs
}
```

- [ ] **Step 2: Add metric functions to `metrics.ts`**

Append to `src/lib/cashflow/metrics.ts`:

```typescript
export type ClientBreakdown = {
  clientId: string
  clientName: string
  facturado: number
  cobrado: number
  porCobrar: number
  sinOc: number
  jobCount: number
  cobradoPct: number | null
  avgTicket: number | null
}

export function computeClientBreakdown(
  jobs: (JobLike & { clientId: string; client: { name: string } })[],
): ClientBreakdown[] {
  const map = new Map<string, ClientBreakdown>()

  for (const j of jobs) {
    if (!map.has(j.clientId)) {
      map.set(j.clientId, {
        clientId: j.clientId,
        clientName: j.client.name,
        facturado: 0,
        cobrado: 0,
        porCobrar: 0,
        sinOc: 0,
        jobCount: 0,
        cobradoPct: null,
        avgTicket: null,
      })
    }
    const c = map.get(j.clientId)!
    const amount = net(j)
    c.jobCount++
    if (j.collectionStatus === 'sin_oc') {
      c.sinOc += amount
    } else {
      c.facturado += amount
      if (j.collectionStatus === 'pendiente_pago') c.porCobrar += amount
      if (j.collectionStatus === 'pagado') c.cobrado += amount
    }
  }

  for (const c of map.values()) {
    c.cobradoPct = c.facturado > 0 ? Math.round((c.cobrado / c.facturado) * 100) : null
    c.avgTicket = c.jobCount > 0 ? Math.round((c.facturado + c.sinOc) / c.jobCount) : null
  }

  return [...map.values()].sort((a, b) => b.facturado - a.facturado)
}

export type MonthlyBucket = {
  month: string // "YYYY-MM"
  label: string // "Ene 2026"
  facturado: number
  cobrado: number
  sinOc: number
  jobCount: number
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function computeMonthlyTrend(
  jobs: { executionDate: Date | null; netAmount: number | null; collectionStatus: string }[],
): MonthlyBucket[] {
  const map = new Map<string, MonthlyBucket>()

  for (const j of jobs) {
    if (!j.executionDate) continue
    const d = j.executionDate
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(month)) {
      map.set(month, {
        month,
        label: `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`,
        facturado: 0,
        cobrado: 0,
        sinOc: 0,
        jobCount: 0,
      })
    }
    const b = map.get(month)!
    const amount = j.netAmount ?? 0
    b.jobCount++
    if (j.collectionStatus === 'sin_oc') b.sinOc += amount
    else b.facturado += amount
    if (j.collectionStatus === 'pagado') b.cobrado += amount
  }

  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}
```

- [ ] **Step 3: Create `revenue-by-client.tsx`**

```tsx
import { clp } from '@/lib/cashflow/format'
import type { ClientBreakdown } from '@/lib/cashflow/metrics'

export function RevenueByClient({ breakdown }: { breakdown: ClientBreakdown[] }) {
  if (breakdown.length === 0) return null

  const maxFact = Math.max(...breakdown.map((c) => c.facturado + c.sinOc), 1)

  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-ink">Ingresos por cliente</h2>
      <div className="space-y-4">
        {breakdown.map((c) => {
          const total = c.facturado + c.sinOc
          const barPct = Math.round((total / maxFact) * 100)
          return (
            <div key={c.clientId}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink">{c.clientName}</span>
                <span className="tabular-nums text-sm font-semibold text-gray-700">{clp(total)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <div className="mt-1 flex gap-4 text-xs text-gray-500">
                <span>Cobrado: <span className="font-medium text-green-700">{clp(c.cobrado)}</span></span>
                <span>Por cobrar: <span className="font-medium text-amber-700">{clp(c.porCobrar)}</span></span>
                <span>Sin OC: <span className="font-medium text-red-600">{clp(c.sinOc)}</span></span>
                <span>{c.jobCount} trabajos</span>
                {c.cobradoPct != null && (
                  <span>Cobro: <span className="font-medium">{c.cobradoPct}%</span></span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Create `monthly-trend.tsx`**

```tsx
import { clp } from '@/lib/cashflow/format'
import type { MonthlyBucket } from '@/lib/cashflow/metrics'

export function MonthlyTrend({ buckets }: { buckets: MonthlyBucket[] }) {
  if (buckets.length === 0) return null

  const maxFact = Math.max(...buckets.map((b) => b.facturado + b.sinOc), 1)

  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-ink">Tendencia mensual (ejecución)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="pb-2 font-medium">Mes</th>
              <th className="pb-2 text-right font-medium">Facturado</th>
              <th className="pb-2 text-right font-medium">Cobrado</th>
              <th className="pb-2 text-right font-medium">Sin OC</th>
              <th className="pb-2 text-right font-medium">Trab.</th>
              <th className="pb-2 pl-3 font-medium">Barra</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => {
              const total = b.facturado + b.sinOc
              const barPct = Math.round((total / maxFact) * 100)
              return (
                <tr key={b.month} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 font-medium text-ink">{b.label}</td>
                  <td className="py-2 text-right tabular-nums text-gray-700">{clp(b.facturado)}</td>
                  <td className="py-2 text-right tabular-nums text-green-700">{clp(b.cobrado)}</td>
                  <td className="py-2 text-right tabular-nums text-red-600">{clp(b.sinOc)}</td>
                  <td className="py-2 text-right tabular-nums text-gray-500">{b.jobCount}</td>
                  <td className="py-2 pl-3">
                    <div className="h-2 w-24 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-brand" style={{ width: `${barPct}%` }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Rewrite `flujo/page.tsx` with all new sections**

```tsx
import Link from 'next/link'
import { auth } from '@/auth'
import { listClientsForCashflow, listJobs, getClientSummaries, getMonthlySummary } from '@/lib/cashflow/queries'
import { computeMetrics, computeClientBreakdown, computeMonthlyTrend, type JobLike } from '@/lib/cashflow/metrics'
import { clp } from '@/lib/cashflow/format'
import { KpiCard } from '@/components/cashflow/kpi-card'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { RevenueByClient } from '@/components/cashflow/revenue-by-client'
import { MonthlyTrend } from '@/components/cashflow/monthly-trend'
import { JOB_TYPE_LABELS } from '@/lib/cashflow/labels'

export default async function FlujoPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const session = await auth()
  const actor = session!.user
  const { cliente } = await searchParams

  const [clients, jobs, allJobs, monthlyJobs] = await Promise.all([
    listClientsForCashflow(actor),
    listJobs(actor, { clientId: cliente }),
    cliente ? Promise.resolve([]) : getClientSummaries(actor),
    cliente ? Promise.resolve([]) : getMonthlySummary(actor),
  ])

  const m = computeMetrics(jobs as unknown as JobLike[], new Date())
  const clientBreakdown = cliente ? [] : computeClientBreakdown(allJobs as never)
  const monthlyTrend = cliente ? [] : computeMonthlyTrend(monthlyJobs as never)

  // Extra derived KPIs
  const cobradoPct = m.facturado > 0 ? Math.round((m.cobrado / m.facturado) * 100) : null
  const avgTicket = jobs.length > 0 ? Math.round((m.facturado + m.sinOcBacklog) / jobs.length) : null

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Flujo de Caja</h1>
          <p className="mt-1 text-sm text-gray-500">Cobranza y rentabilidad por trabajo.</p>
        </div>
        <div className="flex items-center gap-2">
          <ClientFilter clients={clients} />
          <Link href="/flujo/trabajos" className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            Ver trabajos
          </Link>
          <Link href="/flujo/trabajos/new" className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-600">
            + Nuevo trabajo
          </Link>
        </div>
      </div>

      {/* A. Cobranza principal */}
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
        <KpiCard label="% Cobrado" value={cobradoPct != null ? `${cobradoPct}%` : '—'} tone={cobradoPct != null && cobradoPct >= 80 ? 'good' : 'warn'} hint="sobre lo facturado" />
        <KpiCard label="Ticket promedio" value={avgTicket != null ? clp(avgTicket) : '—'} hint={`${jobs.length} trabajos`} />
      </div>

      {/* C. Margen */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Margen total" value={m.marginTotal != null ? clp(m.marginTotal) : '—'} hint={m.marginTotal == null ? 'Carga costos para activar' : undefined} />
      </div>

      {/* D. Por cliente (solo cuando no hay filtro activo) */}
      {!cliente && clientBreakdown.length > 1 && (
        <div className="mt-6">
          <RevenueByClient breakdown={clientBreakdown} />
        </div>
      )}

      {/* E. Aging + Mix */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Cuentas por cobrar (aging)</h2>
          <ul className="space-y-1.5 text-sm">
            {m.aging.map((a) => (
              <li key={a.bucket} className="flex justify-between">
                <span className="text-gray-500">{a.bucket} días</span>
                <span className="tabular-nums">{clp(a.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Mix por tipo</h2>
          <ul className="space-y-1.5 text-sm">
            {m.mix.map((x) => (
              <li key={x.type} className="flex justify-between">
                <span className="text-gray-500">{JOB_TYPE_LABELS[x.type] ?? x.type} ({x.count})</span>
                <span className="tabular-nums">{clp(x.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* F. Tendencia mensual (solo sin filtro) */}
      {!cliente && monthlyTrend.length > 1 && (
        <div className="mt-6">
          <MonthlyTrend buckets={monthlyTrend} />
        </div>
      )}

      {/* G. Quick links */}
      <div className="mt-6 flex gap-3 text-sm text-gray-500">
        <Link href="/flujo/sucursales" className="hover:text-ink hover:underline">Administrar sucursales →</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/cashflow/queries.ts src/lib/cashflow/metrics.ts src/components/cashflow/revenue-by-client.tsx src/components/cashflow/monthly-trend.tsx src/app/\(app\)/flujo/page.tsx
git commit -m "feat(cashflow): enhanced dashboard — per-client breakdown, monthly trend, % cobrado, ticket promedio"
```

---

## Task 5: Branch inline edit

**Files:**
- Modify: `src/app/(app)/flujo/sucursales/page.tsx`
- Modify: `src/app/(app)/flujo/actions.ts` (updateBranch already exists)
- Create: `src/components/cashflow/branch-edit-form.tsx`

- [ ] **Step 1: Create `branch-edit-form.tsx`**

```tsx
'use client'

import { useActionState, useState } from 'react'

type FormState = { error?: string }

export function BranchEditForm({
  branch,
  action,
}: {
  branch: { id: string; name: string; active: boolean }
  action: (id: string, form: FormData) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, pending] = useActionState(
    async (_prev: FormState, form: FormData) => {
      try {
        await action(branch.id, form)
        setEditing(false)
        return {}
      } catch {
        return { error: 'Error al guardar.' }
      }
    },
    {},
  )

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600">
        Editar
      </button>
    )
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="clientId" value="" />
      <input
        name="name"
        defaultValue={branch.name}
        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
        autoFocus
      />
      <input type="hidden" name="active" value={branch.active ? 'on' : ''} />
      <button type="submit" disabled={pending} className="rounded bg-brand px-2 py-1 text-xs font-medium text-ink">
        {pending ? '…' : 'Guardar'}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">
        Cancelar
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  )
}
```

Note: `updateBranch` in `actions.ts` needs `clientId` — it currently reads it from form but doesn't use it for update (only validates). The hidden `clientId` can be empty since `updateBranch` uses `tenantScope` on the branch `id`. Check `actions.ts` line 54 — `updateBranch` does `updateMany({ where: { id, ...tenantScope(u) } })` so clientId is not needed for the update. Remove the `clientId` parse from `branchInput` or make it optional for updates. Simplest fix: pass a placeholder `clientId` in the hidden field.

Actually looking at `branchInput` schema — it requires `clientId: z.string().min(1)`. Since updateBranch reads it, either:
- (a) pass the real clientId as a hidden input in the edit form, or
- (b) make clientId optional in branchInput.

Option (a) is simpler: pass `clientId` as prop to `BranchEditForm` and add the hidden input.

Updated `BranchEditForm` props: add `clientId: string`, pass `<input type="hidden" name="clientId" value={clientId} />`.

- [ ] **Step 2: Update `sucursales/page.tsx` to use edit form**

In the branch list items, replace the plain name + delete layout:

```tsx
// Add to imports:
import { BranchEditForm } from '@/components/cashflow/branch-edit-form'
import { updateBranch } from '@/app/(app)/flujo/actions'

// Replace each <li> content:
<li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
  <div className="flex items-center gap-3 flex-1 min-w-0">
    <span className="text-sm font-medium text-ink truncate">{b.name}</span>
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {b.active ? 'Activa' : 'Inactiva'}
    </span>
  </div>
  <div className="flex items-center gap-3 shrink-0">
    <BranchEditForm branch={b} clientId={clientId} action={updateBranch} />
    <DeleteButton action={deleteBranch.bind(null, b.id)} confirmText={`¿Eliminar sucursal "${b.name}"?`} />
  </div>
</li>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cashflow/branch-edit-form.tsx src/app/\(app\)/flujo/sucursales/page.tsx
git commit -m "feat(cashflow): inline branch name edit on sucursales page"
```

---

## Self-Review

**Spec coverage:**
- ✅ ETL for Decathlon + Unity (Task 1)
- ✅ Both SQLite and Turso (same Prisma code, adapter chosen by DATABASE_URL)
- ✅ Client selector on new job form (Task 2)
- ✅ Jobs list: client column, status filter, totals (Task 3)
- ✅ Dashboard per-client breakdown (Task 4)
- ✅ Dashboard monthly trend (Task 4)
- ✅ New KPIs: % cobrado, ticket promedio (Task 4)
- ✅ Branch edit UI (Task 5)

**No placeholders found.**

**Type consistency check:**
- `computeClientBreakdown` consumes jobs with `clientId + client.name` — `getClientSummaries` returns exactly that ✅
- `computeMonthlyTrend` consumes `{ executionDate, netAmount, collectionStatus }` — `getMonthlySummary` returns exactly that ✅
- `RevenueByClient` receives `ClientBreakdown[]` — exported from `metrics.ts` ✅
- `MonthlyTrend` receives `MonthlyBucket[]` — exported from `metrics.ts` ✅
- `BranchEditForm` receives `clientId` — passed from `sucursales/page.tsx` where `clientId` is in scope ✅
