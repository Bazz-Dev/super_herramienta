# Portal Staff Tickets + Mobile UX Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow INGEGAR staff to create portal tickets on behalf of clients; harden CSS vars in the portal form; fix a Date.now reference bug; add mobile preview toggle to Cotizador; add mobile list view to Cronograma.

**Architecture:** Three focused tasks, each touching ≤3 files. Tasks are independent and can be executed sequentially. No schema changes. All portal inline-style color values are hardcoded — never `var(--p-*)`.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.9, Tailwind CSS v4, Auth.js v5, Prisma 7

## Global Constraints

- UI in Spanish, code/identifiers in English.
- Portal inline styles: **NEVER** use `var(--p-*)` in inline styles — always hardcoded hex or rgba values, or props passed from server.
- `min-h-11` (44px) on all interactive touch targets — never `min-h-8` or `min-h-[44px]`.
- Prisma: all tenant-scoped queries use `tenantScope(actor)` from `src/lib/tenant.ts`. Import Prisma client only from `src/lib/prisma.ts`.
- No changes to `prisma/schema.prisma`.
- Commits: English, Conventional Commits (`feat:`, `fix:`, `chore:`).
- `src/generated/prisma/` is gitignored; import types from there via `src/lib/prisma.ts` re-exports only.
- Do NOT modify `prisma.config.ts`, `.env`, or migration files.

---

### Task 1: Allow INGEGAR staff to create portal tickets on behalf of clients + harden portal form CSS vars

**Problem being fixed:**
1. `portal/[slug]/tickets/new/page.tsx` line 21 redirects ALL staff (`super`/`supervisor`) to `/portal/${slug}/tickets`. This prevents INGEGAR from registering tickets on behalf of a client via the portal.
2. `PortalNewTicketForm` uses `var(--p-bg)`, `var(--p-text)`, `var(--p-t3)`, `var(--p-t2)` in inline styles — these may fail under dark mode OS or browser extensions (per CLAUDE.md rule).
3. The `createPortalTicket` server action hard-checks `role !== 'client'`, silently failing for staff.

**Files:**
- Modify: `src/app/portal/[slug]/tickets/new/page.tsx`
- Modify: `src/components/tickets/portal-new-ticket-form.tsx`
- Modify: `src/app/portal/[slug]/tickets/actions.ts`

**Interfaces:**
- `PortalNewTicketForm` current props: `{ slug, clientId, createdById, branches, primary }`
- `PortalNewTicketForm` new props: `{ slug, clientId, clientName, createdById, branches, primary, bg, cardBg, textColor, isStaff? }`

- [ ] **Step 1: Update `createPortalTicket` action to accept staff roles**

Replace the entire `createPortalTicket` function in `src/app/portal/[slug]/tickets/actions.ts` (lines 19–86). The new implementation:
- Accepts `super` and `supervisor` roles in addition to `client`
- For `client` role: still verifies `session.user.clientId === clientId`
- For staff roles: skips the clientId check, but verifies the client's `tenantId` matches `session.user.tenantId` (prevents INGEGAR staff from creating tickets for clients of other tenants)
- Uses a different history note for staff-created tickets

```typescript
export async function createPortalTicket(fd: FormData) {
  const session = await auth()
  const role = session?.user?.role
  const isStaff = role === 'super' || role === 'supervisor'
  const isClient = role === 'client'
  if (!session?.user || (!isStaff && !isClient)) return { success: false }

  const clientId      = String(fd.get('clientId') ?? '')
  const createdById   = String(fd.get('createdById') ?? session.user.id)
  const branchId      = String(fd.get('branchId') ?? '') || undefined
  const urgency       = String(fd.get('urgency') ?? 'no_urgente')
  const category      = String(fd.get('category') ?? '') || undefined
  const title         = String(fd.get('title') ?? '').trim()
  const description   = String(fd.get('description') ?? '') || undefined
  const clientComment = String(fd.get('clientComment') ?? '') || undefined

  if (!title || !clientId) return { success: false }

  // Client: must match their own clientId
  if (isClient && session.user.clientId !== clientId) return { success: false }

  const [branch, client] = await Promise.all([
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }) : Promise.resolve(null),
    prisma.client.findUnique({ where: { id: clientId }, select: { tenantId: true, portalSlug: true, name: true } }),
  ])
  if (!client) return { success: false }

  // Staff: can only create for clients belonging to their tenant
  if (isStaff && client.tenantId !== session.user.tenantId) return { success: false }

  const clientPrefix = client.portalSlug ?? client.name.split(' ')[0]
  const ticketCode = buildTicketCode(urgency, branch?.name ?? 'SUCURSAL', clientPrefix)

  const existing = await prisma.ticket.findUnique({ where: { ticketCode }, select: { id: true } })
  const finalCode = existing ? `${ticketCode}-${Date.now().toString(36).slice(-4)}` : ticketCode

  const ticket = await prisma.ticket.create({
    data: {
      ticketCode: finalCode,
      title,
      description,
      clientComment,
      urgency: urgency as never,
      category,
      status: 'nuevo',
      clientId,
      branchId,
      tenantId: client.tenantId,
      createdById,
    },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      userId: createdById,
      toStatus: 'nuevo',
      note: isStaff
        ? `Solicitud registrada por INGEGAR en nombre de ${client.name}`
        : 'Solicitud creada por cliente',
      isInternal: false,
    },
  })

  const urgencyLabel: Record<string, string> = { emergencia: '🚨 EMERGENCIA', urgencia: '⚠️ Urgente', no_urgente: 'Normal', preventivo: 'Preventivo' }
  await notifyTenantStaff(client.tenantId, {
    type: 'ticket_new',
    title: `Nuevo ticket — ${client.name}`,
    body: `${urgencyLabel[urgency] ?? urgency}: ${title}${branch ? ` · ${branch.name}` : ''}`,
    href: `/tickets/${ticket.id}`,
  }).catch(() => {})

  return { success: true, id: ticket.id }
}
```

- [ ] **Step 2: Update `PortalNewTicketForm` — new props, hardcoded colors, staff banner**

Replace the entire file `src/components/tickets/portal-new-ticket-form.tsx` with the following:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPortalTicket } from '@/app/portal/[slug]/tickets/actions'

interface Props {
  slug: string
  clientId: string
  clientName: string
  createdById: string
  branches: { id: string; name: string; city: string | null }[]
  primary: string
  bg: string
  cardBg: string
  textColor: string
  isStaff?: boolean
}

const URGENCIES = [
  { value: 'emergencia',  label: 'Emergencia',  desc: 'Servicio afectado, requiere atención inmediata' },
  { value: 'urgencia',    label: 'Urgente',      desc: 'Debe resolverse dentro de 24 horas' },
  { value: 'no_urgente',  label: 'Normal',       desc: 'Sin impacto crítico en operación' },
  { value: 'preventivo',  label: 'Preventivo',   desc: 'Mantención programada o chequeo rutinario' },
]

const CATEGORIES = [
  'Climatización', 'Campana extractora', 'Electricidad', 'Plomería / agua',
  'Refrigeración', 'Gas', 'Estructural / obra civil', 'Equipamiento de cocina',
  'Seguridad / CCTV', 'Iluminación', 'Otro',
]

const T2 = 'rgba(24,19,14,0.55)'
const T3 = 'rgba(24,19,14,0.40)'
const BORDER = 'rgba(24,19,14,0.15)'

export function PortalNewTicketForm({ slug, clientId, clientName, createdById, branches, primary, bg, textColor, isStaff }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [urgency, setUrgency] = useState('no_urgente')

  const inp: React.CSSProperties = {
    width: '100%', borderRadius: '9px',
    border: `1.5px solid ${BORDER}`, background: bg,
    padding: '10px 14px', fontSize: '14px', color: textColor,
    fontFamily: 'Inter, sans-serif', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = primary
    e.currentTarget.style.boxShadow = `0 0 0 3px ${primary}22`
  }
  function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = BORDER
    e.currentTarget.style.boxShadow = 'none'
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('clientId', clientId)
    fd.set('createdById', createdById)
    setError('')
    startTransition(async () => {
      const res = await createPortalTicket(fd)
      if (!res.success) { setError('Error al crear la solicitud. Inténtalo nuevamente.'); return }
      if (isStaff) {
        router.push(`/tickets/${res.id}`)
      } else {
        router.push(`/portal/${slug}/tickets/${res.id}`)
      }
    })
  }

  const label = (text: string, required?: boolean) => (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: T2, marginBottom: '6px' }}>
      {text}{required && <span style={{ color: primary, marginLeft: '3px' }}>*</span>}
    </label>
  )

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Staff banner */}
      {isStaff && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '9px', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
            <path d="M8 2L14 13H2L8 2z" fill="#f59e0b"/>
            <path d="M8 7v2.5M8 11.5v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', margin: 0 }}>Creando ticket en nombre de {clientName}</p>
            <p style={{ fontSize: '11px', color: '#b45309', margin: '3px 0 0' }}>Estás autenticado como INGEGAR. Al enviar, el ticket quedará asignado al cliente y serás redirigido a la vista interna.</p>
          </div>
        </div>
      )}

      {/* Sucursal */}
      <div>
        {label('Sucursal', true)}
        <select name="branchId" required style={inp} onFocus={focusStyle} onBlur={blurStyle}>
          <option value="">Selecciona la sucursal afectada…</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Urgencia */}
      <div>
        {label('Nivel de urgencia', true)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {URGENCIES.map(u => (
            <label key={u.value} style={{
              display: 'flex', flexDirection: 'column', gap: '3px',
              padding: '10px 12px', borderRadius: '9px', cursor: 'pointer',
              border: `1.5px solid ${urgency === u.value ? primary : BORDER}`,
              background: urgency === u.value ? `color-mix(in srgb, ${primary} 8%, white)` : bg,
              transition: 'all 0.12s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="radio" name="urgency" value={u.value} checked={urgency === u.value}
                  onChange={() => setUrgency(u.value)} style={{ accentColor: primary, margin: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: textColor }}>{u.label}</span>
              </div>
              <span style={{ fontSize: '11px', color: T3, paddingLeft: '18px' }}>{u.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Categoría */}
      <div>
        {label('Categoría del problema')}
        <select name="category" style={inp} onFocus={focusStyle} onBlur={blurStyle}>
          <option value="">Seleccionar categoría (opcional)…</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Título */}
      <div>
        {label('Título del requerimiento', true)}
        <input type="text" name="title" required placeholder="Ej: Aire acondicionado no enfría en tienda 3"
          style={inp} onFocus={focusStyle} onBlur={blurStyle} />
        <p style={{ fontSize: '11px', color: T3, marginTop: '5px' }}>Sé específico: equipo afectado + síntoma + ubicación.</p>
      </div>

      {/* Descripción */}
      <div>
        {label('Descripción detallada')}
        <textarea name="description" rows={5}
          placeholder="Describe el problema: ¿cuándo comenzó? ¿qué acciones se tomaron? ¿qué equipos o zonas están afectados?"
          style={{ ...inp, resize: 'vertical', minHeight: '100px' }}
          onFocus={focusStyle} onBlur={blurStyle} />
      </div>

      {/* Comentario del cliente */}
      <div>
        {label('Comentario adicional')}
        <textarea name="clientComment" rows={3}
          placeholder="¿Tienes algún detalle, restricción de horario, o información extra que debamos saber?"
          style={{ ...inp, resize: 'vertical', minHeight: '80px' }}
          onFocus={focusStyle} onBlur={blurStyle} />
        <p style={{ fontSize: '11px', color: T3, marginTop: '5px' }}>Opcional — solo visible para ti y el equipo INGEGAR.</p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span>
          <p style={{ fontSize: '13px', color: '#b91c1c', margin: 0, fontWeight: '500' }}>{error}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
        <button type="submit" disabled={isPending} style={{
          flex: 1, padding: '12px', background: primary, color: '#fff',
          border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: '700',
          cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1,
          fontFamily: 'Inter, sans-serif', transition: 'opacity 0.15s', minHeight: '44px',
        }}>
          {isPending ? 'Enviando solicitud…' : 'Enviar solicitud →'}
        </button>
        <a href={isStaff ? `/portal/${slug}/tickets` : `/portal/${slug}/tickets`} style={{
          padding: '12px 18px', background: bg, color: T2,
          border: `1.5px solid ${BORDER}`, borderRadius: '9px',
          fontSize: '14px', fontWeight: '600', textDecoration: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px',
        }}>
          Cancelar
        </a>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Update `portal/[slug]/tickets/new/page.tsx` — remove staff redirect, pass new props**

Replace the entire file:

```typescript
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { canViewPortal, isStaffViewing } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import { PortalNewTicketForm } from '@/components/tickets/portal-new-ticket-form'
import { resolvePortalTheme } from '@/lib/portal-theme'

export default async function PortalNewTicketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: {
      id: true, name: true, portalTheme: true,
      branches: { where: { active: true }, select: { id: true, name: true, city: true }, orderBy: { name: 'asc' } },
    },
  })
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const isStaff = isStaffViewing(session)
  const theme = resolvePortalTheme(client.portalTheme)

  const backLink = (
    <Link
      href={`/portal/${slug}/tickets`}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'rgba(24,19,14,0.55)', textDecoration: 'none', fontWeight: '500' }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Volver
    </Link>
  )

  return (
    <PortalShell
      slug={slug} clientName={client.name} userName={session!.user.name ?? 'Usuario'}
      primary={theme.primary} bg={theme.bg} cardBg={theme.card} textColor={theme.text}
      activeHref={`/portal/${slug}/tickets/new`}
      topbarTitle="Nueva solicitud"
      topbarSub="Completa el formulario para crear un requerimiento"
      topbarRight={backLink}
    >
      <div style={{ padding: '24px 28px', maxWidth: '680px' }}>
        <div className="pcard" style={{ padding: '24px 26px' }}>
          <PortalNewTicketForm
            slug={slug}
            clientId={client.id}
            clientName={client.name}
            createdById={session!.user.id}
            branches={client.branches}
            primary={theme.primary}
            bg={theme.bg ?? '#f4f3f1'}
            cardBg={theme.card ?? '#ffffff'}
            textColor={theme.text ?? '#18130e'}
            isStaff={isStaff}
          />
        </div>
      </div>
    </PortalShell>
  )
}
```

- [ ] **Step 4: Typecheck and commit**

```bash
npm run typecheck
```

Expected: 0 errors.

```bash
git add src/app/portal/ src/components/tickets/portal-new-ticket-form.tsx
git commit -m "fix(portal): allow staff to create tickets on behalf of clients; harden CSS vars in new-ticket form"
```

---

### Task 2: Fix `Date.now` reference bug + Cotizador mobile preview toggle

**Problems being fixed:**
1. `src/components/tickets/ticket-list-view.tsx` line 96: `useState<number>(Date.now)` passes the function reference as the initial state factory. This is a React quirk: when a function is passed to `useState`, React calls it as an initializer (`() => Date.now`). This means the initial value IS computed (React calls `Date.now()` on mount), so it's not a display-breaking bug — but it's confusing and could cause issues with strict mode double-invocation. Fix it to be explicit: `useState<number>(Date.now())`.

2. `src/components/quotes/quote-editor.tsx`: On mobile (< lg), the preview panel shows below the editor, taking up a lot of vertical space. Users must scroll far to reach the preview. Add a toggle button that hides/shows the preview on mobile (collapsed by default).

**Files:**
- Modify: `src/components/tickets/ticket-list-view.tsx` (1 line change)
- Modify: `src/components/quotes/quote-editor.tsx` (add `showPreview` state + toggle button + conditional wrapper)

**Interfaces:** No interface changes.

- [ ] **Step 1: Fix the `Date.now` reference bug**

In `src/components/tickets/ticket-list-view.tsx`, find line 96:
```typescript
  const [nowMs] = useState<number>(Date.now)
```
Change to:
```typescript
  const [nowMs] = useState<number>(Date.now())
```

- [ ] **Step 2: Add mobile preview toggle to QuoteEditor**

In `src/components/quotes/quote-editor.tsx`:

**2a.** Add `showPreview` state after the existing `zoom` state (around line 38):
```typescript
  const [zoom, setZoom] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
```

**2b.** Find the outer grid div (line 46):
```typescript
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
```

Add a mobile toggle button at the end of the editor column, just before the closing `</div>` of the editor column (the `<div className="flex flex-col gap-4">` div which ends just before the `{/* Preview */}` comment around line 212).

Find the line that reads `</div>` just before `{/* ---------- Preview (sticky) ---------- */}` and insert the toggle button before it:

```typescript
        {/* Mobile preview toggle — hidden on lg+ where both panels always show */}
        <div className="lg:hidden mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            {showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
          </button>
        </div>
```

**2c.** Wrap the preview panel div in a conditional. Find the existing preview panel wrapper:
```typescript
      {/* ---------- Preview (sticky) ---------- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
```
Replace with:
```typescript
      {/* ---------- Preview (sticky) ---------- */}
      <div className={`lg:sticky lg:top-6 lg:self-start ${showPreview ? 'block' : 'hidden'} lg:block`}>
```

Note: `lg:block` overrides the `hidden` class on desktop, so the preview always shows on lg+. On mobile, it shows only when `showPreview` is true.

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
```

Expected: 0 errors.

```bash
git add src/components/tickets/ticket-list-view.tsx src/components/quotes/quote-editor.tsx
git commit -m "fix(tickets): Date.now() invocation bug; feat(cotizador): mobile preview toggle"
```

---

### Task 3: Cronograma mobile — agenda list view

**Problem:** The `ScheduleCalendar` component only renders Día/Semana/Mes calendar grids, which are unusable on mobile (dense, overflowing, requires zoom/scroll). On mobile, users need a scannable list of upcoming assignments.

**Approach:** Add a mobile-only agenda list view rendered inside `ScheduleCalendar`. On `< md` breakpoints, show a list of upcoming assignments grouped by day. On `md+`, the existing calendar renders as-is. The list reuses the existing `filtered`, `byDay`, `detail`, and `setDetail` state — no new state needed. Clicking a list item opens the existing detail modal.

**Files:**
- Modify: `src/components/resources/schedule-calendar.tsx`

**Interfaces:**
- `CalendarEvent` type (already defined, no changes)
- `setDetail(event: CalendarEvent)` — existing function, reused in list items

- [ ] **Step 1: Read the full `ScheduleCalendar` file before implementing**

Read `src/components/resources/schedule-calendar.tsx` completely to understand:
- Where the main return JSX ends (the full JSX tree including Modal)
- The structure of the month/week/day renders
- How `setDetail(event)` is called on click (to wire up list items identically)
- The `ASSIGNMENT_STATUS_LABELS` and `permissionEventColor` exports from labels.ts (already imported)

- [ ] **Step 2: Add helper functions at module level (after existing helpers, before the component)**

After `function startOfWeek` definition and before `export function ScheduleCalendar`, insert:

```typescript
function formatEventTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function agendaDayLabel(isoDate: string): string {
  const d = new Date(isoDate)
  const todayKey = dayKey(new Date())
  const k = dayKey(d)
  if (k === todayKey) return 'Hoy'
  if (k === dayKey(addDays(new Date(), 1))) return 'Mañana'
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })
}
```

- [ ] **Step 3: Add `agendaGroups` useMemo to the component body**

Inside `ScheduleCalendar`, after the existing `byDay` useMemo and before `function openCreateAt`, add:

```typescript
  // Agenda: upcoming events for the next 60 days, grouped by day, for mobile list view
  const agendaGroups = useMemo(() => {
    const now = new Date()
    const limit = addDays(now, 60)
    const upcoming = filtered
      .filter((e) => new Date(e.start) <= limit)
      .sort((a, b) => a.start.localeCompare(b.start))
    const grouped = new Map<string, CalendarEvent[]>()
    for (const e of upcoming) {
      const k = dayKey(new Date(e.start))
      grouped.set(k, [...(grouped.get(k) ?? []), e])
    }
    return Array.from(grouped.entries()).map(([k, evts]) => ({ key: k, label: agendaDayLabel(evts[0].start), events: evts }))
  }, [filtered])
```

- [ ] **Step 4: Insert mobile agenda JSX inside the component's return**

Inside the main `return (...)` of `ScheduleCalendar`, find the outer wrapper div:
```typescript
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
```

After the closing `</div>` of the toolbar and before the existing calendar grid renders (month/week/day), insert the mobile agenda list. The structure should be:

```typescript
      {/* Mobile agenda list — visible only on < md; calendar renders below (hidden md:hidden) */}
      <div className="md:hidden">
        {agendaGroups.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">Sin asignaciones próximas</p>
            <button
              type="button"
              onClick={() => openCreateAt(new Date())}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-ink hover:opacity-90 transition-opacity"
            >
              + Nueva asignación
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => openCreateAt(new Date())}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-ink hover:opacity-90 transition-opacity"
              >
                + Nueva
              </button>
            </div>
            {agendaGroups.map(({ key, label, events: dayEvents }) => (
              <div key={key}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                <div className="space-y-2">
                  {dayEvents.map((evt) => (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => setDetail(evt)}
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm hover:bg-gray-50 transition-colors"
                      style={{ borderLeft: `4px solid ${permissionEventColor(evt.permissionRequested)}` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{evt.title}</p>
                          {evt.client && (
                            <p className="mt-0.5 truncate text-xs text-gray-500">{evt.client}</p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                          {ASSIGNMENT_STATUS_LABELS[evt.status] ?? evt.status}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                        <span>{formatEventTime(evt.start)} – {formatEventTime(evt.end)}</span>
                        {evt.assignees.length > 0 && (
                          <span>{evt.assignees.map((a) => a.name.split(' ')[0]).join(', ')}</span>
                        )}
                        {evt.ticketCode && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">{evt.ticketCode}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar grid — hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
        {/* existing month/week/day calendar render goes here */}
      </div>
```

**IMPORTANT:** The existing calendar grid JSX (the `{view === 'month' && ...}` / `{view === 'week' && ...}` / `{view === 'day' && ...}` blocks) must be wrapped inside `<div className="hidden md:block">`. Move all calendar grid JSX (from the first `{view === 'month' &&` to the last calendar closing brace) inside this wrapper div. The Modal component stays outside both divs (at the end, as it is now) since it's a portal/overlay.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
```

Expected: 0 errors.

```bash
git add src/components/resources/schedule-calendar.tsx
git commit -m "feat(cronograma): mobile agenda list view with upcoming assignments"
```
