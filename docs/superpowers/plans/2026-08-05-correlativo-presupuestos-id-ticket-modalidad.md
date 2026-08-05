# Correlativo global de presupuestos + ID de ticket con modalidad + nombres de archivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text/collision-prone quote number with a real, audited, admin-configured global correlativo; rebuild `Ticket.ticketCode` generation around a real per-prefix sequence (date+client+sucursal+modalidad comercial) instead of urgency+timestamp-suffix collision handling; give downloaded documents consistent, ticket-anchored filenames; and give the Propuestas listing selection + bulk actions + a Sucursal column/filter.

**Architecture:** Two independent "real sequence, no reuse" generators (`QuoteSequenceConfig` for presupuestos, a rewritten `ticket-code-server.ts` for tickets) following the exact optimistic-retry pattern already established by `generateJobCodeWithRetry`/`createTicketWithUniqueCode` in this codebase — read current value, attempt write, retry on a real DB conflict, never a pessimistic lock. `Ticket.processFlow` (already implemented, already required-by-default in the internal create form) becomes the "modalidad comercial" axis of the new ticket ID; it's not a new concept, just newly load-bearing. File naming and the Propuestas listing UI are additive, no schema impact.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (SQLite local / Turso prod), Zod, React 19 client components, `archiver` (already installed) for ZIP.

## Global Constraints

- Every schema change: `prisma migrate dev` (local, `DATABASE_URL=file:`) → verify → **never** run against Turso prod in this plan; prod deploy is a separate, explicitly-confirmed step per `.claude/rules/production-safety.md`.
- No existing `quoteId`/`ticketCode`/`Job.code` value is ever renamed, backfilled, or reused — old and new formats coexist permanently (see spec § "Decisiones de alcance").
- `ticket-code.ts` (the client-safe prefix builder) must **never** import `@/lib/prisma` — it's bundled into `new-ticket-form.tsx`, a client component; a Prisma import there breaks the Turbopack build (existing comment in the file, still true).
- Reuse before creating: `Modal` (`src/components/resources/modal.tsx`), `FilterBar`/`FilterSelect`/`FilterPill` (`src/components/ui/filter-bar.tsx`), `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td` (`src/components/ui/table.tsx`), `Button`/`buttonClass` (`src/components/ui/button.tsx`), `Spinner`, `logAudit()` (`src/lib/audit.ts`), `requireActor()`/`tenantScope()` (`src/lib/tenant.ts`), `archiver` via `src/lib/zip.ts`.
- Spec: `docs/superpowers/specs/2026-08-05-referencias-inmutables-ot-fac-oc-quoteid-design.md`.

---

## Task 1: `QuoteSequenceConfig` schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (add model, near `ClientDocument`)
- Create: `prisma/migrations/20260805060000_add_quote_sequence_config/migration.sql`

**Interfaces:**
- Produces: `QuoteSequenceConfig` Prisma model — `{ id, tenantId (unique), nextNumber: Int, updatedAt, updatedById }`.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Insert after the `ClientDocument` model closing brace (search for `@@map("client_documents")`):

```prisma
// Correlativo global de presupuestos (pedido explícito del dueño vía el
// documento de Sebastián Garrido, INGEGAR UPGRADE/): un contador real por
// tenant, no un "piso" recalculado desde los datos — así un documento
// eliminado nunca libera su número (MAX(existente)+1 sí lo liberaría).
// nextNumber es EL PRÓXIMO a emitir; se lee y avanza atómicamente en
// src/lib/quotes/quote-sequence.ts, nunca se decrementa.
model QuoteSequenceConfig {
  id          String   @id @default(cuid())
  tenantId    String   @unique
  nextNumber  Int
  updatedAt   DateTime @updatedAt
  updatedById String

  @@map("quote_sequence_config")
}
```

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name add_quote_sequence_config` (confirm `DATABASE_URL` is `file:` first — `.claude/rules/production-safety.md`)

Expected: creates `prisma/migrations/<timestamp>_add_quote_sequence_config/migration.sql` with a `CREATE TABLE "quote_sequence_config" (...)`, applies it to local `dev.db`, regenerates the Prisma client.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

Expected: no errors (schema-only change, no consumer yet).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(quotes): add QuoteSequenceConfig table for the global correlativo"
```

---

## Task 2: Server-side atomic quote-number assignment + admin update action

**Files:**
- Create: `src/lib/quotes/quote-sequence.ts`
- Modify: `src/app/(app)/cotizador/actions.ts` (remove `getNextQuoteSeq`, add `getQuoteSequenceConfig`, `updateQuoteSequenceConfig`)

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`), `logAudit()` (`@/lib/audit`), `AuthActor` shape from `requireActor()`.
- Produces: `assignQuoteNumber(tenantId: string): Promise<string>` (in `quote-sequence.ts`, server-only, no `'use server'` — called from the API route, not directly from a client). `getQuoteSequenceConfig(): Promise<{ nextNumber: number; updatedAt: Date; updatedByName: string | null } | null>` and `updateQuoteSequenceConfig(nextNumber: number): Promise<{ success: true } | { success: false; error: string }>` — both `'use server'` actions in `cotizador/actions.ts`, `super`-only.

**No unit test for `assignQuoteNumber` itself** — checked first: this codebase has zero unit tests that touch Prisma/a real DB (`tests/unit/*.test.ts` is 100% pure-function tests; the closest existing precedent, `generateJobCode`/`generateJobCodeWithRetry` in `src/lib/cashflow/generate-code.ts` — the exact same "read current value, retry on real DB conflict" shape this function copies — has no unit test either, verified live instead). Inventing a Prisma-in-memory test harness here would be a new, unverified pattern this plan can't actually confirm runs. Verified live instead, in Task 3 Step 7 and Task 12 Step 4.

- [ ] **Step 1: Write `src/lib/quotes/quote-sequence.ts`**

```ts
import { prisma } from '@/lib/prisma'

const MAX_ATTEMPTS = 5

// Contador real, no un MAX(quoteId existente)+1 — si fuera un MAX recalculado,
// eliminar el documento con el número más alto liberaría ese número para el
// próximo, violando la regla explícita "un número usado no se reutiliza"
// (pedido del dueño vía el documento de Sebastián Garrido). Mismo patrón de
// reintento optimista que generateJobCodeWithRetry/createTicketWithUniqueCode
// ya usan en este proyecto — updateMany con el valor esperado en el `where`
// en vez de un lock: si otra request ya avanzó el contador, `count` da 0 y
// se reintenta con el valor fresco, correcto bajo MVCC de Turso/libSQL.
export async function assignQuoteNumber(tenantId: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const config = await prisma.quoteSequenceConfig.upsert({
      where: { tenantId },
      create: { tenantId, nextNumber: 1, updatedById: 'system' },
      update: {},
      select: { nextNumber: true },
    })
    const current = config.nextNumber
    const result = await prisma.quoteSequenceConfig.updateMany({
      where: { tenantId, nextNumber: current },
      data: { nextNumber: current + 1 },
    })
    if (result.count === 1) return String(current)
    // count === 0: otra request ganó la carrera entre el upsert y este
    // updateMany — reintentar con el valor ya avanzado.
  }
  throw new Error('No se pudo asignar el número de cotización (demasiada contención).')
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: fails only on the `updatedById: 'system'` line if `User` has no row with id `'system'` — this is fine, Prisma doesn't validate FK existence at the type level, only at write time. This line only executes on a tenant's very first-ever auto-assign before any admin has touched the config panel; if it ever actually errors in practice (FK constraint), the fix is trivial (use `actor.id` from a real caller instead of the literal `'system'`) — but `assignQuoteNumber` is called from `POST /api/client-documents` (Task 3), which already has `session.user.id` in scope. Use that instead of the placeholder:

Replace `updatedById: 'system'` with a required second parameter:

```ts
export async function assignQuoteNumber(tenantId: string, assignedById: string): Promise<string> {
```

and use `updatedById: assignedById` in the `create` clause. This avoids a fake FK value entirely — the "system" placeholder above was wrong, this is the real fix, not a TODO.

- [ ] **Step 3: Add the admin actions to `src/app/(app)/cotizador/actions.ts`**

Replace the entire file content (the old `getNextQuoteSeq` is removed — its only caller, `quote-editor.tsx`'s "Regenerar" button, is removed in Task 3):

```ts
'use server'

import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { logAudit } from '@/lib/audit'

// Lee el estado actual del correlativo para el panel de administración
// (super-only) — ver Modal en quote-sequence-config-modal.tsx. Devuelve
// null si el tenant nunca asignó un número todavía (assignQuoteNumber lo
// crea perezosamente en 1 la primera vez que se necesita de verdad).
export async function getQuoteSequenceConfig() {
  const actor = await requireActor(['super'])
  const config = await prisma.quoteSequenceConfig.findUnique({
    where: { tenantId: actor.tenantId },
    select: { nextNumber: true, updatedAt: true, updatedBy: { select: { name: true } } },
  })
  if (!config) return null
  return { nextNumber: config.nextNumber, updatedAt: config.updatedAt, updatedByName: config.updatedBy?.name ?? null }
}

// Solo puede avanzar (pedido explícito): nunca se acepta un nextNumber
// menor o igual al ya configurado. No compara contra "el número más alto
// ya usado" — el contador real (quote_sequence_config.nextNumber) YA es
// ese máximo+1 en todo momento, comparar contra sí mismo alcanza.
export async function updateQuoteSequenceConfig(nextNumber: number): Promise<{ success: true } | { success: false; error: string }> {
  const actor = await requireActor(['super'])
  if (!Number.isInteger(nextNumber) || nextNumber < 1) {
    return { success: false, error: 'El número debe ser un entero positivo.' }
  }

  const existing = await prisma.quoteSequenceConfig.findUnique({ where: { tenantId: actor.tenantId }, select: { nextNumber: true } })
  if (existing && nextNumber <= existing.nextNumber) {
    return { success: false, error: 'No es posible retroceder el correlativo. El nuevo número debe ser mayor al último número de presupuesto utilizado.' }
  }

  const before = existing?.nextNumber ?? null
  await prisma.quoteSequenceConfig.upsert({
    where: { tenantId: actor.tenantId },
    create: { tenantId: actor.tenantId, nextNumber, updatedById: actor.id },
    update: { nextNumber, updatedById: actor.id },
  })
  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: 'quote_sequence_config.update', entityType: 'QuoteSequenceConfig', entityId: actor.tenantId,
    before: { nextNumber: before }, after: { nextNumber },
    source: 'cotizador/actions.ts:updateQuoteSequenceConfig',
  })
  return { success: true }
}
```

Note: this requires a `User` relation on `QuoteSequenceConfig.updatedById` for `select: { updatedBy: { select: { name: true } } }` to work — add it now:

- [ ] **Step 4: Add the `updatedBy` relation to the schema**

In `prisma/schema.prisma`, update the `QuoteSequenceConfig` model added in Task 1:

```prisma
model QuoteSequenceConfig {
  id          String   @id @default(cuid())
  tenantId    String   @unique
  nextNumber  Int
  updatedAt   DateTime @updatedAt
  updatedById String
  updatedBy   User     @relation(fields: [updatedById], references: [id])

  @@map("quote_sequence_config")
}
```

Add the inverse relation to `model User` (find the `User` model, add near its other back-relations):

```prisma
  quoteSequenceConfigsUpdated QuoteSequenceConfig[]
```

Run: `npx prisma migrate dev --name add_quote_sequence_config_user_relation`

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/quotes/quote-sequence.ts src/app/\(app\)/cotizador/actions.ts
git commit -m "feat(quotes): atomic quote-number counter + admin update action, replaces getNextQuoteSeq"
```

---

## Task 3: Auto-assign on create, lock the editor field, delete dead code

**Files:**
- Modify: `src/app/api/client-documents/route.ts` (POST handler)
- Modify: `src/components/quotes/quote-editor.tsx` (remove manual input/regenerate)
- Delete: `src/lib/quotes/quote-id.ts` (dead — see below)
- Modify: `src/app/(app)/cotizador/page.tsx` (listing still reads `d.quoteId` as-is, no change needed there — verify only)

**Interfaces:**
- Consumes: `assignQuoteNumber(tenantId, assignedById)` from Task 2.
- Produces: nothing new — this task wires Task 2's output into the real save path and removes the now-impossible-to-reach manual UI.

- [ ] **Step 1: Confirm `buildQuoteId` has no other callers**

Run: `grep -rn "buildQuoteId\|from '@/lib/quotes/quote-id'" src/`
Expected: only `src/components/quotes/quote-editor.tsx` and `src/lib/quotes/quote-id.ts` itself (already verified during planning — re-verify before deleting in case something changed).

- [ ] **Step 2: Update `POST /api/client-documents` to auto-assign `quoteId`**

In `src/app/api/client-documents/route.ts`, replace the `computeQuoteId` usage in the POST handler. Import the new function:

```ts
import { assignQuoteNumber } from '@/lib/quotes/quote-sequence'
```

Replace this line inside `POST`:

```ts
      ...(type === 'propuesta' && dataJson ? { proposalAmount: computeProposalAmount(dataJson), quoteId: computeQuoteId(dataJson) } : {}),
```

with a pre-computed value (the assignment must happen *before* the `prisma.clientDocument.create` call, since it needs an `await`):

```ts
  const assignedQuoteId = type === 'propuesta' ? await assignQuoteNumber(session.user.tenantId ?? '', session.user.id) : undefined
```

(insert this line right before the `const doc = await prisma.clientDocument.create({` line), then change the spread to:

```ts
      ...(type === 'propuesta' && dataJson ? { proposalAmount: computeProposalAmount(dataJson) } : {}),
      ...(type === 'propuesta' ? { quoteId: assignedQuoteId } : {}),
```

The `computeQuoteId` helper function (reading `dataJson.quoteId`) is now unused in POST — but PATCH still needs it removed too:

- [ ] **Step 3: Stop syncing `quoteId` on PATCH — it's assigned once, at creation, never again**

In the same file, `PATCH` handler, remove this block entirely:

```ts
      // quoteId sí se espeja también en edición (a diferencia de
      // proposalAmount, ver abajo) — es el mismo dato en dataJson y acá,
      // nunca diverge.
      ...(doc.type === 'propuesta' && dataJson ? { quoteId: computeQuoteId(dataJson) } : {}),
```

Now `computeQuoteId` has zero callers — delete the function itself (the whole `function computeQuoteId(...)` block, lines ~31-44 with its comment).

- [ ] **Step 4: Remove the manual input + "Regenerar" button from `quote-editor.tsx`**

Delete the `regenBusy`/`regenerateQuoteId` state and function (added in G65, this same session — being reverted per the spec):

```ts
  const [regenBusy, setRegenBusy] = useState(false)
  async function regenerateQuoteId() {
    setRegenBusy(true)
    try {
      const seq = await getNextQuoteSeq()
      set({ quoteId: buildQuoteId({ date: data.date, client: data.client.name, seq }) })
    } finally {
      setRegenBusy(false)
    }
  }
```

Remove the now-dead imports: `buildQuoteId` from `@/lib/quotes/quote-id`, `getNextQuoteSeq` from `@/app/(app)/cotizador/actions`, `RefreshIcon` (if unused elsewhere in the file — check with `grep -n RefreshIcon src/components/quotes/quote-editor.tsx`).

Replace the `N° Cotización` `Field` block:

```tsx
            <Field label="N° Cotización" hint="Manual: escríbelo tú. Automático: usa el botón — sigue el correlativo real desde el número más alto que exista.">
              <div className="flex gap-1.5">
                <TextInput value={data.quoteId} onChange={(e) => set({ quoteId: e.target.value })} />
                <IconButton
                  label="Generar automáticamente (siguiente correlativo)"
                  onClick={regenerateQuoteId}
                  disabled={regenBusy}
                >
                  <RefreshIcon />
                </IconButton>
              </div>
            </Field>
```

with a read-only display (pedido explícito: "El usuario no escribe manualmente el número... El campo N° presupuesto debe ser de solo lectura"):

```tsx
            <Field label="N° Presupuesto" hint="Se asigna automáticamente al guardar — no es editable.">
              <div className="flex min-h-9 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500">
                {data.quoteId ? data.quoteId : 'Se asignará al guardar'}
              </div>
            </Field>
```

- [ ] **Step 5: Delete the dead file**

```bash
git rm src/lib/quotes/quote-id.ts
```

If `tests/unit/` has a test file for `quote-id.ts` (check: `ls tests/unit/*quote-id*`), delete it too.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run test:unit`
Expected: all clean. (A pre-existing test asserting the old `ING-COT-...` auto-generate behavior, if any, should now fail loudly — fix or remove it as part of this step, don't leave a red test.)

- [ ] **Step 7: Live check against the local mirror**

Start dev server if not running (`npm run dev`), open `/cotizador?new=1`, confirm: N° Presupuesto field shows "Se asignará al guardar" and is not editable; save a new propuesta linked to a real ticket; confirm the saved document now shows a plain integer (e.g. "1", "2" — whatever the tenant's counter currently is) instead of the old `ING-COT-...` format, and that field is now visibly read-only when reopening the saved document.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(quotes): auto-assign quoteId server-side on create, lock the field, drop dead ING-COT id builder"
```

---

## Task 4: Admin config panel UI

**Files:**
- Create: `src/components/quotes/quote-sequence-config-modal.tsx`
- Modify: `src/app/(app)/cotizador/page.tsx` (button in header, `super`-only)

**Interfaces:**
- Consumes: `getQuoteSequenceConfig()`, `updateQuoteSequenceConfig()` from Task 2.

- [ ] **Step 1: Write the modal component**

```tsx
// src/components/quotes/quote-sequence-config-modal.tsx
'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/resources/modal'
import { buttonClass } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { getQuoteSequenceConfig, updateQuoteSequenceConfig } from '@/app/(app)/cotizador/actions'

export function QuoteSequenceConfigButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<{ nextNumber: number; updatedAt: Date; updatedByName: string | null } | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function openModal() {
    setOpen(true)
    setSaved(false)
    setError('')
    setLoading(true)
    try {
      const c = await getQuoteSequenceConfig()
      setConfig(c)
      setValue(c ? String(c.nextNumber) : '')
    } finally {
      setLoading(false)
    }
  }

  function submit() {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1) { setError('Ingresa un número entero positivo.'); return }
    const lastUsed = config ? config.nextNumber - 1 : 0
    setError('')
    if (!confirm(`El próximo número de presupuesto será ${n.toLocaleString('es-CL')}. Una vez guardado, no podrás volver a un número anterior. ¿Deseas continuar?`)) return
    startTransition(async () => {
      const res = await updateQuoteSequenceConfig(n)
      if (!res.success) { setError(res.error); return }
      setSaved(true)
      const c = await getQuoteSequenceConfig()
      setConfig(c)
      void lastUsed // solo usado en el copy de abajo, evita el lint de var no usada si el JSX cambia
    })
  }

  return (
    <>
      <button type="button" onClick={openModal} className={buttonClass('secondary', 'sm')}>
        🔑 Configuración de presupuestos
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Configuración de presupuestos">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner size={24} /></div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">Último presupuesto utilizado</p>
                <p className="mt-1 text-xl font-bold text-ink">{config ? (config.nextNumber - 1).toLocaleString('es-CL') : '—'}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">Próximo número configurado</p>
                <p className="mt-1 text-xl font-bold text-ink">{config ? config.nextNumber.toLocaleString('es-CL') : '—'}</p>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Próximo número correlativo</label>
              <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => { setValue(e.target.value); setSaved(false) }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-lg font-bold outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
              />
            </div>
            <p className="rounded-md border-l-4 border-brand bg-brand/5 px-3 py-2 text-xs text-gray-600">
              Solo se permite avanzar el correlativo, nunca retroceder. No se recomienda modificarlo después de la configuración inicial.
            </p>
            {config?.updatedByName && (
              <p className="text-xs text-gray-400">
                Última modificación: {new Date(config.updatedAt).toLocaleString('es-CL')} · {config.updatedByName}
              </p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            {saved && <p className="text-xs font-semibold text-ok-700">✓ Configuración guardada.</p>}
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass('ghost', 'sm')}>Cerrar</button>
              <button type="button" onClick={submit} disabled={isPending} className={buttonClass('primary', 'sm')}>
                {isPending ? <Spinner size={13} /> : 'Guardar cambio'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
```

- [ ] **Step 2: Add the button to `/cotizador`'s header — `super`-only**

In `src/app/(app)/cotizador/page.tsx`, import and gate it:

```ts
import { QuoteSequenceConfigButton } from '@/components/quotes/quote-sequence-config-modal'
```

In `CotizadorPage`, the header `div.flex.items-start.justify-between` currently only has the title + "+ Crear nueva" button. Add the config button before it, gated by role (the page already has `actor` in scope from `requireActor()`):

```tsx
        <Button href="/cotizador?new=1" size="sm">+ Crear nueva</Button>
```

becomes:

```tsx
        <div className="flex items-center gap-2">
          {actor.role === 'super' && <QuoteSequenceConfigButton />}
          <Button href="/cotizador?new=1" size="sm">+ Crear nueva</Button>
        </div>
```

(This only applies to the bare-listing branch of `CotizadorPage`, not `CotizadorEditor` — the editor branch returns early before this JSX.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Live check**

As `super`, open `/cotizador` — confirm "🔑 Configuración de presupuestos" button appears, opens the modal with real current values, rejects a number ≤ current (shows the exact error message), accepts a number > current with the confirm dialog, updates "Última modificación". Log in as `supervisor` (or check `Ver como…`) and confirm the button does not render.

- [ ] **Step 5: Commit**

```bash
git add src/components/quotes/quote-sequence-config-modal.tsx src/app/\(app\)/cotizador/page.tsx
git commit -m "feat(quotes): admin panel for the quote-number correlativo config"
```

---

## Task 5: File naming by tokens

**Files:**
- Create: `src/lib/tickets/file-naming.ts`
- Create: `tests/unit/file-naming.test.ts`
- Modify: `src/components/quotes/document-quick-preview.tsx` (filename in `download()`)
- Modify: `src/components/quotes/download-pdf-button.tsx` (filename + new `ticketCode` prop)
- Modify: `src/components/quotes/quote-editor.tsx` (pass `ticketCode` to `DownloadPdfButton`)

**Interfaces:**
- Produces: `buildDownloadFilename(opts: { kind: 'presupuesto' | 'factura' | 'oc' | 'informe_tecnico'; number?: string | null; ticketCode?: string | null; ext?: string }): string`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/file-naming.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDownloadFilename } from '../../src/lib/tickets/file-naming.ts'

test('presupuesto con número y ticket', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'presupuesto', number: '20000', ticketCode: '260805-HAPP-ALTOLASCONDES-CP1' }),
    'PRESUPUESTO_20000_260805-HAPP-ALTOLASCONDES-CP1.pdf',
  )
})

test('factura con número y ticket', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'factura', number: '1350', ticketCode: '260805-HAPP-ALTOLASCONDES-CP1' }),
    'FACTURA_1350_260805-HAPP-ALTOLASCONDES-CP1.pdf',
  )
})

test('oc con extensión no-pdf', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'oc', number: 'X-5030', ticketCode: '260805-HAPP-ALTOLASCONDES-CP1', ext: 'jpg' }),
    'OC_X-5030_260805-HAPP-ALTOLASCONDES-CP1.jpg',
  )
})

test('informe técnico no lleva número', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'informe_tecnico', ticketCode: '260805-HAPP-ALTOLASCONDES-CP1' }),
    'INFORME_TECNICO_260805-HAPP-ALTOLASCONDES-CP1.pdf',
  )
})

test('sin ticket vinculado — se omite ese segmento, no queda un guion colgando', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'presupuesto', number: '20000', ticketCode: null }),
    'PRESUPUESTO_20000.pdf',
  )
})

test('sin número (presupuesto/factura/oc todavía sin asignar) — se omite ese segmento', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'presupuesto', number: null, ticketCode: '260805-HAPP-ALTOLASCONDES-CP1' }),
    'PRESUPUESTO_260805-HAPP-ALTOLASCONDES-CP1.pdf',
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/file-naming.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/tickets/file-naming.ts

// Nombres de descarga consistentes, pedido explícito del dueño (documento de
// Sebastián Garrido): PRESUPUESTO_NUMERO_ID.pdf / FACTURA_NUMERO_ID.pdf /
// OC_NUMERO_ID.ext / INFORME_TECNICO_ID.pdf — el "ID" es siempre
// Ticket.ticketCode, nunca un sufijo inventado (PPTO/FAC/OC/IT/OT quedan
// fuera del ID por pedido explícito, ver el spec). Aplica igual en descarga
// individual y masiva — una sola función, ambos caminos la llaman.
const KIND_PREFIX = {
  presupuesto: 'PRESUPUESTO',
  factura: 'FACTURA',
  oc: 'OC',
  informe_tecnico: 'INFORME_TECNICO',
} as const

export function buildDownloadFilename(opts: {
  kind: keyof typeof KIND_PREFIX
  number?: string | null
  ticketCode?: string | null
  ext?: string
}): string {
  const parts = [KIND_PREFIX[opts.kind]]
  if (opts.number) parts.push(opts.number)
  if (opts.ticketCode) parts.push(opts.ticketCode)
  return `${parts.join('_')}.${opts.ext ?? 'pdf'}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/file-naming.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Wire into `document-quick-preview.tsx`**

In `src/components/quotes/document-quick-preview.tsx`, the `DocumentQuickPreview` props need a `ticketCode` and `number` (quoteId) to build the real filename — add them:

```ts
export function DocumentQuickPreview({
  docId, title, documentType, editHref, trigger, triggerClassName, ticketCode, number,
}: {
  docId: string
  title: string
  documentType: 'propuesta' | 'informe'
  editHref: string
  trigger?: ReactNode
  triggerClassName?: string
  /** Ticket.ticketCode del ticket vinculado, si hay — para el nombre de archivo (ver file-naming.ts). */
  ticketCode?: string | null
  /** ClientDocument.quoteId — solo aplica a propuestas, informes no llevan número. */
  number?: string | null
}) {
```

Add the import: `import { buildDownloadFilename } from '@/lib/tickets/file-naming'`.

Replace the filename line inside `download()`:

```ts
      a.download = `${title.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().replace(/\s+/g, '-') || 'documento'}.pdf`
```

with:

```ts
      a.download = buildDownloadFilename({
        kind: documentType === 'propuesta' ? 'presupuesto' : 'informe_tecnico',
        number: documentType === 'propuesta' ? number : undefined,
        ticketCode,
      })
```

- [ ] **Step 6: Pass the new props from every `DocumentQuickPreview` caller**

Update all call sites (find them: `grep -rln "DocumentQuickPreview" src/`) to pass `ticketCode` and, for propuestas, `number={d.quoteId}` wherever a `quoteId`/`ticketCode` is already in scope from the surrounding query. At minimum:
- `src/app/(app)/cotizador/page.tsx` (has `d.quoteId` and `d.ticket?.ticketCode` already selected — pass both).
- `src/app/(app)/informe/page.tsx` (has `d.ticket?.ticketCode` if selected the same way as cotizador — check its query select and add `ticket: { select: { ticketCode: true } }` if missing).
- `src/components/tickets/ticket-documents-panel.tsx` and `src/components/tickets/ticket-controls.tsx` (PreviewRow usages, added in the `77d334d` commit this session) — these already have `ticketCode` in scope (they're rendered inside a single ticket's page) and `quoteId` per-document if the query selects it.
- `src/components/cashflow/job-accordion.tsx` if it renders a `DocumentQuickPreview` for a linked propuesta (check with the same grep).

For each caller found by the grep that does NOT already select `quoteId`/`ticket.ticketCode` in its Prisma query, add those fields to the `select` — do not guess, read each file's query first.

- [ ] **Step 7: Wire into `download-pdf-button.tsx`**

```ts
// Add ticketCode prop
export function DownloadPdfButton({ data, ticketCode }: { data: QuoteData; ticketCode?: string | null }) {
```

Import `buildDownloadFilename` and replace:

```ts
      a.download = `propuesta.pdf`
```

with:

```ts
      a.download = buildDownloadFilename({ kind: 'presupuesto', number: data.quoteId, ticketCode })
```

- [ ] **Step 8: Pass `ticketCode` from `quote-editor.tsx`**

```tsx
            <DownloadPdfButton data={data} />
```

becomes:

```tsx
            <DownloadPdfButton data={data} ticketCode={selectedTicket?.ticketCode} />
```

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run test:unit`
Expected: all clean.

- [ ] **Step 10: Live check**

Open a saved propuesta linked to a real ticket via `DocumentQuickPreview` and via the editor's `DownloadPdfButton`; confirm the downloaded file name matches `PRESUPUESTO_{quoteId}_{ticketCode}.pdf` in both cases. Repeat for an informe (`INFORME_TECNICO_{ticketCode}.pdf`, no number).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(files): consistent PRESUPUESTO/FACTURA/OC/INFORME_TECNICO_ID download filenames"
```

**Deliberately deferred** (documented, not silently dropped): `FACTURA_`/`OC_` naming for `Job.invoiceFileUrl`/`purchaseOrderFileUrl` downloads (`InstallmentDocButton` in `installment-list.tsx`, and the equivalent for single-payment jobs in `job-accordion.tsx`) is the same pattern applied to a part of the codebase not touched by this plan — same `buildDownloadFilename()` helper, just needs the `filename=` param threaded into wherever those components call `/api/files?...&download=1`. Not started here; flag as a follow-up gap-register item at the end of this plan (Task 8's Step 5).

---

## Task 6: Ticket-code generation rewrite — client-safe prefix builder + server-only sequence generator

**Files:**
- Modify: `src/lib/tickets/ticket-code.ts` (strip to pure, client-safe prefix builder)
- Create: `src/lib/tickets/ticket-code-server.ts` (new: async sequence + retry, server-only)
- Create: `tests/unit/ticket-code.test.ts`

**Interfaces:**
- Produces (client-safe, `ticket-code.ts`): `ticketModalityCode(processFlow: 'pre_quote' | 'post_execution'): 'CP' | 'EM'`, `ticketCodePrefix(opts: { clientPrefix: string; branchName: string; processFlow: 'pre_quote' | 'post_execution'; date?: Date }): string` — returns e.g. `260805-HAPP-ALTOLASCONDES-CP`.
- Produces (server-only, `ticket-code-server.ts`): `createTicketWithUniqueCode<T>(prefix: string, create: (code: string) => Promise<T>): Promise<T>` — same call shape as the function it replaces, so callers barely change.

- [ ] **Step 1: Write the failing test for the prefix builder**

```ts
// tests/unit/ticket-code.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ticketModalityCode, ticketCodePrefix } from '../../src/lib/tickets/ticket-code.ts'

test('ticketModalityCode: pre_quote -> CP, post_execution -> EM', () => {
  assert.equal(ticketModalityCode('pre_quote'), 'CP')
  assert.equal(ticketModalityCode('post_execution'), 'EM')
})

test('ticketCodePrefix: formato YYMMDD-CLIENTE-SUCURSAL-MODALIDAD', () => {
  const prefix = ticketCodePrefix({
    clientPrefix: 'Happyland',
    branchName: 'Alto Las Condes',
    processFlow: 'pre_quote',
    date: new Date(2026, 7, 5), // 5 de agosto de 2026 (mes 0-indexado)
  })
  assert.equal(prefix, '260805-HAPP-ALTOLASCONDES-CP')
})

test('ticketCodePrefix: emergencia usa EM', () => {
  const prefix = ticketCodePrefix({
    clientPrefix: 'Just Burger', branchName: 'La Reina', processFlow: 'post_execution',
    date: new Date(2026, 7, 5),
  })
  assert.equal(prefix, '260805-JUST-LAREINA-EM')
})

test('ticketCodePrefix: normaliza tildes/ñ y trunca igual que antes', () => {
  const prefix = ticketCodePrefix({
    clientPrefix: 'Peñaflor', branchName: 'Cerrajería Ñuñoa', processFlow: 'pre_quote',
    date: new Date(2026, 7, 5),
  })
  assert.equal(prefix, '260805-PENA-CERRAJERIANUNO-CP') // 4 letras cliente, 10 sucursal — mismos límites que buildTicketCode original
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/ticket-code.test.ts`
Expected: FAIL — `ticketModalityCode`/`ticketCodePrefix` don't exist yet.

- [ ] **Step 3: Rewrite `src/lib/tickets/ticket-code.ts`**

Replace the entire file:

```ts
// Prefijo de referencia del ticket: [YYMMDD]-[CLIENTE]-[SUCURSAL]-[CP|EM].
// El correlativo real ({prefix}{seq}) se calcula server-side, en
// ticket-code-server.ts — este archivo se importa desde un componente
// cliente (new-ticket-form.tsx, solo para la preview) y por eso NUNCA debe
// importar el cliente de Prisma (arrastra `node:module` al bundle del
// navegador y rompe el build de Turbopack).
//
// CP/EM = modalidad comercial (Ticket.processFlow, ya existente — informe
// #2): pre_quote exige propuesta aprobada antes de ejecutar, post_execution
// ejecuta primero y valoriza después. Reemplaza el esquema anterior
// (urgencia + sufijo -2/-3 en colisión) — la urgencia sigue existiendo como
// campo (Ticket.urgency), simplemente ya no participa en el código.

export function ticketModalityCode(processFlow: 'pre_quote' | 'post_execution'): 'CP' | 'EM' {
  return processFlow === 'pre_quote' ? 'CP' : 'EM'
}

function normalize(input: string, max: number): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max)
}

export function ticketCodePrefix(opts: {
  clientPrefix: string
  branchName: string
  processFlow: 'pre_quote' | 'post_execution'
  date?: Date
}): string {
  const date = opts.date ?? new Date()
  const yy = String(date.getFullYear()).slice(2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const prefix = normalize(opts.clientPrefix, 4)
  const suc = normalize(opts.branchName, 10)
  return `${yy}${mm}${dd}-${prefix}-${suc}-${ticketModalityCode(opts.processFlow)}`
}

export function clientTicketPrefix(client: { portalSlug: string | null; name: string }): string {
  return client.portalSlug ?? client.name.split(' ')[0]
}
```

Note: `clientTicketPrefix` is kept as-is (unchanged, still client-safe, still has its 3 real callers).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/ticket-code.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Write `src/lib/tickets/ticket-code-server.ts` (no test — thin DB wrapper, same shape as `generateJobCodeWithRetry`, already covered by that established pattern; verified live in Task 7/8 instead)**

```ts
import { prisma } from '@/lib/prisma'

const MAX_CODE_ATTEMPTS = 5

// Correlativo real por prefijo (fecha+cliente+sucursal+modalidad) — MAX
// existente con ese prefijo exacto + 1. Reemplaza el esquema anterior
// (código completo calculado client-side, colisión resuelta apendizando
// "-2"/"-3") por el mismo patrón ya usado en generateJobCode() para Job.code:
// se recalcula desde la DB real en cada intento, nunca se confía en un
// contador en memoria. Turso/libSQL resuelve la escritura concurrente por
// MVCC (BEGIN CONCURRENT) — el create real contra el `ticketCode` único es
// lo único que no miente, por eso el reintento es sobre el P2002 real, no
// sobre un check previo.
async function nextTicketCode(prefix: string): Promise<string> {
  const existing = await prisma.ticket.findMany({ where: { ticketCode: { startsWith: prefix } }, select: { ticketCode: true } })
  const seq = existing.reduce((max, t) => Math.max(max, Number(t.ticketCode.slice(prefix.length)) || 0), 0) + 1
  return `${prefix}${seq}`
}

export async function createTicketWithUniqueCode<T>(
  prefix: string,
  create: (code: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    const code = await nextTicketCode(prefix)
    try {
      return await create(code)
    } catch (e) {
      const isCodeConflict = typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002'
      if (!isCodeConflict || attempt === MAX_CODE_ATTEMPTS) throw e
    }
  }
  throw new Error('unreachable')
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — this WILL fail at this point because `tickets/actions.ts` and `portal/[slug]/tickets/actions.ts` still import the old `buildTicketCode`/`createTicketWithUniqueCode` from `ticket-code.ts`, which no longer export them. That's expected — Tasks 7 and 8 fix those call sites. Confirm the errors are ONLY in those two files (plus `new-ticket-form.tsx`) before moving on:

Run: `npx tsc --noEmit 2>&1 | grep -E "actions\.ts|new-ticket-form"`

- [ ] **Step 7: Commit**

```bash
git add src/lib/tickets/ticket-code.ts src/lib/tickets/ticket-code-server.ts tests/unit/ticket-code.test.ts
git commit -m "refactor(tickets): split ticket-code.ts into a client-safe prefix builder + server-only real-sequence generator"
```

(Committing here is safe even though the build is red — the next two tasks fix the callers and the whole thing is one logical unit landing together before it ever reaches `main`. If your workflow requires green-at-every-commit, squash Tasks 6-8 into one commit instead.)

---

## Task 7: Wire the new generator into internal ticket creation

**Files:**
- Modify: `src/app/(app)/tickets/actions.ts` (`createTicket`)
- Modify: `src/components/tickets/new-ticket-form.tsx` (preview only, drop the authoritative `ticketCode` FormData field)

**Interfaces:**
- Consumes: `ticketCodePrefix()`, `ticketModalityCode()` (client-safe, Task 6), `createTicketWithUniqueCode()` (server-only, Task 6).

- [ ] **Step 1: Update `createTicket()` in `tickets/actions.ts`**

Change the import:

```ts
import { createTicketWithUniqueCode } from '@/lib/tickets/ticket-code'
```

to:

```ts
import { ticketCodePrefix, clientTicketPrefix } from '@/lib/tickets/ticket-code'
import { createTicketWithUniqueCode } from '@/lib/tickets/ticket-code-server'
```

Remove `ticketCode` from `createSchema` — the client no longer supplies it (mirrors how the portal already never trusted a client-supplied code):

```ts
const createSchema = z.object({
  ticketCode: z.string().min(1),
```

becomes:

```ts
const createSchema = z.object({
```
(delete the `ticketCode` line entirely)

In `createTicket()`, remove `ticketCode: fd.get('ticketCode'),` from the `createSchema.parse({...})` call.

The `clientRecord` fetch currently only selects `portalSlug` — extend it to also fetch `name` (needed for `clientTicketPrefix`) and look up the branch too:

```ts
  // Fetch client slug for R2 folder key
  const clientRecord = await prisma.client.findUnique({
    where: { id: parsed.clientId },
    select: { portalSlug: true },
  })
```

becomes:

```ts
  const [clientRecord, branchRecord] = await Promise.all([
    prisma.client.findUnique({ where: { id: parsed.clientId }, select: { portalSlug: true, name: true } }),
    parsed.branchId ? prisma.branch.findUnique({ where: { id: parsed.branchId }, select: { name: true } }) : Promise.resolve(null),
  ])
  if (!clientRecord) throw new Error('Cliente no encontrado.')
```

Replace the `createTicketWithUniqueCode` call:

```ts
  const ticket = await createTicketWithUniqueCode(ticketData.ticketCode, (code) =>
```

with:

```ts
  const prefix = ticketCodePrefix({
    clientPrefix: clientTicketPrefix({ portalSlug: clientRecord.portalSlug, name: clientRecord.name }),
    branchName: branchRecord?.name ?? 'SUCURSAL',
    processFlow: ticketData.processFlow,
  })
  const ticket = await createTicketWithUniqueCode(prefix, (code) =>
```

(`ticketData` still has `processFlow` — it comes from `parsed`, which still includes it, unchanged from before.)

- [ ] **Step 2: Update `new-ticket-form.tsx`'s preview**

```ts
import { buildTicketCode, clientTicketPrefix } from '@/lib/tickets/ticket-code'
```

becomes:

```ts
import { ticketCodePrefix, clientTicketPrefix } from '@/lib/tickets/ticket-code'
```

```ts
  // Auto-build ticket code preview
  const branchName = branches.find(b => b.id === branchId)?.name ?? 'SUCURSAL'
  const codePreview = buildTicketCode(urgency, branchName, selectedClient ? clientTicketPrefix(selectedClient) : 'CLIENTE')
```

becomes:

```ts
  // Preview del prefijo — el correlativo real (el número final) se asigna
  // server-side al crear, nunca acá (createTicket ya no confía en un código
  // calculado por el cliente).
  const branchName = branches.find(b => b.id === branchId)?.name ?? 'SUCURSAL'
  const codePreview = ticketCodePrefix({
    clientPrefix: selectedClient ? clientTicketPrefix(selectedClient) : 'CLIENTE',
    branchName,
    processFlow,
  })
```

Remove the line that sent it as an authoritative value:

```ts
    fd.set('ticketCode', codePreview)
```

Delete this line entirely — the server now computes the real code, this field is never read anymore.

Update the preview label to make clear the shown value is a prefix, not the final code (find the `Código generado:` block):

```tsx
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
        <span className="text-xs text-gray-400">Código generado: </span>
        <span className="font-mono text-xs text-gray-600">{codePreview}</span>
      </div>
```

becomes:

```tsx
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
        <span className="text-xs text-gray-400">Prefijo del código (el número final se asigna al guardar): </span>
        <span className="font-mono text-xs text-gray-600">{codePreview}N</span>
      </div>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -E "actions\.ts|new-ticket-form"`
Expected: no output (the errors from Task 6 Step 6 are now resolved for these two files).

Run: `npx tsc --noEmit && npm run lint`
Expected: clean overall (portal files still fail — that's Task 8).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/tickets/actions.ts src/components/tickets/new-ticket-form.tsx
git commit -m "feat(tickets): internal ticket creation uses the real server-side sequence generator"
```

---

## Task 8: Wire the new generator into portal ticket creation + require modalidad

**Files:**
- Modify: `src/app/portal/[slug]/tickets/actions.ts` (`createPortalTicket`)
- Modify: `src/components/tickets/portal-new-ticket-form.tsx` (add required Modalidad selector)

**Interfaces:**
- Consumes: `ticketCodePrefix()`, `clientTicketPrefix()` (Task 6, unchanged export), `createTicketWithUniqueCode()` (server-only, Task 6).

- [ ] **Step 1: Update `createPortalTicket()`**

```ts
import { buildTicketCode, clientTicketPrefix, createTicketWithUniqueCode } from '@/lib/tickets/ticket-code'
```

becomes:

```ts
import { ticketCodePrefix, clientTicketPrefix } from '@/lib/tickets/ticket-code'
import { createTicketWithUniqueCode } from '@/lib/tickets/ticket-code-server'
```

Read `processFlow` from the form data alongside the other fields:

```ts
  const urgency       = String(fd.get('urgency') ?? 'no_urgente')
```

add right after:

```ts
  const processFlowRaw = String(fd.get('processFlow') ?? '')
  const processFlow = processFlowRaw === 'pre_quote' || processFlowRaw === 'post_execution' ? processFlowRaw : null
  if (!processFlow) return { success: false }
```

Replace the code computation:

```ts
  const ticketCode = buildTicketCode(urgency, branch?.name ?? 'SUCURSAL', clientTicketPrefix(client))
```

with:

```ts
  const prefix = ticketCodePrefix({
    clientPrefix: clientTicketPrefix(client),
    branchName: branch?.name ?? 'SUCURSAL',
    processFlow,
  })
```

Update the create call:

```ts
  const ticket = await createTicketWithUniqueCode(ticketCode, (code) =>
    prisma.ticket.create({
      data: {
        ticketCode: code,
        title,
        description,
        clientComment,
        urgency: urgency as TicketUrgency,
        category,
        status: ticketStatus,
        clientId,
        branchId,
        tenantId: client.tenantId,
        createdById,
        folderKey: ticketFolderKey(clientTicketPrefix(client), code),
      },
    }),
  )
```

Change only the first line and add `processFlow` to the `data`:

```ts
  const ticket = await createTicketWithUniqueCode(prefix, (code) =>
    prisma.ticket.create({
      data: {
        ticketCode: code,
        title,
        description,
        clientComment,
        urgency: urgency as TicketUrgency,
        category,
        processFlow,
        status: ticketStatus,
        clientId,
        branchId,
        tenantId: client.tenantId,
        createdById,
        folderKey: ticketFolderKey(clientTicketPrefix(client), code),
      },
    }),
  )
```

- [ ] **Step 2: Add the required Modalidad selector to `portal-new-ticket-form.tsx`**

Mirror the existing `Urgencia` radio-group pattern exactly. Add state:

```ts
  const [urgency, setUrgency] = useState('no_urgente')
```

add right after:

```ts
  const [processFlow, setProcessFlow] = useState<'pre_quote' | 'post_execution'>('pre_quote')
```

Add a new options array near `URGENCIES`, worded for the client (not internal jargon):

```ts
const MODALIDADES = [
  { value: 'pre_quote',      label: 'Necesito cotización primero', desc: 'Quieres el precio antes de que vayamos a resolverlo' },
  { value: 'post_execution', label: 'Es urgente, resuelvan y después vemos el costo', desc: 'Autorizas que vayamos primero, la valorización llega después' },
]
```

Insert a new form section right after the `{/* Urgencia */}` block, same visual pattern (radio cards):

```tsx
      {/* Modalidad comercial */}
      <div>
        {label('¿Cómo prefieres avanzar?', true)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {MODALIDADES.map(m => (
            <label key={m.value} style={{
              display: 'flex', flexDirection: 'column', gap: '3px',
              padding: '10px 12px', borderRadius: '9px', cursor: 'pointer',
              border: `1.5px solid ${processFlow === m.value ? primary : BORDER}`,
              background: processFlow === m.value ? `color-mix(in srgb, ${primary} 8%, white)` : bg,
              transition: 'all 0.12s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="radio" name="processFlow" value={m.value} checked={processFlow === m.value}
                  onChange={() => setProcessFlow(m.value as 'pre_quote' | 'post_execution')} style={{ accentColor: primary, margin: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: textColor }}>{m.label}</span>
              </div>
              <span style={{ fontSize: '11px', color: T3, paddingLeft: '18px' }}>{m.desc}</span>
            </label>
          ))}
        </div>
      </div>
```

`processFlow` is sent automatically via the `name="processFlow"` radio input inside the `<form>` — `new FormData(e.currentTarget)` in `handleSubmit` already picks up every named field, no extra `fd.set(...)` needed (confirm by checking `handleSubmit`'s current body — it only explicitly sets `clientId`/`createdById`, everything else rides on the native form serialization).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: fully clean now (last two files with pending errors from Task 6 are fixed).

Run: `npm run test:unit`
Expected: all pass, including the new `ticket-code.test.ts`/`file-naming.test.ts` (`assignQuoteNumber` has no unit test — see Task 2's note — it's covered by this task's live check below).

- [ ] **Step 4: Live check — both creation paths**

Internal: `/tickets/new`, create a ticket with modalidad "Cotización previa" for a real client/branch — confirm the resulting `ticketCode` matches `{YYMMDD}-{CLIENTE}-{SUCURSAL}-CP1` (or higher N if one already exists for that exact prefix today); create a second one for the same client/branch/day/modalidad, confirm it gets `...CP2`; create one with "Emergencia" modalidad, confirm it gets `...EM1` (independent sequence, not `CP3`).

Portal: as a portal client user, open the "new ticket" flow, confirm the new "¿Cómo prefieres avanzar?" selector is required and defaults sensibly; submit one of each modalidad, confirm the same prefix+sequence behavior.

- [ ] **Step 5: Add the deferred file-naming gap to `docs/architecture/GAP_REGISTER.md`**

Insert a new entry (find the current highest `G##`, increment by 1) documenting: OC/Factura download filenames for `Job.purchaseOrderFileUrl`/`invoiceFileUrl` still use whatever ad-hoc naming `installment-list.tsx`/`job-accordion.tsx` already had — same `buildDownloadFilename()` helper from Task 5 applies, just not wired into those two files in this pass. Follow the register's established dense-narrative format (see any existing `| G## | ... |` row for the exact shape).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(tickets): portal ticket creation requires modalidad comercial, uses the real sequence generator"
```

---

## Task 9: Propuestas listing — column reorder + Sucursal filter + checkbox selection state

**Files:**
- Create: `src/components/cashflow/branch-filter.tsx`
- Modify: `src/app/(app)/cotizador/page.tsx` (query, columns, filter bar — this becomes a client component wrapper for the table body to hold selection state, see Step 4)

**Interfaces:**
- Produces: `BranchFilter({ branches, basePath }: { branches: { id: string; name: string }[]; basePath?: string })`.

- [ ] **Step 1: Write `BranchFilter`, mirroring `ClientFilter` exactly**

```tsx
// src/components/cashflow/branch-filter.tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export function BranchFilter({
  branches,
  basePath = '/cotizador',
}: {
  branches: { id: string; name: string }[]
  basePath?: string
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const current = sp.get('sucursal') ?? ''
  return (
    <select
      aria-label="Filtrar por sucursal"
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(sp.toString())
        const v = e.target.value
        if (v) params.set('sucursal', v); else params.delete('sucursal')
        params.delete('page')
        const qs = params.toString()
        router.push(qs ? `${basePath}?${qs}` : basePath)
      }}
      className="cursor-pointer rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      <option value="">Todas las sucursales</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: Extend the `/cotizador` query for Sucursal**

In `src/app/(app)/cotizador/page.tsx`, add `sucursal` to the `searchParams` type and destructure it:

```ts
    cliente?: string; estado?: string; ticket?: string; desde?: string; hasta?: string; page?: string
    numero?: string
```

becomes:

```ts
    cliente?: string; estado?: string; ticket?: string; desde?: string; hasta?: string; page?: string
    numero?: string; sucursal?: string
```

Add the filter to `where` (filters through the linked ticket's branch):

```ts
    ...(sp.numero ? { quoteId: { contains: sp.numero } } : {}),
```

add right after:

```ts
    ...(sp.sucursal ? { ticket: { branchId: sp.sucursal } } : {}),
```

Add `branch` to the `ticket` select so the new column can render it:

```ts
        ticket: { select: { id: true, ticketCode: true, processFlow: true } },
```

becomes:

```ts
        ticket: { select: { id: true, ticketCode: true, processFlow: true, branch: { select: { name: true } } } },
```

Fetch the branches list alongside `clients` (same `Promise.all`):

```ts
  const [total, docs, clients] = await Promise.all([
```

becomes:

```ts
  const [total, docs, clients, branches] = await Promise.all([
```

and add a 4th promise:

```ts
    prisma.branch.findMany({ where: tenantScope(actor), select: { id: true, name: true }, orderBy: { name: 'asc' } }),
```

Update the `qs()` helper and `hasFilters` to include `sucursal`:

```ts
    if (sp.numero) p.set('numero', sp.numero)
```

add right after:

```ts
    if (sp.sucursal) p.set('sucursal', sp.sucursal)
```

```ts
  const hasFilters = !!(sp.cliente || estado || sp.ticket || sp.numero || sp.desde || sp.hasta)
```

becomes:

```ts
  const hasFilters = !!(sp.cliente || estado || sp.ticket || sp.numero || sp.sucursal || sp.desde || sp.hasta)
```

Add the `BranchFilter` to the `FilterBar`, right after `QuoteNumberFilter`:

```tsx
          <Suspense fallback={null}>
            <QuoteNumberFilter basePath="/cotizador" />
          </Suspense>
```

add right after:

```tsx
          <Suspense fallback={null}>
            <BranchFilter branches={branches} basePath="/cotizador" />
          </Suspense>
```

Import it: `import { BranchFilter } from '@/components/cashflow/branch-filter'`.

- [ ] **Step 3: Reorder columns and add Sucursal**

Replace the `<THead>` row:

```tsx
          <Tr>
            <Th>Propuesta</Th>
            <Th>Cliente</Th>
            <Th>Ticket</Th>
            <Th>PP/ED</Th>
            <Th>Estado</Th>
            <Th className="text-right">Monto</Th>
            <Th>Creada</Th>
            <Th>Por</Th>
          </Tr>
```

with the order from the spec (Selector added in Task 10, alongside the DOC trigger — this step handles the column shape, Task 10 adds the checkbox column itself):

```tsx
          <Tr>
            <Th>Documento</Th>
            <Th>N° presupuesto</Th>
            <Th>Cliente</Th>
            <Th>Sucursal</Th>
            <Th>Fecha</Th>
            <Th>Ticket asociado</Th>
            <Th>PP/ED</Th>
            <Th>Estado</Th>
            <Th className="text-right">Monto</Th>
          </Tr>
```

(`Creada`/`Por` collapse: "Creada" is renamed "Fecha" and moved earlier per the spec's exact column order; "Por" — creado por — is dropped from its own column and shown as secondary text under Cliente instead, since the spec's 8-column layout has no room for it and didn't ask for it. Don't delete the data from the query, just stop rendering it as its own `<Th>`/`<Td>` — keep `createdBy` in the `select` in case Task 10 wants it in a tooltip.)

Update the matching `<Tr>` body to match (N° presupuesto gets its own column instead of living as secondary text under Documento — Sucursal is new):

```tsx
              <Tr key={d.id}>
                <Td>
                  <DocumentQuickPreview docId={d.id} title={d.title} documentType="propuesta" editHref={`/cotizador?docId=${d.id}`} ticketCode={d.ticket?.ticketCode} number={d.quoteId} />
                </Td>
                <Td className="tabular-nums">{d.quoteId ?? <span className="text-gray-300">—</span>}</Td>
                <Td>{d.client.name}</Td>
                <Td>{d.ticket?.branch?.name ?? <span className="text-gray-300">—</span>}</Td>
                <Td className="text-gray-500">{d.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</Td>
                <Td>
                  {d.ticket ? (
                    <Link href={`/tickets/${d.ticket.id}`} className="text-brand hover:underline">{d.ticket.ticketCode}</Link>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td>
                  {d.ticket?.processFlow ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PROCESS_FLOW_COLORS[d.ticket.processFlow] ?? 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                      {PROCESS_FLOW_LABELS[d.ticket.processFlow] ?? d.ticket.processFlow}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td>
                  {d.proposalStatus ? (
                    <Badge {...PROPOSAL_STATUS_BADGE[d.proposalStatus]}>{PROPOSAL_STATUS_LABELS[d.proposalStatus]}</Badge>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td className="text-right tabular-nums">{d.displayAmount ? formatMoney(d.displayAmount, d.displayCurrency) : '—'}</Td>
              </Tr>
```

Update `colSpan={8}` on `TableEmptyRow` to `colSpan={9}` (9 columns now, checkbox column added next in Task 10 makes it 10 — Task 10 updates this again).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Live check**

Open `/cotizador`, confirm: columns appear in the new order with Sucursal populated for propuestas linked to a ticket with a branch; the new Sucursal filter narrows results correctly for a real branch.

- [ ] **Step 6: Commit**

```bash
git add src/components/cashflow/branch-filter.tsx src/app/\(app\)/cotizador/page.tsx
git commit -m "feat(quotes): reorder Propuestas columns, add Sucursal column + filter"
```

---

## Task 10: Selection checkboxes + DOC trigger + Eliminar in the quick-preview modal

**Files:**
- Modify: `src/components/quotes/document-quick-preview.tsx` (add `onDelete`, DOC-style default trigger stays opt-in via existing `trigger` prop)
- Modify: `src/app/(app)/cotizador/page.tsx` (replace the static `<Table>` with the new interactive one)
- Create: `src/components/quotes/proposals-table.tsx` (new client component — owns `<THead>` + `<TBody>` together, since "select all" lives in the head and per-row checkboxes live in the body, both need the same `selected` state)

**Interfaces:**
- Produces: `ProposalsTable({ docs, hasFilters }: { docs: ProposalRow[]; hasFilters: boolean })` — renders the full `<THead>` (with a "select all" checkbox) + `<TBody>` (with per-row checkboxes), owns `selected: Set<string>` state. **Task 11 extends this same component in place** (adds the bulk action bar + its handlers) — it does not rename or restructure it, so no interface break between Task 10 and Task 11.
- `DocumentQuickPreview` gains an optional `onDelete?: () => void` — when provided, an "Eliminar" button appears in the modal footer; the component itself does NOT call the delete API (keeps it agnostic of the specific document type / endpoint), it just confirms and invokes the callback.

- [ ] **Step 1: Add delete support to `DocumentQuickPreview`**

Add the prop:

```ts
export function DocumentQuickPreview({
  docId, title, documentType, editHref, trigger, triggerClassName, ticketCode, number, onDelete,
}: {
  docId: string
  title: string
  documentType: 'propuesta' | 'informe'
  editHref: string
  trigger?: ReactNode
  triggerClassName?: string
  ticketCode?: string | null
  number?: string | null
  /** Cuando se pasa, agrega un botón "Eliminar" en el modal — confirma primero, nunca window.confirm (ver frontend.md), luego llama esto. El caller decide el endpoint real (propuesta vs informe puede diferir a futuro). */
  onDelete?: () => void | Promise<void>
}) {
```

Add local state for the confirm step and deleting spinner:

```ts
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
```

Add the button to the modal footer, next to the existing Descargar/Ver en grande/Editar row:

```tsx
              <Link href={editHref} className={buttonClass('primary', 'sm')}>Editar →</Link>
```

add right after (before the close `×` button):

```tsx
              {onDelete && !confirmingDelete && (
                <button type="button" onClick={() => setConfirmingDelete(true)} className={buttonClass('danger', 'sm')}>
                  Eliminar
                </button>
              )}
              {onDelete && confirmingDelete && (
                <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                  <span className="text-xs font-medium text-red-700">¿Eliminar? No se reutilizará su número.</span>
                  <button type="button" onClick={() => setConfirmingDelete(false)} className={buttonClass('ghost', 'sm')}>No</button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={async () => { setDeleting(true); await onDelete(); setDeleting(false); setOpen(false); setConfirmingDelete(false) }}
                    className={buttonClass('danger', 'sm')}
                  >
                    {deleting ? <Spinner size={12} /> : 'Sí, eliminar'}
                  </button>
                </div>
              )}
```

(Check `buttonClass` accepts a `'danger'` variant — confirmed by `.claude/rules/frontend.md`: "`Button` (variants primary/secondary/danger/ghost...)" — use it as-is, don't invent new styling.)

- [ ] **Step 2: Add "📄 DOC" as the default-available trigger style**

The `trigger`/`triggerClassName` props already exist (added in G62) — no component change needed here, just USE them at the call site in Task 9's markup. Update the `Documento` column's `DocumentQuickPreview` call in `cotizador/page.tsx`:

```tsx
                <Td>
                  <DocumentQuickPreview docId={d.id} title={d.title} documentType="propuesta" editHref={`/cotizador?docId=${d.id}`} ticketCode={d.ticket?.ticketCode} number={d.quoteId} />
                </Td>
```

becomes (moves into `ProposalsTable` in Step 3, but the trigger change is the same either way):

```tsx
                <DocumentQuickPreview
                  docId={d.id} title={d.title} documentType="propuesta" editHref={`/cotizador?docId=${d.id}`}
                  ticketCode={d.ticket?.ticketCode} number={d.quoteId}
                  trigger={<span className="inline-flex items-center gap-1">📄 DOC</span>}
                  triggerClassName="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand/20"
                  onDelete={() => deleteOne(d.id)}
                />
```

(`deleteOne` is defined in the new `ProposalsTable` component, Step 3.)

- [ ] **Step 3: Create `ProposalsTable` — owns selection state, replaces the static `<THead>`+`<TBody>` from Task 9**

`cotizador/page.tsx`'s `CotizadorPage` is a server component (uses `await requireActor()`, direct Prisma queries) — it cannot hold `useState` for selection. Move BOTH the head (needs a "select all" checkbox) and the body (needs per-row checkboxes) into one new client component that receives the already-fetched rows as a prop — head and body share the same `selected` state, so they can't be split across a server/client boundary.

**Important — HTML validity**: `Table` (`@/components/ui/table`) renders a literal `<table>` around its children. `THead`/`TBody` must be its ONLY children — anything else (like Task 11's bulk-action bar) placed as a sibling would become an invalid direct child of `<table>`, the same class of hydration bug already documented on `Modal` in this codebase (`.claude/rules/frontend.md`: "sin portal un Modal abierto dentro de una `<table>` rompe la hidratación"). So `ProposalsTable` renders `<Table>` **internally** and `page.tsx` calls it directly with no `<Table>` wrapper of its own — that leaves room for Task 11's bar to render as a sibling *above* `<Table>`, never inside it.

```tsx
// src/components/quotes/proposals-table.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Table, THead, TBody, Tr, Th, Td, TableEmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DocumentQuickPreview } from '@/components/quotes/document-quick-preview'
import { formatMoney } from '@/lib/quotes/format'
import { PROCESS_FLOW_LABELS, PROCESS_FLOW_COLORS } from '@/lib/cashflow/labels'
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_BADGE } from '@/lib/pipeline/labels'
import type { ProposalStatus } from '@/generated/prisma/enums'

export type ProposalRow = {
  id: string
  title: string
  quoteId: string | null
  createdAt: Date
  proposalStatus: ProposalStatus | null
  client: { name: string }
  ticket: { id: string; ticketCode: string; processFlow: 'pre_quote' | 'post_execution' | null; branch: { name: string } | null } | null
  displayAmount: number | null
  displayCurrency: 'CLP' | 'UF' | 'USD'
}

export function ProposalsTable({ docs, hasFilters }: { docs: ProposalRow[]; hasFilters: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === docs.length ? new Set() : new Set(docs.map((d) => d.id))))
  }

  async function deleteOne(id: string) {
    await fetch(`/api/client-documents?id=${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <>
      {/* La barra de acciones masivas (Task 11) se agrega justo acá, antes de <Table> — mismo componente, mismo `selected`, sin restructurar nada de este paso. Nunca dentro de <Table>: ver la nota de validez HTML arriba. */}
      <Table>
        <THead>
          <Tr>
            <Th>
              <input
                type="checkbox"
                checked={docs.length > 0 && selected.size === docs.length}
                onChange={toggleAll}
                className="h-4 w-4 cursor-pointer accent-brand"
                aria-label="Seleccionar todas"
              />
            </Th>
            <Th>Documento</Th>
            <Th>N° presupuesto</Th>
            <Th>Cliente</Th>
            <Th>Sucursal</Th>
            <Th>Fecha</Th>
            <Th>Ticket asociado</Th>
            <Th>PP/ED</Th>
            <Th>Estado</Th>
            <Th className="text-right">Monto</Th>
          </Tr>
        </THead>
        <TBody>
          {docs.length === 0 ? (
            <TableEmptyRow colSpan={10}>
              {hasFilters ? 'Sin resultados para estos filtros' : 'Sin propuestas creadas todavía'}
            </TableEmptyRow>
          ) : (
            docs.map((d) => (
              <Tr key={d.id}>
                <Td>
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                    className="h-4 w-4 cursor-pointer accent-brand"
                    aria-label={`Seleccionar ${d.title}`}
                  />
                </Td>
                <Td>
                  <DocumentQuickPreview
                    docId={d.id} title={d.title} documentType="propuesta" editHref={`/cotizador?docId=${d.id}`}
                    ticketCode={d.ticket?.ticketCode} number={d.quoteId}
                    trigger={<span className="inline-flex items-center gap-1">📄 DOC</span>}
                    triggerClassName="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand/20"
                    onDelete={() => deleteOne(d.id)}
                  />
                </Td>
                <Td className="tabular-nums">{d.quoteId ?? <span className="text-gray-300">—</span>}</Td>
                <Td>{d.client.name}</Td>
                <Td>{d.ticket?.branch?.name ?? <span className="text-gray-300">—</span>}</Td>
                <Td className="text-gray-500">{d.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</Td>
                <Td>
                  {d.ticket ? (
                    <Link href={`/tickets/${d.ticket.id}`} className="text-brand hover:underline">{d.ticket.ticketCode}</Link>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td>
                  {d.ticket?.processFlow ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PROCESS_FLOW_COLORS[d.ticket.processFlow] ?? 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                      {PROCESS_FLOW_LABELS[d.ticket.processFlow] ?? d.ticket.processFlow}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td>
                  {d.proposalStatus ? (
                    <Badge {...PROPOSAL_STATUS_BADGE[d.proposalStatus]}>{PROPOSAL_STATUS_LABELS[d.proposalStatus]}</Badge>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td className="text-right tabular-nums">{d.displayAmount ? formatMoney(d.displayAmount, d.displayCurrency) : '—'}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </Table>
    </>
  )
}
```

- [ ] **Step 4: Wire it into `cotizador/page.tsx`**

Replace the entire `<Table>...</Table>` block (from Task 9) with:

```tsx
      <ProposalsTable docs={docsWithAmount} hasFilters={hasFilters} />
```

(No `<Table>` wrapper here anymore — `ProposalsTable` renders its own, per the HTML-validity note above.)

Import it: `import { ProposalsTable } from '@/components/quotes/proposals-table'`.

Remove the now-unused imports from `page.tsx` that moved into `proposals-table.tsx`: `DocumentQuickPreview`, `Badge`, `formatMoney`, `PROCESS_FLOW_LABELS`/`PROCESS_FLOW_COLORS` (check if still used elsewhere in `page.tsx` first — they might not be), `PROPOSAL_STATUS_BADGE` (keep `PROPOSAL_STATUS_LABELS`, still used by the `FilterPill` loop), `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td`/`TableEmptyRow` from `@/components/ui/table` (none of these are used directly in `page.tsx` anymore — all of it now lives inside `ProposalsTable`).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Live check**

Open `/cotizador`: confirm checkboxes render and toggle; "📄 DOC" trigger opens the same modal as before with an added "Eliminar" button; clicking Eliminar shows the inline confirm (not `window.confirm`), confirms, the row disappears and the number is never reused (verify by creating a new propuesta afterward — its number should be `(deleted one's number) + 1`, per Task 2's counter design, not the deleted number itself).

- [ ] **Step 7: Commit**

```bash
git add src/components/quotes/document-quick-preview.tsx src/components/quotes/proposals-table.tsx src/app/\(app\)/cotizador/page.tsx
git commit -m "feat(quotes): checkbox selection + DOC trigger + Eliminar in the quick-preview modal"
```

---

## Task 11: Bulk action bar — download ZIP, print, delete

**Files:**
- Modify: `src/lib/zip.ts` (add `buildZipFromBuffers`)
- Create: `src/app/api/quotes/zip/route.ts`
- Modify: `src/components/quotes/proposals-table.tsx` (bulk bar UI + handlers, added to Task 10's `ProposalsTable`)

**Interfaces:**
- Produces: `buildZipFromBuffers(files: { buffer: Buffer; name: string }[]): Promise<Buffer>` (sibling to `buildZipFromR2Keys`, same `archiver` instance pattern, no R2 involved).
- `POST /api/quotes/zip` — body `{ ids: string[] }`, returns a ZIP of the selected propuestas' PDFs, each named via `buildDownloadFilename()`.

- [ ] **Step 1: Add `buildZipFromBuffers` to `zip.ts`**

```ts
/**
 * Builds a ZIP buffer from in-memory file buffers (not R2 keys) — para
 * documentos generados al vuelo (propuestas/informes, viven en dataJson,
 * no en R2). Mismo archiver que buildZipFromR2Keys, sin el paso de bajar
 * bytes de R2 porque acá ya vienen en memoria.
 */
export async function buildZipFromBuffers(files: { buffer: Buffer; name: string }[]): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 9 } })
  const chunks: Buffer[] = []
  archive.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<void>((resolve, reject) => {
    archive.on('end', resolve)
    archive.on('error', reject)
  })
  for (const file of files) archive.append(file.buffer, { name: file.name })
  archive.finalize()
  await done
  return Buffer.concat(chunks)
}
```

- [ ] **Step 2: Create `POST /api/quotes/zip`**

```ts
// src/app/api/quotes/zip/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { buildZipFromBuffers } from '@/lib/zip'
import { generateQuotePdf } from '@/lib/quotes/pdf'
import { quoteDataSchema } from '@/lib/quotes/types'
import { buildDownloadFilename } from '@/lib/tickets/file-naming'

export const runtime = 'nodejs'
// Mismo motivo que /api/quotes/generate (G59): varios renders de Chromium
// en la misma request, cold start real.
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'super' && session.user.role !== 'supervisor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as { ids?: string[] } | null
  const ids = body?.ids ?? []
  if (ids.length === 0) return NextResponse.json({ error: 'Nada seleccionado' }, { status: 400 })

  const actor = { role: session.user.role, tenantId: session.user.tenantId ?? '' }
  const docs = await prisma.clientDocument.findMany({
    where: { id: { in: ids }, type: 'propuesta', ...tenantScope(actor) },
    select: { id: true, dataJson: true, quoteId: true, ticket: { select: { ticketCode: true } } },
  })
  if (docs.length === 0) return NextResponse.json({ error: 'Sin documentos' }, { status: 404 })

  const files: { buffer: Buffer; name: string }[] = []
  const usedNames = new Set<string>()
  for (const doc of docs) {
    if (!doc.dataJson) continue
    const parsed = quoteDataSchema.safeParse(JSON.parse(doc.dataJson))
    if (!parsed.success) continue // documento legado sin todos los campos — se omite, no revienta el ZIP entero
    const pdf = await generateQuotePdf(parsed.data)
    let name = buildDownloadFilename({ kind: 'presupuesto', number: doc.quoteId, ticketCode: doc.ticket?.ticketCode })
    let i = 2
    while (usedNames.has(name)) { name = name.replace(/\.pdf$/, ` (${i}).pdf`); i++ }
    usedNames.add(name)
    files.push({ buffer: Buffer.from(pdf), name })
  }
  if (files.length === 0) return NextResponse.json({ error: 'No se pudo generar ningún PDF' }, { status: 500 })

  const zipBuffer = await buildZipFromBuffers(files)
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="Propuestas.zip"' },
  })
}
```

(Verify `generateQuotePdf` really is exported from `src/lib/quotes/pdf.ts` with this exact signature before using it — confirmed during planning via `src/app/api/quotes/generate/route.ts`'s own import; re-check with `grep -n "export.*generateQuotePdf" src/lib/quotes/pdf.ts` if anything changed.)

- [ ] **Step 3: Add the bulk action bar to `ProposalsTable` (Task 10's component — extended in place, not restructured)**

Add state and handlers above the `return`:

```ts
  const [bulkBusy, setBulkBusy] = useState<'download' | 'print' | 'delete' | null>(null)

  async function downloadSelected() {
    setBulkBusy('download')
    try {
      const res = await fetch('/api/quotes/zip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'Propuestas.zip'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally {
      setBulkBusy(null)
    }
  }

  // Impresión masiva: mismo PDF consolidado que produciría abrir cada uno y
  // usar "Imprimir" del visor del navegador — más simple que generar un PDF
  // fusionado server-side para un caso de uso que ya funciona bien así
  // (ponytail: el navegador ya sabe fusionar/paginar N pestañas de
  // impresión, no hay que reinventarlo). Reusa el mismo ZIP: el usuario
  // extrae y abre, o —más directo— cada PDF se abre en una pestaña nueva
  // lista para Ctrl+P.
  async function printSelected() {
    setBulkBusy('print')
    try {
      for (const id of selected) {
        const res = await fetch(`/api/client-documents?id=${id}`)
        if (!res.ok) continue
        const { dataJson } = await res.json()
        if (!dataJson) continue
        const pdfRes = await fetch('/api/quotes/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: dataJson,
        })
        if (!pdfRes.ok) continue
        const blob = await pdfRes.blob()
        window.open(URL.createObjectURL(blob), '_blank')
      }
    } finally {
      setBulkBusy(null)
    }
  }

  async function deleteSelected() {
    if (!confirm(`Vas a eliminar ${selected.size} propuestas comerciales. Sus números correlativos no volverán a utilizarse. ¿Deseas continuar?`)) return
    setBulkBusy('delete')
    try {
      await Promise.all([...selected].map((id) => fetch(`/api/client-documents?id=${id}`, { method: 'DELETE' })))
      setSelected(new Set())
      router.refresh()
    } finally {
      setBulkBusy(null)
    }
  }
```

Add the bar JSX inside the outer fragment, right before `<Table>` (the "select all" checkbox already landed in Task 10's `<THead>` — nothing left to add there):

```tsx
      {selected.size > 0 && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <strong className="text-sm text-amber-900">{selected.size} seleccionadas</strong>
          <div className="flex gap-2">
            <button type="button" disabled={!!bulkBusy} onClick={downloadSelected} className={buttonClass('secondary', 'sm')}>
              {bulkBusy === 'download' ? <Spinner size={12} /> : 'Descargar'}
            </button>
            <button type="button" disabled={!!bulkBusy} onClick={printSelected} className={buttonClass('secondary', 'sm')}>
              {bulkBusy === 'print' ? <Spinner size={12} /> : 'Imprimir'}
            </button>
            <button type="button" disabled={!!bulkBusy} onClick={deleteSelected} className={buttonClass('danger', 'sm')}>
              {bulkBusy === 'delete' ? <Spinner size={12} /> : 'Eliminar'}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className={buttonClass('ghost', 'sm')}>
              Limpiar selección
            </button>
          </div>
        </div>
      )}
```

This sits as a sibling of `<Table>` inside the fragment `ProposalsTable` returns (`<>{bar}<Table>...</Table></>`) — never inside `<Table>` itself (see the HTML-validity note in Task 10 Step 3).

Add the needed imports at the top of `proposals-table.tsx`: `buttonClass` from `@/components/ui/button`, `Spinner` from `@/components/ui/spinner`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run test:unit`
Expected: clean.

- [ ] **Step 5: Live check**

Select 2+ propuestas, confirm the bulk bar appears with the right count; "Descargar" produces a ZIP with correctly-named individual PDFs inside (open it, check names match `PRESUPUESTO_{number}_{ticketCode}.pdf`); "Imprimir" opens each as a separate tab ready to print; "Eliminar" shows the exact confirm copy with the real count, confirms, rows disappear, "Limpiar selección" resets the bar.

- [ ] **Step 6: Commit**

```bash
git add src/lib/zip.ts src/app/api/quotes/zip/route.ts src/components/quotes/proposals-table.tsx
git commit -m "feat(quotes): bulk download/print/delete for selected propuestas"
```

---

## Task 12: Docs update + full verification pass

**Files:**
- Modify: `CLAUDE.md` (quoteId format line)
- Modify: `docs/architecture/GAP_REGISTER.md` (close-out entry for this whole plan)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update `CLAUDE.md`**

Find:

```
- **IDs de cotización**: `ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]`. **Código de trabajo (Flujo de Caja)**:
  `YYMMDD-CLI-TT-NN` (importados: `IMP-CLI-NNNN`). Esto es el estado ACTUAL — hay una dirección
```

Replace with:

```
- **N° de presupuesto**: correlativo global de empresa (entero simple, ej. `20000`), asignado al
  guardar, configurable solo por `super` (`QuoteSequenceConfig`) — nunca editable a mano, nunca
  reutilizado. Documentos anteriores a esta convención conservan su formato viejo
  (`ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]`), ambos conviven, no se migran. **Código de ticket**:
  `[YYMMDD]-[CLIENTE]-[SUCURSAL]-[CP|EM][SEQ]` (CP=cotización previa, EM=emergencia — reusa
  `Ticket.processFlow`; secuencia real por prefijo exacto, independiente entre CP/EM). **Código de
  trabajo (Flujo de Caja)**:
  `YYMMDD-CLI-TT-NN` (importados: `IMP-CLI-NNNN`). Esto es el estado ACTUAL — hay una dirección
```

- [ ] **Step 2: Add the closing GAP_REGISTER entry**

Follow the exact format of any existing row (`| G## | **Title** (date, context)... | evidencia | evidencia | 🟢 **CERRADO.** ... |`). Summarize: what shipped (global correlativo + admin panel, ticket ID rewrite with real per-prefix sequencing + required modalidad, consistent download filenames, Propuestas listing selection/bulk actions/Sucursal), what was deliberately deferred (OC/Factura file naming for Job-level uploads — Task 8 Step 5's entry), and reference this plan's file path.

- [ ] **Step 3: Full verification pass**

Run in order, per `.claude/rules/testing.md`:

```bash
npx tsc --noEmit
npm run lint
npm run test:unit
npm run build
```

Expected: all clean. If `npm run build` fails on anything Turbopack-specific related to the `ticket-code.ts`/`ticket-code-server.ts` split (the exact failure mode the file's own comment warns about), that means something still imports `ticket-code-server.ts` from a client component — grep for it (`grep -rln "ticket-code-server" src/`) and confirm every result is a server-only file (Server Action, API route, or a file itself only imported by those).

- [ ] **Step 4: Full live walkthrough against the local mirror**

One session, no shortcuts (per `.claude/rules/testing.md`, real browser, real local data):
1. `/cotizador` — config panel (super-only), create a propuesta from a real ticket, confirm auto-assigned number, confirm field is read-only on reopen.
2. `/tickets/new` — create one ticket per modalidad, confirm the new ID format and independent CP/EM sequences.
3. Portal — create a ticket as a portal user, confirm the modalidad selector is required and the resulting ticket has the right prefix.
4. `/cotizador` listing — columns, Sucursal filter, checkbox selection, DOC trigger, individual Eliminar, bulk download/print/delete.
5. Downloaded filenames (individual + bulk) match the spec's examples exactly.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/architecture/GAP_REGISTER.md
git commit -m "docs: update ticket/quote ID format docs, close out the correlativo+ID plan"
```

---

## Self-Review Notes (for whoever executes this)

- **Spec coverage**: §1 listado columnas/orden → Task 9-10. §2 vista previa DOC/acciones → Task 10. §3 selección múltiple/masiva → Task 10-11. §4 filtros → Task 9 (Sucursal only; the rest already existed pre-plan). §5-6 configuración/reglas del correlativo → Tasks 1-4. §7 ID de tickets → Tasks 6-8. §8 nombres de archivo → Task 5 (propuesta/informe fully; OC/factura explicitly deferred, Task 8 Step 5). §9 validación → Task 12 Step 4.
- **Known scope trim, stated not hidden**: OC/Factura (`Job`-level) download filenames are NOT wired to `buildDownloadFilename()` in this plan — `installment-list.tsx`/`job-accordion.tsx` weren't read in enough depth during planning to write real, non-guessed steps for them. Flagged as a GAP_REGISTER follow-up in Task 8 Step 5, not silently dropped.
- **Task 11's `printSelected`** is a deliberately simple "open N tabs, let the browser's native print handle it" implementation instead of a server-side merged PDF — matches the spec's own permissiveness ("según la solución más compatible con el sistema actual") and avoids a new PDF-merge dependency for a rarely-used bulk action.
