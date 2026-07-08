# INGEGAR Platform v1.8.0 — Quality & Connectivity Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix 8 high-priority UX/bug issues across portal, tickets, técnico profile, quote editor, and document system.

**Architecture:** Bug fixes + UI improvements across existing modules. No new DB schema changes. No new routes except possibly a search-param driven tab on /tickets.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind v4, Prisma 7, Auth.js v5.

## Global Constraints

- UI labels in **Spanish**, code/identifiers in **English**.
- Portal components MUST use **inline styles** for structural colors — never Tailwind className for bg/border/text in portal shell/pages.
- CSS var `min-h-11` = 44px for all interactive elements (touch target rule).
- `tenantScope(actor)` on every Prisma query that needs scoping.
- Imports: Prisma client ONLY from `src/lib/prisma.ts`.
- Auth.js session: `src/auth.ts` (Node), `src/auth.config.ts` (edge).
- Do NOT change `prisma/schema.prisma` — all fixes are code-only.
- Commits: English, Conventional Commits (`fix:`, `feat:`, `refactor:`).
- After any edit: run `npm run typecheck` to confirm zero errors before committing.
- Tailwind v4: use `min-h-11` NOT `min-h-[44px]`.

---

## Task 1: Fix portal "Nueva solicitud" hidden for staff viewers

**Problem:** `portal-shell.tsx` NAV array always includes "Nueva solicitud" (`/portal/${slug}/tickets/new`). When a staff viewer (super/supervisor) clicks it, `portal/[slug]/tickets/new/page.tsx` line 21 redirects them to the tickets list — confusing UX. The sidebar item should be hidden for staff.

**Files:**
- Modify: `src/components/tickets/portal-shell.tsx`
- Modify: `src/app/portal/[slug]/dashboard/page.tsx`
- Modify: `src/app/portal/[slug]/tickets/[id]/page.tsx`
- Modify: `src/app/portal/[slug]/informes/page.tsx` (if it uses PortalShell)
- Modify: `src/app/portal/[slug]/reportes/page.tsx` (if it uses PortalShell)
- Modify: `src/app/portal/[slug]/cronograma/page.tsx` (if it uses PortalShell)

**Interfaces:**
- `portal/[slug]/tickets/page.tsx` already passes `isAdmin={isStaff}` to PortalTicketList — but NOT to PortalShell. The shell needs the same flag.
- `portal/[slug]/tickets/new/page.tsx` already calls `isStaffViewing(session)` and redirects — that logic stays as-is.

- [ ] **Step 1: Add `isAdmin` prop to PortalShell**

In `src/components/tickets/portal-shell.tsx`, add `isAdmin?: boolean` to Props interface (line ~8-21):

```tsx
interface Props {
  slug: string
  clientName: string
  userName: string
  primary: string
  bg?: string
  cardBg?: string
  textColor?: string
  activeHref: string
  children: React.ReactNode
  topbarTitle?: string
  topbarSub?: string
  topbarRight?: React.ReactNode
  isAdmin?: boolean  // ← ADD THIS
}
```

In the component destructuring (line ~65-68), add `isAdmin = false`.

In every place the NAV array is rendered (both desktop sidebar and mobile drawer), filter out "Nueva solicitud" when isAdmin:

```tsx
const visibleNav = isAdmin
  ? NAV.filter(item => !item.href(slug).endsWith('/new'))
  : NAV
```

Use `visibleNav` instead of `NAV` in both the desktop sidebar map and the mobile drawer map.

- [ ] **Step 2: Pass `isAdmin` from each portal page that uses PortalShell**

In every portal page that renders `<PortalShell ...>`:
1. Import `isStaffViewing` from `@/lib/portal-auth` (already imported in most pages)
2. Call `const isStaff = isStaffViewing(session)` 
3. Pass `isAdmin={isStaff}` to PortalShell

Pages to update: `dashboard/page.tsx`, `tickets/[id]/page.tsx`, `informes/page.tsx`, `reportes/page.tsx`, `cronograma/page.tsx`. (`tickets/page.tsx` and `tickets/new/page.tsx` already handle this correctly.)

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd "c:/Users/sehci/OneDrive/Desktop/SuperHerramienta_ingegar" && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/tickets/portal-shell.tsx src/app/portal/
git commit -m "fix(portal): hide 'Nueva solicitud' nav item for staff viewers"
```

---

## Task 2: Fix date timezone off-by-one in quotes, reports, and documents

**Problem:** `new Date('2026-06-09')` treats ISO date strings as UTC midnight. In Chile (UTC-4), this displays as June 8. Affects `src/lib/quotes/format.ts:formatDate()`, `src/app/(app)/documentos/documents-view.tsx:relDate()`, and the local `formatDate()` in `src/app/(app)/recursos/tecnicos/[id]/page.tsx`.

**Files:**
- Modify: `src/lib/quotes/format.ts`
- Modify: `src/app/(app)/documentos/documents-view.tsx`
- Modify: `src/app/(app)/recursos/tecnicos/[id]/page.tsx`

- [ ] **Step 1: Fix `formatDate` in `src/lib/quotes/format.ts`**

Replace the function body (lines 19-23) with local-date parsing:

```typescript
export function formatDate(value: string): string {
  // Parse 'YYYY-MM-DD' as local date — new Date('YYYY-MM-DD') is UTC midnight,
  // which shifts to the previous day in UTC-4 (Chile).
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  const d = ymd
    ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3])
    : new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
}
```

- [ ] **Step 2: Fix `relDate` in `src/app/(app)/documentos/documents-view.tsx`**

Find `function relDate` and apply same fix:

```typescript
function relDate(iso: string) {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const d = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(iso)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}
```

- [ ] **Step 3: Fix local `formatDate` in técnico page**

In `src/app/(app)/recursos/tecnicos/[id]/page.tsx`, find the local `formatDate` function and apply same fix:

```typescript
function formatDate(d: Date | string | null): string {
  if (!d) return '—'
  const val = d instanceof Date ? d.toISOString().slice(0, 10) : d
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(val)
  const dt = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(val)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('es-CL', { dateStyle: 'medium' })
}
```

- [ ] **Step 4: Run typecheck + commit**

```bash
npm run typecheck
git add src/lib/quotes/format.ts src/app/\(app\)/documentos/documents-view.tsx src/app/\(app\)/recursos/tecnicos/
git commit -m "fix(dates): parse YYYY-MM-DD as local date to avoid UTC timezone shift"
```

---

## Task 3: Remove "minimal" quote template + add template fallback

**Problem:** The 'minimal' template is never used in practice and causes confusion in the template selector. It should be removed. Any saved document that still has `template: 'minimal'` must fall back to 'clasico' gracefully.

**Files:**
- Modify: `src/lib/quotes/types.ts`
- Modify: `src/lib/quotes/template.ts`

- [ ] **Step 1: Remove 'minimal' from TEMPLATES in `src/lib/quotes/types.ts`**

```typescript
// Before:
export const TEMPLATES = ['clasico', 'minimal'] as const

// After:
export const TEMPLATES = ['clasico'] as const
```

Also remove the 'minimal' entries from `TEMPLATE_LABELS` and `TEMPLATE_DESCRIPTIONS`:

```typescript
export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  clasico: 'Clásico',
}
export const TEMPLATE_DESCRIPTIONS: Record<TemplateId, string> = {
  clasico: 'Bandas de sección, presentación formal',
}
```

- [ ] **Step 2: Remove `.tpl-minimal` CSS block from `src/lib/quotes/template.ts`**

Find the block (lines ~117-133) that starts with `.tpl-minimal` and delete it entirely.

Also add a fallback at the start of `renderQuoteHTML` so saved documents with template='minimal' render as 'clasico':

```typescript
export function renderQuoteHTML(data: QuoteData): string {
  // Fallback: removed templates render as clasico
  const safeData: QuoteData = { ...data, template: data.template === 'clasico' ? 'clasico' : 'clasico' }
  const totals = computeTotals(safeData)
  // ... rest of function uses safeData instead of data
```

Wait, that's too verbose. Simpler: just let `tpl-${data.template}` render with no matching CSS — the default styles (which are the clasico styles) will apply. The clasico-specific CSS is in `.tpl-clasico`, not the default. So actually:

Check how the template CSS is structured. If clasico styles are under `.tpl-clasico` only, then a document with `template: 'minimal'` (and `.tpl-minimal` removed) would have no template-specific CSS. Add a note in the CSS:

```css
/* Default (clasico) styles apply to all templates */
body { font-family: ... }
/* tpl-clasico: no override needed — clasico IS the default */
```

Simplest fix: Remove `.tpl-minimal` block. Add at start of `renderQuoteHTML`:

```typescript
const template = TEMPLATES.includes(data.template as TemplateId) ? data.template : 'clasico'
const safeData = { ...data, template }
```

Use `safeData` throughout the rest of the function (or just normalize at top level).

Actually even simpler: in the HTML output `body class="tpl-${data.template}"`, if template is still 'minimal' (legacy saved doc), it won't match `.tpl-clasico` either. So we need default styles to apply to all bodies, not just `.tpl-clasico`.

Check the template CSS structure in `template.ts` lines 1-116. The "clasico" styles might be inside `.tpl-clasico {}` selectors. If so, make the default styles apply to `body` (no class), and `.tpl-clasico` just overrides specific things.

The cleanest fix: at the top of `renderQuoteHTML`, normalize the template:

```typescript
export function renderQuoteHTML(raw: QuoteData): string {
  const data: QuoteData = {
    ...raw,
    template: raw.template === 'clasico' ? 'clasico' : 'clasico',
  }
  // ... rest unchanged
```

This ensures all rendering always uses 'clasico', regardless of stored value.

- [ ] **Step 3: Run typecheck + confirm quote editor shows only "Clásico"**

Since `quote-editor.tsx` imports `TEMPLATES` from `types.ts` and maps over it to show template selector buttons, removing 'minimal' from the array automatically removes it from the UI.

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/quotes/types.ts src/lib/quotes/template.ts
git commit -m "feat(quotes): remove minimal template, normalize to clasico for legacy docs"
```

---

## Task 4: Tickets page — mobile cards + Activos/Cerrados tabs

**Problem:** On mobile, `TicketListView` renders a horizontal-scroll table (bad UX). Closed tickets require scrolling past all active tickets. Need: (1) card layout on mobile, (2) tabs to switch between active and closed tickets.

**Files:**
- Modify: `src/components/tickets/ticket-list-view.tsx`
- Modify: `src/app/(app)/tickets/page.tsx`

**Approach:** 
- Add `closedTickets` prop to `TicketListView` (serialized closed tickets from page).
- Client-side `tab` state: 'activos' | 'cerrados'. Default 'activos'.
- On mobile: render each ticket as a card (not table row). On desktop: keep table.
- Remove separate `ClosedSection` server component from `tickets/page.tsx`; pass closed tickets directly so the tab switch is instant (no re-render needed).

- [ ] **Step 1: Update `TicketListView` — add tabs + mobile cards**

Add `ClosedTicket` interface and `closedTickets?: ClosedTicket[]` prop:

```typescript
export interface ClosedTicket {
  id: string
  ticketCode: string
  title: string
  status: string
  closedDate: string | null
  client: { name: string }
  branch: { name: string } | null
  assignedTo: { name: string } | null
  _count: { documents: number }
}
```

Add `tab` state at top of component:

```typescript
const [tab, setTab] = useState<'activos' | 'cerrados'>('activos')
```

Add tab bar at the top of the component, before the filter bar:

```tsx
{/* Tab bar */}
<div className="flex gap-1 border-b border-gray-200 pb-0">
  {(['activos', 'cerrados'] as const).map(t => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={`interactive min-h-11 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
        tab === t
          ? 'border-b-2 border-brand text-ink'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {t === 'activos' ? `Activos (${tickets.length})` : `Cerrados (${closedTickets?.length ?? 0})`}
    </button>
  ))}
</div>
```

When `tab === 'cerrados'`, show the closed tickets list (simple cards on mobile, table on desktop).

When `tab === 'activos'`, show the existing filter bar + table/cards.

**Mobile card layout** for active tickets (replace table on `md:hidden`):

```tsx
{/* Mobile cards — only on small screens */}
<div className="md:hidden space-y-2">
  {filtered.map(ticket => {
    const st = ticket.status as TicketStatusId
    const urg = ticket.urgency as TicketUrgencyId
    return (
      <Link key={ticket.id} href={`/tickets/${ticket.id}`}
        className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className="font-medium text-sm text-gray-800 line-clamp-2">{ticket.title}</span>
          <span
            className="shrink-0 inline-block h-2.5 w-2.5 rounded-full mt-1"
            style={{ background: URG_DOT[ticket.urgency] ?? '#ccc' }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[st] ?? 'bg-gray-300'}`} />
            {STATUS_LABEL[st] ?? ticket.status}
          </span>
          <span>{ticket.client.name}</span>
          {ticket.branch && <span>{ticket.branch.name}</span>}
          {ticket.assignedTo
            ? <span className="text-gray-500">{ticket.assignedTo.name.split(' ')[0]}</span>
            : <span className="font-semibold text-amber-600">Sin asignar</span>
          }
          <span className="ml-auto font-mono text-[10px] text-gray-400">{age(ticket.createdAt)}</span>
        </div>
      </Link>
    )
  })}
</div>
{/* Desktop table — hidden on mobile */}
<div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
  ... existing table ...
</div>
```

**Closed tickets tab content** (mobile cards + desktop table, same pattern):

```tsx
{tab === 'cerrados' && (
  <div>
    {/* Mobile */}
    <div className="md:hidden space-y-2">
      {(closedTickets ?? []).map(t => (
        <Link key={t.id} href={`/tickets/${t.id}`}
          className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <span className="font-medium text-sm text-gray-700 line-clamp-2">{t.title}</span>
            <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold ${t.status === 'resuelto' ? 'text-green-700' : 'text-gray-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status as TicketStatusId] ?? 'bg-gray-300'}`} />
              {STATUS_LABEL[t.status as TicketStatusId]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>{t.client.name}</span>
            {t.branch && <span>{t.branch.name}</span>}
            {t.assignedTo && <span>{t.assignedTo.name.split(' ')[0]}</span>}
            {t.closedDate && <span className="ml-auto text-[10px] text-gray-400">{new Date(t.closedDate).toLocaleDateString('es-CL')}</span>}
          </div>
        </Link>
      ))}
    </div>
    {/* Desktop table — reuse existing ClosedSection table HTML */}
    <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      ... existing closed table ...
    </div>
  </div>
)}
```

- [ ] **Step 2: Update `tickets/page.tsx` — fetch closed tickets + pass to TicketListView**

Add closed ticket query to the parallel fetch at the top:

```typescript
const [tickets, clients, users, closed] = await Promise.all([
  getTickets(actor),
  prisma.client.findMany({ ... }),
  prisma.user.findMany({ ... }),
  prisma.ticket.findMany({
    where: { tenantId: actor.tenantId, status: { in: ['resuelto', 'cancelado'] } },
    select: {
      id: true, ticketCode: true, title: true, status: true, closedDate: true,
      client: { select: { name: true } },
      branch: { select: { name: true } },
      assignedTo: { select: { name: true } },
      _count: { select: { documents: true } },
    },
    orderBy: { closedDate: 'desc' },
    take: 50,
  }),
])
```

Serialize closed tickets (convert Date → ISO string):

```typescript
const serializedClosed = closed.map(t => ({
  ...t,
  closedDate: t.closedDate ? t.closedDate.toISOString() : null,
}))
```

Pass to TicketListView:

```tsx
<TicketListView tickets={serialized} clients={clients} users={users} closedTickets={serializedClosed} />
```

Remove the `<ClosedSection actor={actor} />` line and the `ClosedSection` function entirely.

- [ ] **Step 3: Run typecheck + commit**

```bash
npm run typecheck
git add src/components/tickets/ticket-list-view.tsx src/app/\(app\)/tickets/page.tsx
git commit -m "feat(tickets): add Activos/Cerrados tabs and mobile card layout"
```

---

## Task 5: Técnico profile — connected insights + recent tickets

**Problem:** The técnico profile shows static counts without links. No recent ticket history, no upcoming assignment info. Feels dead.

**Files:**
- Modify: `src/app/(app)/recursos/tecnicos/[id]/page.tsx`
- Modify: `src/lib/resources/technicians.ts` (add recent tickets query)

**What to add:**
1. Stats cards become links (tickets stat → `/tickets` filtered, assignments stat → `/cronograma`).
2. New "Tickets recientes" section: last 5 tickets assigned to this technician (via User linkage).
3. New "Próximas asignaciones" section: next 3 upcoming assignments.
4. Status badges for tickets with meaningful labels.

- [ ] **Step 1: Add recent tickets + upcoming assignments query in the page**

In `src/app/(app)/recursos/tecnicos/[id]/page.tsx`, after the existing `ticketStats` query, add:

```typescript
// Find the User linked to this technician (for ticket queries)
const linkedUser = await prisma.user.findFirst({
  where: { technicianId: tech.id },
  select: { id: true },
})

const [recentTickets, upcomingAssignments] = linkedUser
  ? await Promise.all([
      prisma.ticket.findMany({
        where: { assignedToId: linkedUser.id, tenantId: actor.tenantId },
        select: {
          id: true, ticketCode: true, title: true, status: true, urgency: true, createdAt: true,
          client: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.assignmentAssignee.findMany({
        where: {
          technicianId: tech.id,
          assignment: {
            tenantId: actor.tenantId,
            status: { in: ['scheduled', 'in_progress'] },
            startDate: { gte: new Date() },
          },
        },
        include: {
          assignment: {
            select: {
              id: true, title: true, status: true, startDate: true, endDate: true,
              client: { select: { name: true } },
            },
          },
        },
        orderBy: { assignment: { startDate: 'asc' } },
        take: 3,
      }),
    ])
  : [[], []]
```

- [ ] **Step 2: Make stats clickable and add sections to the page**

Replace static stat cards with clickable links:

```tsx
{/* Estadísticas — linked */}
<div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
  {[
    {
      label: 'Trabajos asignados', value: assignmentStats.total,
      color: 'text-blue-600', bg: 'bg-blue-50',
      href: `/cronograma?tecnico=${tech.id}`,
    },
    {
      label: 'En agenda', value: assignmentStats.scheduled + assignmentStats.in_progress,
      color: 'text-amber-600', bg: 'bg-amber-50',
      href: `/cronograma?tecnico=${tech.id}`,
    },
    {
      label: 'Completados', value: assignmentStats.done,
      color: 'text-green-600', bg: 'bg-green-50',
      href: `/cronograma?tecnico=${tech.id}`,
    },
    {
      label: 'Tickets asignados', value: ticketStats.total,
      color: 'text-purple-600', bg: 'bg-purple-50',
      href: linkedUser ? `/tickets?usuario=${linkedUser.id}` : '/tickets',
    },
  ].map((stat) => (
    <Link key={stat.label} href={stat.href}
      className={`group rounded-xl border border-gray-200 ${stat.bg} p-3 text-center transition hover:shadow-md`}>
      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
      <p className="mt-0.5 text-xs text-gray-500 group-hover:text-gray-700">{stat.label} →</p>
    </Link>
  ))}
</div>
```

Add "Tickets recientes" section (after stats, before vehicle section):

```tsx
{recentTickets.length > 0 && (
  <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-ink">Tickets recientes</h2>
      {linkedUser && (
        <Link href={`/tickets?usuario=${linkedUser.id}`}
          className="inline-flex min-h-8 items-center text-xs text-brand-700 hover:underline">
          Ver todos →
        </Link>
      )}
    </div>
    <ul className="divide-y divide-gray-100">
      {recentTickets.map(t => (
        <li key={t.id}>
          <Link href={`/tickets/${t.id}`}
            className="flex items-center justify-between gap-3 py-2.5 hover:bg-gray-50 -mx-1 px-1 rounded transition">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{t.title}</p>
              <p className="text-xs text-gray-500">{t.client.name}{t.branch ? ` · ${t.branch.name}` : ''}</p>
            </div>
            <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${STATUS_BADGE_COLOR[t.status] ?? 'text-gray-600'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status as TicketStatusId] ?? 'bg-gray-300'}`} />
              {STATUS_LABEL[t.status as TicketStatusId] ?? t.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </div>
)}
```

Add "Próximas asignaciones" section:

```tsx
{upcomingAssignments.length > 0 && (
  <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-ink">Próximas asignaciones</h2>
      <Link href={`/cronograma?tecnico=${tech.id}`}
        className="inline-flex min-h-8 items-center text-xs text-brand-700 hover:underline">
        Ver cronograma →
      </Link>
    </div>
    <ul className="divide-y divide-gray-100">
      {upcomingAssignments.map(({ assignment }) => (
        <li key={assignment.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-800">{assignment.title}</p>
            <p className="text-xs text-gray-500">{assignment.client.name}</p>
          </div>
          <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap">
            {new Date(assignment.startDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
          </span>
        </li>
      ))}
    </ul>
  </div>
)}
```

Import `STATUS_DOT`, `STATUS_LABEL` from `@/lib/tickets/labels` at the top of the file.

Define `STATUS_BADGE_COLOR` inline:
```typescript
const STATUS_BADGE_COLOR: Record<string, string> = {
  nuevo: 'text-blue-700', en_revision: 'text-yellow-700', en_ejecucion: 'text-orange-700',
  esperando_aprobacion: 'text-purple-700', resuelto: 'text-green-700', cancelado: 'text-gray-500',
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add src/app/\(app\)/recursos/tecnicos/
git commit -m "feat(tecnicos): add linked stats, recent tickets, and upcoming assignments to profile"
```

---

## Task 6: Document preview inline in carpeta cliente

**Problem:** `documents-view.tsx` only has a "Descargar PDF" button and "Editar" button. Users can't preview document content without generating a PDF.

**Files:**
- Modify: `src/app/(app)/documentos/documents-view.tsx`

**Approach:** Add a "Vista previa" button per document. On click: 
1. Fetch the document's `dataJson` via `GET /api/client-documents?id=xxx`.
2. Render the HTML (via `renderQuoteHTML` or `renderReportHTML`) in a fullscreen modal with an iframe.
3. The preview button replaces the current icon-only PDF button pattern.

Since `documents-view.tsx` is a client component and `renderQuoteHTML`/`renderReportHTML` run in Node (they import heavy libs), we need to either:
- Option A: Call the API to get HTML (hit `/api/quotes/generate` endpoint for HTML-only mode)
- Option B: Inline the HTML generation client-side (if safe)

**Simplest option**: Use an `<iframe>` that loads the PDF route with a `preview=1` param that returns HTML instead of PDF. BUT that requires API changes.

**Even simpler**: The `dataJson` fetched is the quote/report data. Import and run `renderQuoteHTML(data)` client-side in the browser — both functions are pure string-manipulation, no heavy deps in the browser. They import from `src/lib/quotes/template.ts` which is pure TS.

Actually `renderQuoteHTML` is already used in the `QuotePreview` client component for the live preview iframe. So we CAN use it client-side.

**Implementation:**

1. In `documents-view.tsx`, import `renderQuoteHTML` from `@/lib/quotes/template` and `renderReportHTML` from `@/lib/reports/template`.
2. Add `previewDoc` state: `{ html: string; title: string } | null`.
3. Add "Vista previa" button beside "Editar" and PDF buttons.
4. On click: fetch `GET /api/client-documents?id=xxx`, parse `dataJson`, call the appropriate render function, set `previewDoc`.
5. Render a fullscreen modal with `<iframe srcDoc={previewDoc.html}>`.

```tsx
const [previewDoc, setPreviewDoc] = useState<{ html: string; title: string } | null>(null)

async function handlePreview(docId: string, docTitle: string, docType: string) {
  const res = await fetch(`/api/client-documents?id=${docId}`)
  if (!res.ok) return
  const data = await res.json()
  const json = JSON.parse(data.dataJson)
  const html = docType === 'informe' ? renderReportHTML(json) : renderQuoteHTML(json)
  setPreviewDoc({ html, title: docTitle })
}
```

Preview modal:
```tsx
{previewDoc && (
  <div className="fixed inset-0 z-50 flex flex-col bg-gray-900/80" onClick={() => setPreviewDoc(null)}>
    <div className="flex items-center justify-between bg-white px-4 py-3 shadow" onClick={e => e.stopPropagation()}>
      <span className="text-sm font-semibold text-gray-800">{previewDoc.title}</span>
      <button onClick={() => setPreviewDoc(null)}
        className="interactive flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
        ✕
      </button>
    </div>
    <div className="flex-1 overflow-auto" onClick={e => e.stopPropagation()}>
      <iframe
        srcDoc={previewDoc.html}
        className="h-full w-full min-h-[80vh] border-0 bg-white"
        title={previewDoc.title}
      />
    </div>
  </div>
)}
```

- [ ] **Step 1: Implement preview button + modal in `documents-view.tsx`**

Add the imports, state, handler, and modal as described above.

Add "Vista previa" button to the document action group (beside Edit and PDF buttons):

```tsx
<button
  onClick={() => handlePreview(doc.id, doc.title, doc.type)}
  className="interactive inline-flex min-h-9 items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
  title="Vista previa"
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
  Vista previa
</button>
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/app/\(app\)/documentos/documents-view.tsx
git commit -m "feat(docs): add inline preview for client folder documents"
```

---

## Task 7: Cross-entity links — Ticket detail ↔ Técnico profile

**Problem:** Ticket detail shows the assigned technician's name but no link to their profile. Técnico profile (Task 5) adds recent tickets. This task adds the reverse link from the ticket to the technician.

**Files:**
- Find the ticket detail page: `src/app/(app)/tickets/[id]/page.tsx`
- Modify: add link from "assigned to" → `/recursos/tecnicos/${technician.id}`

**Also:** In the ticket detail, if the ticket has an `assignedToId` (User), find the corresponding Technician via `User.technicianId` and render a link to their profile.

- [ ] **Step 1: Read the ticket detail page**

Read `src/app/(app)/tickets/[id]/page.tsx` to find where `assignedTo` is displayed.

- [ ] **Step 2: Add technician profile link**

In the ticket detail data fetch, include the technician ID:

```typescript
// In the ticket select, ensure assignedTo includes the technician link:
assignedTo: {
  select: {
    id: true, name: true,
    technician: { select: { id: true } },  // ADD THIS
  }
}
```

In the UI where `assignedTo.name` is displayed, wrap with a Link:

```tsx
{ticket.assignedTo?.technician?.id ? (
  <Link href={`/recursos/tecnicos/${ticket.assignedTo.technician.id}`}
    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
    {ticket.assignedTo.name}
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 6h8M6 2l4 4-4 4"/>
    </svg>
  </Link>
) : (
  <span className="text-sm font-semibold text-gray-700">{ticket.assignedTo?.name ?? '—'}</span>
)}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add src/app/\(app\)/tickets/
git commit -m "feat(tickets): link assigned technician name to their profile page"
```

---

## Task 8: Portal — mobile first improvements + isAdmin nav fix verification

**Problem:** Portal pages need mobile-first polish. Also verify that after Task 1, the portal dashboard and other pages properly pass `isAdmin` to PortalShell.

**Files:**
- `src/app/portal/[slug]/dashboard/page.tsx`
- `src/app/portal/[slug]/tickets/page.tsx`

**What to check/fix:**
1. Portal dashboard KPI cards: ensure 2-column grid on mobile, 4-column on desktop.
2. Portal ticket list (PortalTicketList component): ensure mobile card view.
3. Portal dashboard "Nueva solicitud" button: hide when `isAdmin`.

Since the portal dashboard page already has good structure (from the exploration showing it has a 4-col KPI grid, bar chart, etc.), the main fixes are:
- Verify mobile responsiveness classes are correct
- Pass `isAdmin` from dashboard page to PortalShell (done in Task 1)
- The "Nueva solicitud" button in the portal dashboard topbar should also be hidden for staff

In `portal/[slug]/dashboard/page.tsx` line ~123, there's a "Nueva solicitud" button. Wrap it:

```tsx
{!isStaff && (
  <Link href={`/portal/${slug}/tickets/new`} ...>
    Nueva solicitud
  </Link>
)}
```

- [ ] **Step 1: Hide "Nueva solicitud" CTA button in portal dashboard for staff**

In `portal/[slug]/dashboard/page.tsx`, find the "Nueva solicitud" button/link near line 123 and wrap it in `{!isStaff && ...}`. The `isStaff` variable is already computed in Task 1.

- [ ] **Step 2: Check portal ticket list mobile layout**

Read `src/components/tickets/portal-ticket-list.tsx` (or wherever PortalTicketList is defined). If it uses a table, add a mobile card view similar to Task 4.

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add src/app/portal/
git commit -m "fix(portal): hide new-ticket CTA for staff, improve mobile layouts"
```
