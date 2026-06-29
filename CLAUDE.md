# CLAUDE.md — INGEGAR Platform

Herramienta interna de gestión de INGEGAR: gestión de técnicos, cronogramas,
cotizador con plantillas propias, pipeline comercial y portal cliente con tickets.
Multi-tenant ligero (INGEGAR + clientes). UI en español, código en inglés.

> **Versión actual: v1.6.0** — Auth + multi-tenant, Cotizador (editor + PDF),
> Recursos (técnicos, vehículos, activos, cuadrillas, clientes), Cronograma,
> Flujo de Caja, Tickets (interno + Portal JB con PWA), Informe Técnico.
> **Pendiente**: persistencia de cotizaciones, módulo Pipeline.

---

## Stack (validado jun-2026)

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.2.x |
| UI | React | 19.2.x |
| Lenguaje | TypeScript | 5.9.x |
| Estilos | Tailwind CSS (v4, CSS-first `@theme`) | 4.3.x |
| ORM | Prisma 7 + driver adapter `better-sqlite3` | 7.8.x |
| DB | SQLite local (`prisma/dev.db`) / Turso (prod) | — |
| Auth | Auth.js v5 (`next-auth@5`, credentials + JWT) | 5.0.0-beta.x |
| PDF | **Playwright/Chromium** (`page.pdf` A4 paginado) | 1.60.x |
| Validación | Zod | 4.x |
| Hash | bcryptjs (JS puro, sin binarios nativos) | 3.x |
| Push | web-push + VAPID (SW + PushManager) | — |
| E2E | Playwright | 1.60.x |

### Decisiones de stack
- **Next 16, no 14**: React 19 exige Next 15+. Se usó la LTS actual (16).
- **Auth.js v5**: v4 es legacy/Pages Router; v5 es nativo de App Router.
- **PDF con Playwright/Chromium**: fidelidad pixel-perfect; `@react-pdf/renderer` no renderiza HTML/CSS arbitrario. Deploy NO puede ser cPanel compartido → ver sección Deploy.
- **SQLite + Turso**: local = archivo único; prod = Turso (libSQL) via adapter. Mismo schema Prisma SQLite.

---

## Comandos

```bash
npm run dev          # servidor de desarrollo (localhost:3000)
npm run build        # prisma generate + next build (producción)
npm start            # servir build de producción
npm run typecheck    # tsc --noEmit
npm run lint         # eslint

npm run db:migrate   # crear/aplicar migración (prisma migrate dev)
npm run db:seed      # poblar tenants + super user
npm run db:studio    # Prisma Studio (GUI de la DB)
npm run db:reset     # resetear DB y re-sembrar (⚠ destruye datos locales)

npm run test:e2e     # Playwright (levanta dev server automáticamente)
```

⚠️ **Tras cambiar el schema Prisma, reiniciar el dev server** — el cliente Prisma se cachea en `globalThis` y hot-reload no lo recarga.
⚠️ **`prisma migrate reset` bloquea en agente AI** — requiere consent explícito del usuario. Usar `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<mensaje exacto del usuario>"`.

### Credenciales sembradas (dev)
- **admin@ingegarchile.cl** / `ingegar123` — rol `super` (ve todos los tenants).
- Tenants: `ingegar`, `justburger`, `loficoffee`.
- Override del password: env `SEED_ADMIN_PASSWORD`.

---

## Arquitectura

### Multi-tenant ligero
- Tabla `Tenant` (slug único); cada recurso lleva `tenantId`.
- Roles (`Role` enum): `super` | `supervisor` | `client`.
- **Regla de scoping**: el rol `super` ve todo; los demás se filtran por su `tenantId`.
- Helper: `src/lib/tenant.ts` → `tenantScope(actor)` devuelve el `where` de Prisma.
  ```ts
  await prisma.recurso.findMany({ where: { ...tenantScope(session.user) } })
  ```

### Autenticación (Auth.js v5)
- `src/auth.config.ts` — config **edge-safe** (sin Prisma/bcrypt). La usa el proxy.
- `src/auth.ts` — instancia Node con Credentials provider (bcrypt + Prisma). Exporta `handlers`, `auth`, `signIn`, `signOut`.
- `src/proxy.ts` — protege rutas (Next 16 renombró `middleware` → `proxy`). `export default auth`.
- `src/app/api/auth/[...nextauth]/route.ts` — handlers GET/POST.
- `src/types/next-auth.d.ts` — augmenta `Session`/`User` con `role`, `tenantId`, `tenantSlug`, `clientId`.
- Estrategia de sesión: **JWT** (obligatorio con Credentials provider).
- **Rol `client`**: redirigido al portal (`/portal/[slug]/tickets`), nunca ve la app interna.

### Prisma 7 (importante)
- El generador emite el cliente en **`src/generated/prisma/`** (gitignored; se regenera con `prisma generate`).
- Importar el cliente **solo** desde `src/lib/prisma.ts` (singleton con el adapter).
- La URL de conexión vive en **`prisma.config.ts`** (no en `schema.prisma` — Prisma 7 lo movió ahí).
- `src/lib/db-adapter.ts` — elige adapter: `better-sqlite3` (local) vs `@libsql/client` (Turso/prod) según `DATABASE_URL`.

### PWA + Push Notifications
- `public/manifest.json` — `id`, `start_url: /dashboard`, iconos completos (72→512 + maskable), **sin `screenshots`** (el archivo no existe, causaba error en Chrome).
- `public/sw.js` — cache shell + network-first + push handler + notificationclick. Solo cachea `http://` (no `chrome-extension://`).
- `src/components/ui/push-provider.tsx` — registra SW, auto-subscribe si permiso ya dado, `requestPushPermission()` con detección iOS (alerta si Safari no-PWA), `pushSupported()` exportado.
- `src/lib/push.ts` — `sendPushToUser()`, `sendPushToTenantStaff()`, `notify()`, `notifyTenantStaff()` via `web-push`.
- `src/app/api/push/subscribe/route.ts` — upsert de `PushSubscription`.
- `src/app/api/notifications/route.ts` — GET (últimas 50) + PATCH (marcar leídas).
- `src/components/ui/notification-bell.tsx` — dropdown en topbar interno; botón "Activar push →" si permiso no dado.
- **iOS**: push solo funciona desde PWA instalada en Home Screen (iOS 16.4+). `pushSupported()` devuelve `false` si es iOS Safari browser. `requestPushPermission()` muestra `alert()` explicativo.
- **Android**: Chrome soporta push nativo sin restricción PWA.
- **VAPID env vars**: `NEXT_PUBLIC_VAPID_KEY` (public), `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`.

### Módulo Cotizador (`src/lib/quotes/`, `src/components/quotes/`)
- **Editor online** (`/cotizador`): campos editables, alcance/exclusiones/condiciones, tabla con **columnas dinámicas**, ajustes (utilidad/admin/comercial con %) cálculo neto/IVA/total, **preview en vivo** (debounce 250ms), descarga PDF.
- **2 plantillas A4**: `clasico` y `minimal`. Una sola fuente de verdad: `renderQuoteHTML(data)` → mismo HTML para preview (iframe) y PDF (Playwright).
- **Imágenes**: data URI en cliente (no se suben al servidor), compatibles con Vercel serverless.
- `types.ts` → `QuoteData` + Zod + `computeTotals`. `template.ts` → HTML paginado seguro. `pdf.ts` → A4, header/footer con n.º página. `quote-id.ts` → `ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]`.
- **Pendiente**: persistencia en DB (guardar/listar/editar cotizaciones) — se hará con Pipeline.

### Módulo Informe Técnico (`src/lib/reports/`, `/informe`)
- Editor con identificación (n.º reporte, OT, cliente, sucursal), secciones numeradas (reordenables), registro fotográfico. Preview en vivo + PDF A4.
- `renderReportHTML(data)` — fuente única para preview y PDF. Registro fotográfico en página propia (`break-before: page`).
- API: `POST /api/reports/generate` (autenticada, `runtime='nodejs'`).

### Módulo Recursos (`src/lib/resources/`, `/recursos`)
- 5 entidades CRUD scoped por tenant: **Técnicos**, **Vehículos**, **Activos**, **Cuadrillas**, **Clientes**.
- Patrón: `lib/resources/<entidad>.ts` + `actions.ts` (`'use server'`) + páginas + form component.
- **Inventario**: Técnico ↔ Camioneta (1:1, `Vehicle.technicianId @unique`); Camioneta → Activos (1:N). `freeTechnician()` libera al asignar a otra camioneta.
- **Técnicos — ContractType enum**: `indefinido | plazo_fijo | ayudante | no_renovado | despedido`. Los dos últimos = desvinculados, se muestran en sección separada en la lista y auto-inactivan al seleccionarlos. Arrays `CONTRACT_TYPE_ACTIVE` / `CONTRACT_TYPE_TERMINATED` en `labels.ts`.
- **Clientes**: `portalSlug` (único) activa el portal; `portalTheme` solo guarda `primary` (bg/card/text son hardcoded claros). `label` (principal/ocasional/prospecto/inactivo/proyecto). `clientRuts[]` (múltiples RUTs por cliente).
- `labels.ts` — todos los mapas de badges/dots/cards por tipo. `schemas.ts` — Zod inputs.

### Módulo Cronograma (`/cronograma` — top-level)
- Modelo `Assignment` (status + permissionRequested + clientId + meetingUrl) + `AssignmentAssignee` (M:N técnico↔asignación, rol `tecnico|ayudante`).
- Vistas Día/Semana/Mes. Color del evento = permiso sucursal (verde/amarillo/gris). Filtro por técnico.
- Click en celda → crear; click en evento → detalle/editar/eliminar.

### Módulo Flujo de Caja (`/flujo` — top-level)
- Modelos: `Branch` (sucursal), `Job` (trabajo facturado), `JobCost` (costos por trabajo).
- Enums: `JobType`, `JobStatus`, `CollectionStatus`, `CostCategory`.
- Dashboard KPIs + breakdown por cliente + tendencia mensual. CRUD de trabajos con costos en vivo. Admin de sucursales.
- **Pendiente prod**: correr `scripts/import-flujo.ts` contra Turso (205 trabajos históricos).

### Módulo Tickets (`/tickets` — top-level interno; `/portal/[slug]/tickets` — portal cliente)
- Modelo `Ticket` (ticketCode, urgency, category, status, otNumber, assignedToId, jobId, branchId, showToClient).
- Vistas internas: Kanban por estado, filtros por cliente/asignado. Detalle con historial y documentos.
- **Portal cliente** (`/portal/[slug]/`): PWA independiente con tema propio, login por sesión separada (rol `client`). Tickets, reportes, notificaciones push. Tema: `resolvePortalTheme()` en `src/lib/portal-theme.ts` — **solo lee `primary` de la DB**; `bg`/`card`/`text` siempre hardcoded claros (beige `#f4f3f1`/blanco). Nunca usar `var(--p-*)` en inline styles del portal (no tienen fallback garantizado).
- `portal-shell.tsx` — sidebar siempre oscuro (`#121110`); contenido principal usa inline styles con props `bg`/`cardBg`/`textColor`.
- `portal-push-prompt.tsx` — banner flotante para activar notificaciones push en el portal.

---

## Convenciones del proyecto

- **UI en español, código/identificadores en inglés.**
- **Rutas API**: `/api/[módulo]/[acción]` (sin `/v1/` — convencion abandonada).
- **IDs de cotización**: `ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]`.
- **Commits**: inglés, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- **Componentes**: archivos enfocados; un propósito por archivo.
- **Versión**: `package.json` → `"version": "1.6.0"`. Badge en sidebar (`INGEGAR Platform v1.6.0`) y dashboard hero.

### Branding
- Primario `#f5b100` (`bg-brand` / `text-brand`), texto `#111111` (`text-ink`).
- Tokens en `src/app/globals.css` vía `@theme`. Fuente: **Inter**.
- Logo: `INGEGAR.` con punto en color brand (`src/components/ui/logo.tsx`).

### Inline styles vs CSS vars — regla crítica
- **App interna**: puede usar `className` Tailwind sin problemas.
- **Portal**: usar **siempre inline styles** en los contenedores de shell y páginas. Las CSS vars del portal (`--acc`, `--bg`, etc.) se inyectan como inline style en el div `.pw` del layout Y en una `<style>` tag, pero bajo ciertas condiciones (dark mode OS, extensiones) las vars pueden no resolver. Los colores críticos de estructura (bg, sidebar, card) van como inline style directo.
- **NUNCA** leer `bg`/`card`/`text` del campo `portalTheme` de la DB — `resolvePortalTheme()` los ignora siempre.

---

## Roadmap de módulos (estado jun-2026)

1. ✅ **Auth + multi-tenant** — completo.
2. 🟡 **Cotizador** — editor funcional; **falta** persistencia DB (guardar/listar/editar).
3. ✅ **Recursos** — CRUD completo (técnicos con estados desvinculados, vehículos, activos, cuadrillas, clientes).
4. ✅ **Cronograma** — calendario Día/Semana/Mes, equipos, permiso de sucursal.
5. ✅ **Flujo de Caja** — dashboard + CRUD + métricas; falta poblar prod con datos históricos.
6. ✅ **Tickets** — Kanban interno + Portal JB PWA con push.
7. ✅ **Informe Técnico** — editor + PDF.
8. ⬜ **Pipeline** — cotizaciones enviadas, estados, alertas de seguimiento.

**Próximos (sugeridos en orden de valor):**
- Persistencia de cotizaciones (se une con Pipeline).
- Estadísticas por técnico: trabajos ejecutados, horas, distribución semanal.
- Import histórico Flujo de Caja a Turso en producción.
- Ticketing Just Burger: migrar desde Google Apps Script.

---

## Deploy — Vercel (serverless)

### Variables de entorno requeridas
```
AUTH_SECRET
AUTH_URL / NEXTAUTH_URL
AUTH_TRUST_HOST=true
DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN
NEXT_PUBLIC_VAPID_KEY
VAPID_PRIVATE_KEY
VAPID_EMAIL=mailto:admin@ingegarchile.cl
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

### Comportamiento por entorno
- **PDF**: `launchBrowser()` elige `@sparticuz/chromium + playwright-core` en Vercel, `playwright` en local.
- **DB**: `db-adapter.ts` elige `better-sqlite3` (local, `file:`) vs `@libsql/client` (Turso, `libsql://`).
- **Imágenes de cotizador**: data URI inline — no requieren filesystem (serverless-safe).
- **Push subscriptions**: guardadas en Turso. Notificaciones enviadas desde Server Actions/API routes.

### VPS / contenedor (alternativa)
SQLite local + `npx playwright install --with-deps chromium`. Sin Turso ni @sparticuz.

---

## Estructura de archivos

```
prisma/
  schema.prisma           # modelos Prisma (SIN url — va en prisma.config.ts)
  seed.ts                 # tenants + super user
  migrations/             # historial de migraciones
prisma.config.ts          # Prisma 7: schema + datasource url + seed
public/
  manifest.json           # PWA manifest (id, icons, shortcuts — SIN screenshots)
  sw.js                   # Service Worker (cache + push)
  icons/                  # icon-72 → icon-512 + maskable-512 + badge-72
src/
  auth.config.ts          # Auth.js edge-safe
  auth.ts                 # Auth.js Node (credentials + bcrypt + prisma)
  proxy.ts                # protección de rutas
  generated/prisma/       # cliente Prisma generado (gitignored)
  lib/
    prisma.ts             # singleton + adapter
    tenant.ts             # tenantScope()
    db-adapter.ts         # SQLite vs Turso
    push.ts               # sendPushToUser/Staff, notify, notifyTenantStaff
    portal-theme.ts       # resolvePortalTheme() — solo lee primary de DB
    portal-auth.ts        # canViewPortal(), isStaffViewing()
    quotes/               # types, template, pdf, quote-id, image-data-url
    reports/              # types, template, pdf, sample
    resources/            # technicians, vehicles, assets, crews, clients, labels, schemas
    cashflow/             # queries, metrics, labels, format
    tickets/              # tickets, labels
  types/next-auth.d.ts
  components/
    ui/                   # sidebar, logo, notification-bell, push-provider
    quotes/               # QuotePreview, DownloadPdfButton, icons, ui primitivos
    reports/              # ReportPreview
    resources/            # forms por entidad + doc-section
    tickets/              # TicketCard, TicketFilters, portal-shell, portal-push-prompt
    cashflow/             # KpiCard, ClientFilter, RevenueByClient, MonthlyTrend
  app/
    layout.tsx            # Inter font, PushProvider, apple-touch-icon meta
    page.tsx              # redirect a /login o /dashboard
    (auth)/login/
    (app)/                # layout protegido (Sidebar + NotificationBell)
      dashboard/          # hero con versión v1.6.0 + novedades
      cotizador/
      informe/
      tickets/            # Kanban interno
      cronograma/
      flujo/
      recursos/           # tecnicos, vehiculos, activos, cuadrillas, clientes
    portal/[slug]/        # Portal cliente (layout propio, tema light hardcoded)
      layout.tsx          # resolvePortalTheme(), google fonts via <link>, .pw div inline style
      page.tsx            # login portal
      dashboard/
      tickets/
      reportes/
    api/
      auth/[...nextauth]/
      quotes/generate/    # POST → PDF
      reports/generate/   # POST → PDF
      push/subscribe/     # POST/DELETE suscripciones push
      notifications/      # GET (últimas 50) + PATCH (marcar leídas)
scripts/
  import-flujo.ts         # importador idempotente Excel → Branch/Job/JobCost
tests/
  e2e/                    # Playwright E2E
  unit/                   # tests unitarios (report, quote)
```
