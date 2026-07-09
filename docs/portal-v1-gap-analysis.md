# Portal V1 → V2 Gap Analysis

Analyzed: `justburger-ingegar/Index.html` (333 KB SPA) + `Código.js` vs `src/app/portal/[slug]/` + related components.
Date: 2026-07-09

---

## V1 Portal — Quick reference

### Views / pages (3 visible routes)
| View key | Client nav label | Visible to |
|---|---|---|
| `dashboard` | Panel | admin, cliente |
| `tickets` | Mis requerimientos (cliente) / Todos los tickets (admin) | all |
| `reports` | Reportes | admin, cliente |
| `config` | Configuración | admin only |

**Roles in V1:** `admin` · `cliente` · `tecnico`

### New ticket — 3-step stepper
**Step 1 "Datos básicos":** Urgencia (select) · Sucursal (select, from config) · Categoría (select, optional) · Título (text, required) · Descripción (textarea, optional)
**Step 2 "Sub-tareas":** Add N items (título + descripción each). Step is optional — client can skip.
**Step 3 "Archivos":** Drag-and-drop or click upload. Accepts `image/*, video/mp4, .pdf, .doc, .docx, .xls, .xlsx`. Max 50 MB/file. Uploaded to Google Drive (draftFolderUrl). Optional — can skip.

### Ticket detail — blocks rendered
1. Header (ID, title, status, sucursal, urgencia, OT Número, fecha estimada)
2. Sub-tareas / Items (progress list; client can add items if status ≠ `en_ejecucion`)
3. Avances (progress log by admin/tecnico; shows date, tecnico name, OT, resumen visible al cliente)
4. Notas internas (admin-only internal notes, hidden from cliente)
5. Ejecución (assign tecnico, OT, fecha estimada — admin only)
6. Chat (full threaded chat with bubbles per role; clients can send text + file attachments; system events shown as neutral messages)

### Chat system
- WhatsApp-style bubbles: `right` = current user, `left` = other party, `sys` = system events
- `.chat-col.tecnico` styled separately (cyan tint)
- File attachments inside chat: icon, filename, filesize shown as a card
- Auto-resizing textarea; Enter to send (Shift+Enter for newline)
- File input: multiple, same accept list as step 3

### Reports view (admin only — client also has access)
- Preset buttons: Hoy · Esta semana · Este mes · Últimos 3 meses · Todo
- Date range (desde / hasta) custom inputs
- Multi-select filters: Estados · Urgencias · Sucursales
- **6 KPIs:** Total tickets · Abiertos · Tasa resolución · Tiempo Medio Resolución (days) · Cumplimiento SLA % · Fuera de plazo count
- **Charts:** Por estado (bars) · Por urgencia (bars) · Por categoría (bars) · Por sucursal (bars) · Rendimiento por técnico (table: total, resueltos, tasa, TMR)
- **Export:** Print (window.print) · CSV download (ID, Título, Sucursal, Urgencia, Estado, Categoría, Técnico, Creado, Cierre)
- Shows both "en filtro" vs "total sistema" counts

### Admin dashboard KPIs (8 tiles, 2 rows)
Row 1: Hoy · En proceso · Sin abordar +24h · Emergencias
Row 2: Resueltos mes · Sucursales (count) · Vencidos · Técnicos (count)
Plus: bar chart "Tickets por mes" (6 months) + "Actividad reciente" (last 5 tickets)

### Config panel (admin only)
Tabs: Sucursales · Categorías · Urgencias · [Users]
User management: list, create, edit roles (admin / cliente / tecnico), set activo flag, associate tecnico to especialidad.
Role permissions summary card shown for reference.

### Merge tickets
Admin can select multiple tickets in the table → merge them into one.
Merged source tickets get `Source_Type = 'merge'` and display a **"fusión"** badge.
A `mergedListOpen` panel in the detail view shows the merged child tickets.

---

## V2 Portal — Quick reference

### Pages / routes (9 routes)
| Route | Nav label | Notes |
|---|---|---|
| `/portal/[slug]/dashboard` | Panel | KPIs + charts + recent tickets |
| `/portal/[slug]/tickets` | Requerimientos | list with status filter |
| `/portal/[slug]/tickets/new` | Nueva solicitud | single-page form |
| `/portal/[slug]/tickets/[id]` | (detail) | timeline history + sub-tasks + files |
| `/portal/[slug]/reportes` | Reportes | all-time stats, no date filter |
| `/portal/[slug]/informes` | Inf. Técnicos | read-only list of ClientDocument type=informe |
| `/portal/[slug]/propuestas` | Propuestas | read-only list of ClientDocument type=propuesta |
| `/portal/[slug]/cronograma` | Cronograma | client's scheduled assignments |
| `/portal/[slug]/cuenta` | Mi cuenta | change password only |

**Roles in V2 portal:** `client` · staff (super/supervisor) can view-as-client

### New ticket form (single page, no steps)
Fields: Sucursal (select, required) · Nivel de urgencia (radio with description) · Categoría (select, optional) · Título (text, required) · Descripción detallada (textarea) · Comentario adicional / clientComment (textarea)
**No file upload at creation time.**

### Ticket detail
- Visual progress stepper (Nuevo → En revisión → En ejecución → Esperando aprobación → Resuelto)
- Sub-tasks: list with progress bar; client can add items when status ∈ {`nuevo`, `en_revision`}; admin can add any time
- Edit ticket: client can edit title/description/urgency when status = `nuevo`
- Media gallery (PhotoGallery component) for images and videos
- Non-media file attachments listed separately (PDF, doc, xlsx, etc.)
- Linked informes técnicos (ClientDocument linked by ticketId)
- Timeline history (status transitions shown as from→to pill, notes as text)
- PortalCommentForm: text-only comment; visible to client when status not resolved/cancelled

### V2 Dashboard KPIs
Row: Activas (hero) · Resueltas este mes · Emergencias activas · Vencidas
Alert banner: sin abordar +24h · emergencias · vencidos (red text when any > 0)
Charts: Tickets por mes 6-month mini bar · By branch breakdown
Summary panel: total, activas, resueltas, canceladas
Recent tickets list: last 5, clickable rows

### V2 Reports
**6 KPIs:** Total · Activas · Tasa resolución % · SLA cumplimiento % · Emergencias · Vencidas
Charts: Monthly bar (6 months, total + resueltos stacked) · By urgency bars · By status bars · By sucursal table (total, activos, resueltos, % resolución)
**No date range filter. No CSV export. No print.**

---

## Features in V1 that V2 has (same or better)

| Feature | V1 | V2 | Notes |
|---|---|---|---|
| Create ticket | 3-step stepper | Single-page form | V2 is cleaner; same required fields |
| Urgency levels | Emergencia / Urgencia / No urgente / Preventivo | Same 4 mapped to enum values | V2 uses radio cards with descriptions |
| Sucursal selection | Select from config list | Select from DB branches | Equivalent |
| Category selection | Select from config list | Hardcoded CATEGORIES list | Equivalent |
| Sub-tasks in ticket | Add/view items with status | Same — PortalAddItemForm | V2 adds progress bar; same editing constraints |
| Comments from client | Chat textarea | PortalCommentForm | Same functionality, different UI |
| Status timeline visible to client | System events in chat | History timeline | V2 filters noisy events; cleaner |
| Dashboard KPIs | 8 tiles + chart | 4 tiles + chart | V2 covers the key metrics |
| Alerts for urgent items | Banner for sin abordar / emergencias | Same alerts | Equivalent |
| Reports — by status/urgency/sucursal | Yes | Yes | Same breakdown |
| Reports — tasa resolución | Yes | Yes | Same calculation |
| Reports — SLA % | Yes | Yes | Same logic |
| Per-client portal scoping | Single tenant (JB only) | Multi-tenant by slug | V2 is strictly better |
| Mobile-responsive | Yes (media queries) | Yes (Tailwind) | V2 is cleaner |
| Edit ticket when new | Yes (admin + cliente) | Yes (client when status=nuevo) | Equivalent |
| Merge ticket badge display | Shows "fusión" badge on source tickets | Filtered via `status=fusionado` | V2 hides fusionado from list; no badge |
| PWA | No | Yes — per-portal PWA, push notifications | V2 only |
| Inf. Técnicos accessible to client | No | Yes — dedicated page | V2 only |
| Propuestas accessible to client | No | Yes — dedicated page | V2 only |
| Cronograma accessible to client | No | Yes — dedicated page | V2 only |
| File attachments visible in detail | Yes (in chat + avances) | Yes (PhotoGallery + file list) | V2 separates media from docs |
| Staff can view portal as client | No | Yes — `isStaffViewing()` check | V2 only |

---

## Features in V1 missing from V2 (gaps)

### Priority: High

**1. File upload at ticket creation**
V1 step 3 lets client attach photos/videos/PDFs when opening the ticket. V2 has no file upload in the new-ticket form — clients must describe the problem in text only; files can only be added by staff from the internal app.
*Complexity: Medium.* Needs: client-side file picker → upload to R2 (or direct link) → associate `TicketDocument` records on ticket create. The R2 infrastructure already exists. The new ticket `createPortalTicket` server action would receive file IDs and create `TicketDocument` records.

**2. File attachments in comments / chat**
V1 clients can attach files while chatting (inside the chat bar). V2 `PortalCommentForm` is text-only; the `addPortalComment` action only writes a `TicketHistory.note`.
*Complexity: Medium.* Needs: file picker in `PortalCommentForm` → upload to R2 → create `TicketDocument` + `TicketHistory` entry. Requires a new API route or extending the comment action.

**3. Estimated date (fecha estimada) visible to client**
V1 shows `Fecha_Estimada` in the ticket header and uses it for SLA coloring. V2 dashboard tracks it (`vnc`, `daysLeft`) but the ticket detail page does not display it to the client.
*Complexity: Simple.* Add `estimatedDate` to the ticket detail metadata block — one line of JSX; the value is already fetched by `getClientTicket`.

### Priority: Medium

**4. Date range filter in reports**
V1 reports allow filtering by Desde/Hasta date + presets (Hoy, Esta semana, Este mes, Últimos 3 meses, Todo). V2 reports show all-time data with no date filter at all.
*Complexity: Medium.* Because `/portal/[slug]/reportes` is a Server Component, date filter requires either converting to a Client Component with `useState` + client-side filter, or using URL search params + re-fetch. The data is already loaded; client-side filter over the already-fetched array is simplest.

**5. CSV export from reports**
V1 exports ID, Título, Sucursal, Urgencia, Estado, Categoría, Técnico, Creado, Cierre as CSV. V2 has no export.
*Complexity: Simple.* Client-side: `Blob` + `URL.createObjectURL` over the already-fetched ticket array. No API needed.

**6. OT number visible to client**
V1 shows `OT_Numero` in the ticket header. Clients can reference it in calls with INGEGAR staff. V2 ticket detail does not render `ticket.otNumber` (though it exists in the schema).
*Complexity: Simple.* One JSX line in the ticket detail info block; `ticket.otNumber` is already in `getClientTicket` return.

**7. Técnico name visible to client**
V1 shows the assigned technician name in the ticket detail and avances. V2 `getClientTicket` fetches `assignedTo.name` (used on dashboard cards) but the ticket detail page does not clearly surface who is assigned.
*Complexity: Simple.* Add assigned technician name to the ticket detail info block.

**8. "Avances" / progress updates section**
V1 has a dedicated "Avances" block where admin/tecnico log structured progress (date, tecnico, OT, what was done — visible to client; internal notes — hidden). These appear separately from the chat. V2 consolidates everything into the timeline history, which may lose the structure. Staff notes written via internal app do appear in V2's history, but there is no dedicated "avances" section with the structured view.
*Complexity: Medium.* Would require either: (a) tagging TicketHistory entries as `type=avance` and rendering them differently in the portal timeline, or (b) creating a separate `TicketAvance` model. Option (a) is lower effort.

**9. Merged tickets indication**
V1 shows a "fusión" badge on source tickets that were merged into another, and a `mergedListOpen` panel on the target ticket. V2 hides `fusionado` tickets from the list (correct behavior) but does not show any indication to the client that their ticket was merged/absorbed into another.
*Complexity: Simple.* When `ticket.status === 'fusionado'`, the current list filter hides it — the client just sees it disappear. A resolution note or a visible "merged into #XYZ" link would close this.

### Priority: Low

**10. Print report**
V1 has a print button (`window.print()`). V2 does not.
*Complexity: Simple.* One button calling `window.print()` with a `@media print` stylesheet.

**11. Rendimiento por técnico table in reports**
V1 reports include a table with each technician's totals, resolution rate, and average resolution time. V2 reports show by-branch but not by-technician.
*Complexity: Simple.* The ticket data already includes `assignedTo.name`; grouping client-side is a few lines.

**12. Config panel access (admin role in portal)**
V1 has a `config` view where admin manages sucursales, categorías, urgencias, and users from within the portal. V2 has no config in the portal — all configuration happens in the internal app (`/recursos/clientes/[id]`, `/recursos/tecnicos`, etc.).
*Note: This is intentional in V2's architecture.* The internal app is the admin surface. Not a gap unless a client-facing admin is needed.

---

## Features in V2 not in V1 (improvements)

| Feature | Notes |
|---|---|
| PWA per-portal, installable | Each client gets their own installable app with custom icon |
| Push notifications | Staff can push alerts to portal users via web-push + VAPID |
| Inf. Técnicos page | Clients can read linked technical reports as PDFs |
| Propuestas page | Clients can access commercial proposals |
| Cronograma page | Clients can see their scheduled service visits |
| Mi Cuenta / change password | Clients can update their own password |
| Multi-tenant | Single codebase, multiple portals by slug |
| Persistent database | Turso/SQLite replaces Google Sheets (V1 backend) |
| Visual progress stepper | Clear ticket lifecycle visualization |
| Photo gallery component | Lightbox-style media viewer for images/videos |
| Staff-as-client viewing mode | INGEGAR staff can navigate the portal as the client |
| Noisy-event filtering in history | System entries (field reorders, same-status changes) filtered out |
| Fusion status handled gracefully | `fusionado` tickets hidden from list; don't confuse client |
| Dark mode support | Portal shell + Tailwind media queries |
| Keyboard accessible nav | Escape closes mobile menu |
| Floating action button (mobile) | FAB for "nueva solicitud" on mobile, not on new-ticket page |

---

## Critical gaps to fix first

### 1. File upload at ticket creation — HIGH · Medium complexity
**Why:** The most common client ask. Clients take a photo of the problem and want to attach it immediately. Without this, they describe in text and the photo never gets attached. V1 had it; clients expected it.
**Implementation sketch:** Add a client-side `<input type="file" multiple accept="image/*,...">` to `PortalNewTicketForm`. On `createPortalTicket` submit, upload files first to R2 via a presigned POST URL (`/api/upload-token`), collect the resulting R2 keys, then pass them as additional FormData fields. Inside `createPortalTicket`, create `TicketDocument` records after the ticket is created. R2 and `TicketDocument` model already exist.

### 2. File attachments in comments — HIGH · Medium complexity
**Why:** Clients often need to send a follow-up photo (e.g., "here's the problem after the tech visit"). Text-only comments are insufficient for maintenance workflows.
**Implementation sketch:** Extend `PortalCommentForm` with an optional file picker. On submit: upload to R2, then call a new `addPortalCommentWithFiles(ticketId, note, r2Keys[])` action that creates `TicketHistory` + `TicketDocument` records. Reuse the same presigned upload flow from gap #1.

### 3. Estimated date visible in ticket detail — HIGH · Simple
**Why:** Clients ask INGEGAR "when will this be fixed?" The date is already in the DB and on the dashboard but missing from the detail view. One line of JSX.
**Implementation:** In `src/app/portal/[slug]/tickets/[id]/page.tsx`, add `{ticket.estimatedDate && <div>Fecha estimada: ...</div>}` inside the ticket info block (around the status/urgency metadata). Use `fromDateInput()` per the date parsing rule.

### 4. Date range filter in reports — MEDIUM · Medium complexity
**Why:** All-time reports become misleading as ticket history grows. Clients want "this quarter" or "last month" views for review meetings.
**Implementation:** Convert `PortalReportesPage` to a hybrid: keep the Server Component data fetch but pass raw ticket array to a `'use client'` `PortalReportesView` child that holds `useState` for date range and filters client-side. No extra DB query needed — data is already fetched.

### 5. CSV export from reports — MEDIUM · Simple
**Why:** Clients use the data in their own tracking sheets. V1 had it; the data is already on the page.
**Implementation:** Add a `"use client"` export button inside `PortalReportesView` (from gap #4) that serializes the filtered ticket array to CSV and triggers a `Blob` download. Zero new API routes.
