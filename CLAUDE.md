# CLAUDE.md — INGEGAR Platform

Herramienta interna de gestión de INGEGAR: gestión de técnicos, cronogramas,
cotizador con plantillas propias, pipeline comercial y portal cliente con tickets.
Multi-tenant ligero (INGEGAR + clientes). UI en español, código en inglés.

> **Versión actual: v1.10.0** — Auth + multi-tenant, Cotizador (editor + PDF + carpetas clientes),
> Recursos (técnicos, vehículos, activos, cuadrillas, clientes), Cronograma,
> Flujo de Caja, Tickets (interno + Portal JB/Decathlon/Happyland con PWA), Informe Técnico,
> **RR.HH.** (fichas de empleado, permisos/vacaciones, liquidaciones, FES),
> **Carpetas de clientes** (propuestas/informes guardados como JSON editable, PDF on-demand),
> **Portal PWA multi-cliente** (isotipo INGEGAR dinámico PNG + icono dinámico por cliente + manifest independiente por portal),
> **Pipeline comercial** (`/pipeline` — kanban por estado, KPIs, monto en juego, integrado en carpetas).
> **Nuevo v1.9 (jul-2026)**: Portal V2 redesign (chat-bubbles, progress stepper, estimatedDate+técnico visibles al cliente),
> filtro período + CSV export en reportes, portal JB con cuentas de sucursal + flujo aprobación Carolina,
> mi-panel técnico (FES, solicitud permisos, KPIs vehículo), ver-como (staff impersonation), auditoría de permisos,
> gastos vinculados a trabajos, mutualidad + teléfono2 en ficha técnico, adjuntos R2 en portal (nueva solicitud + comentarios).
> **Nuevo v1.10 (jul-2026)**: Pipeline comercial — ProposalStatus enum, kanban columnar (Borrador/Enviada/Vista/Aceptada/Rechazada/Perdida),
> KPIs (total, monto en juego, tasa de cierre, por vencer), integrado en `/documentos` (badge + botón "Agregar al pipeline").
> **Pendiente**: import histórico Turso (`scripts/import-flujo.ts`), estadísticas por técnico.

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

### 🔴 REGLA CRÍTICA — PROTECCIÓN DE DATOS (no negociable)

Antes de correr CUALQUIER comando que toque la base de datos:

1. **Verificar DATABASE_URL activo**: `file:` = local SQLite (seguro). `libsql://` = Turso producción (datos reales de clientes).
2. **Nunca correr en producción sin confirmación explícita**: `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, `db:reset`, `db:seed`.
3. **Backup antes de migrar localmente**: `cp prisma/dev.db prisma/dev.db.bak`
4. **Flujo seguro para schema changes**:
   - Editar schema → `prisma migrate dev` (solo con `DATABASE_URL=file:`) → `tsc --noEmit` → `git commit` → DESPUÉS `npm run db:migrate:prod`
5. **Para Turso producción**: SOLO usar `scripts/turso-migrate.ts` que aplica migraciones additive y es idempotente. NUNCA apuntar el CLI de Prisma directamente a la URL de Turso.

Esta empresa maneja datos sensibles de clientes reales. Perder datos = pérdida irreparable de confianza.

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
- **Rol `tecnico`**: pre-fetch de role ANTES de `signIn()` en `authenticate()` → `redirectTo: '/mi-panel'`. NO depender del middleware para esta redirección (soft-navigation no la dispara).
- **Logout app interna**: `<LogoutButton>` (`src/components/ui/logout-button.tsx`) usa `signOut` de `next-auth/react` (client-side). **NO** usar Server Action form con `signOut` de `@/auth` — no limpia la cookie JWT de forma confiable.
- **Roles disponibles** (todos): `super | supervisor | client | tecnico`.

### Prisma 7 (importante)
- El generador emite el cliente en **`src/generated/prisma/`** (gitignored; se regenera con `prisma generate`).
- Importar el cliente **solo** desde `src/lib/prisma.ts` (singleton con el adapter).
- La URL de conexión vive en **`prisma.config.ts`** (no en `schema.prisma` — Prisma 7 lo movió ahí).
- `src/lib/db-adapter.ts` — elige adapter: `better-sqlite3` (local) vs `@libsql/client` (Turso/prod) según `DATABASE_URL`.

### PWA + Push Notifications
- `public/manifest.json` — INGEGAR One: `id: /dashboard`, `scope: /`, iconos: SVG isotipo (`sizes:"any"`) + PNGs dinámicos vía `/ingegar-icon/[size]`. `short_name: INGEGAR`, `background_color: #111111`. **Sin `screenshots`** (causaba error Chrome).
- `public/ingegar-isotipo.svg` — isotipo oficial INGEGAR (3 triángulos: azul #1a3c7d, oscuro #1c2240, brand yellow #f5b100). Referenciado en `manifest.json` como `sizes: "any"` (Chrome/Edge).
- `src/app/ingegar-icon/[size]/route.tsx` — genera el isotipo como PNG dinámico a cualquier tamaño via `ImageResponse`. Fondo #111111, triángulos calculados en % exactos del SVG. Usado por `manifest.json` y `layout.tsx` (`apple-touch-icon` iOS). **Reemplaza los PNGs estáticos legacy** de `/icons/`.
- `public/sw.js` — cache shell + network-first + push handler + notificationclick. Solo cachea `http://` (no `chrome-extension://`).
- `src/components/ui/push-provider.tsx` — registra SW, auto-subscribe si permiso ya dado, `requestPushPermission()` con detección iOS (alerta si Safari no-PWA), `pushSupported()` exportado.
- `src/lib/push.ts` — `sendPushToUser()`, `sendPushToTenantStaff()`, `notify()`, `notifyTenantStaff()` via `web-push`.
- `src/app/api/push/subscribe/route.ts` — upsert de `PushSubscription`.
- `src/app/api/notifications/route.ts` — GET (últimas 50) + PATCH (marcar leídas).
- `src/components/ui/notification-bell.tsx` — dropdown en topbar interno; botón "Activar push →" si permiso no dado.
- **iOS**: push solo funciona desde PWA instalada en Home Screen (iOS 16.4+). `pushSupported()` devuelve `false` si es iOS Safari browser. `requestPushPermission()` muestra `alert()` explicativo.
- **Android**: Chrome soporta push nativo sin restricción PWA.
- **VAPID env vars**: `NEXT_PUBLIC_VAPID_KEY` (public), `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`.

### PWA por-portal (independiente por cliente)
- **Cada portal tiene su propia installable PWA** con scope y id únicos → el browser las trata como apps distintas.
- `src/app/portal/[slug]/manifest.webmanifest/route.ts` — manifest dinámico: `id: /portal/${slug}/`, `scope: /portal/${slug}/`, `name`, `theme_color` desde `portalTheme.primary`.
- `src/app/portal/[slug]/icon/[size]/route.tsx` — icono dinámico PNG via `ImageResponse` (initials + color primario). Si `Client.logoUrl` tiene data URI → retorna el binary directamente. Si tiene URL externa → redirect 302.
- `src/components/resources/client-logo-upload.tsx` — sube imagen, la redimensiona a ≤300px en canvas, la guarda como data URI PNG vía `saveClientLogo()` en `Client.logoUrl`.
- `src/app/(app)/recursos/clientes/[id]/page.tsx` — muestra `<ClientLogoUpload>` solo cuando `portalSlug` está activo (solo portales necesitan logo de PWA).
- Portal layout (`/portal/[slug]/layout.tsx`) — `<link rel="manifest" href="/portal/${slug}/manifest.webmanifest">` + `<link rel="apple-touch-icon" href="/portal/${slug}/icon/180">`.
- **Para iOS PWA con icono real**: subir logo PNG cuadrado desde `/recursos/clientes/[id]`. Sin logo → initials en color brand (funciona en Android/Chrome; iOS PWA usa icono genérico).

### Módulo Cotizador (`src/lib/quotes/`, `src/components/quotes/`)
- **Editor online** (`/cotizador`): campos editables, alcance/exclusiones/condiciones, tabla con **columnas dinámicas**, ajustes (utilidad/admin/comercial con %) cálculo neto/IVA/total, **preview en vivo** (debounce 250ms), descarga PDF.
- **2 plantillas A4**: `clasico` y `minimal`. Una sola fuente de verdad: `renderQuoteHTML(data)` → mismo HTML para preview (iframe) y PDF (Playwright).
- **PDF márgenes**: `top:10mm / bottom:14mm / left:10mm / right:10mm` en `src/lib/pdf/render.ts`. `.body-pad { padding-top: 6px }` en `template.ts`. El mismo `renderHtmlToPdf()` sirve propuestas e informes.
- **Imágenes**: data URI en cliente (no se suben al servidor), compatibles con Vercel serverless.
- **`SaveDocumentButton`** (`src/components/quotes/save-document-button.tsx`): siempre visible (no se oculta cuando no hay clientes). Si `clients.length === 0` → modal muestra aviso amarillo + link a `/recursos/clientes`. Botón "Guardar" deshabilitado hasta que haya cliente seleccionado. Para re-editar doc existente (`existingDocId` prop) → PATCH en lugar de POST, omitiendo el selector de cliente.
- **Descarga PDF móvil**: `DownloadPdfButton` y el botón de descarga en `/documentos` usan `a.href = blobUrl; document.body.appendChild(a); a.click()` en lugar de `window.open(blob, '_blank')` (bloqueado en iOS Safari y Chrome mobile).
- `types.ts` → `QuoteData` + Zod + `computeTotals`. `template.ts` → HTML paginado seguro. `pdf.ts` → A4, header/footer con n.º página. `quote-id.ts` → `ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]`.
- **Pendiente**: persistencia en DB (guardar/listar/editar cotizaciones) — se hará con Pipeline.

### Módulo Informe Técnico (`src/lib/reports/`, `/informe`)
- Editor con identificación (n.º reporte, OT, cliente, sucursal), secciones numeradas (reordenables), registro fotográfico. Preview en vivo + PDF A4.
- `renderReportHTML(data)` — fuente única para preview y PDF. Registro fotográfico en página propia (`break-before: page`).
- API: `POST /api/reports/generate` (autenticada, `runtime='nodejs'`).

### Módulo Carpetas de Clientes (`/documentos`, `src/app/api/client-documents/`)
- `ClientDocument` model: `fileKey` (= `"inline"` cuando datos están en DB), `dataJson` (JSON completo del editor), `metadata` (info extra).
- **Flujo de guardado**: Editor → JSON se guarda en `ClientDocument.dataJson` (no R2) → `/documentos` muestra carpetas por cliente.
- **Re-editar**: botón "Editar" enlaza a `/cotizador?docId=xxx` o `/informe?docId=xxx` — carga `dataJson` como `initial` del editor.
- **PDF on-demand**: botón "PDF" en `/documentos` hace `GET /api/client-documents?id=xxx` para obtener `dataJson` → `POST /api/quotes/generate` → descarga.
- **API** (`/api/client-documents`): POST (JSON body, no FormData), GET (lista o single por id, `dataJson` omitido en lista), PATCH (actualizar), DELETE.
- No requiere R2 para propuestas/informes — `isR2Key("inline")` = false.

### Módulo Pipeline (`src/lib/pipeline/`, `src/components/pipeline/`, `/pipeline`)
- Acceso: solo `super` | `supervisor`.
- **Modelo**: campos nuevos en `ClientDocument` (type = `propuesta`): `proposalStatus` (enum `ProposalStatus`), `proposalAmount` (CLP), `sentAt`, `viewedAt`, `responseAt`, `followUpAt`, `proposalNote`.
- **`ProposalStatus` enum**: `borrador | enviada | vista | aceptada | rechazada | perdida`.
- **`/pipeline`**: kanban columnar agrupado por estado. KPIs: total en pipeline, monto en juego (enviada+vista), tasa de cierre (aceptadas/cerradas), propuestas por vencer (>7 días sin respuesta).
- **Integración `/documentos`**: propuestas muestran badge de estado pipeline. Hover-overlay: botón "Agregar al pipeline" si no está en pipeline; "Ver en pipeline →" si ya tiene estado.
- **Acciones**: `addToPipeline`, `updatePipelineStatus`, `updatePipelineAmount`, `updateFollowUp`, `removeFromPipeline` en `src/lib/pipeline/actions.ts`.
- `src/lib/pipeline/queries.ts` — `getPipelineDocs()` + `computeKPIs()`.
- `src/lib/pipeline/labels.ts` — colores por estado, `formatCLP()`, `daysSince()`.
- `src/components/pipeline/pipeline-board.tsx` — `PipelineBoard` (client) con `PipelineCard` expandible (cambiar estado, editar monto, notas, quitar del pipeline).

### Módulo RR.HH. (`src/lib/rrhh/`, `/rrhh`)
- Acceso: solo `super` | `supervisor`. Requiere `requireActor(['super', 'supervisor'])`.
- **`/rrhh`** — Dashboard: KPIs (headcount, permisos pendientes, masa salarial mes), lista equipo, permisos recientes, accesos rápidos.
- **`/rrhh/[id]`** — Ficha empleado: datos personales, contrato, formulario edición datos laborales (`TechnicianHRForm`), historial permisos, liquidaciones, asignaciones, documentos.
- **`/rrhh/vacaciones`** — CRUD de `LeaveRequest`: aprobar/rechazar inline, filtros por técnico y estado.
- **`/rrhh/liquidaciones`** — CRUD de `Payroll`: flujo Borrador→Emitido→Pagado, cálculo líquido = base + extras − descuentos.
- **Nuevos campos en `Technician`**: `hireDate`, `baseSalary`, `address`.
- **Nuevos modelos**: `LeaveRequest` (vacaciones, permisos, licencias) + `Payroll` (liquidaciones mensuales).
- `requireActor` actualizado para aceptar `allowedRoles?: Role[]` — redirige a `/dashboard` si el rol no está permitido.

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
- **Detalle de trabajo** (`/flujo/trabajos/[id]`): sección "Documentos del cliente" al final de la página. Consulta `ClientDocument` por `clientId` del trabajo (sin `dataJson` — list only). Muestra badge tipo, título, fecha y enlace "Editar →" al editor correspondiente. Estado vacío con CTA "Crear propuesta →". Link "Ver carpeta →" a `/documentos`.
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
- **Versión**: `package.json` → `"version": "1.9.0"`. Badge en sidebar y dashboard hero.

### Branding
- Primario `#f5b100` (`bg-brand` / `text-brand`), texto `#111111` (`text-ink`).
- Tokens en `src/app/globals.css` vía `@theme`. Fuente: **Inter**.
- Logo: `INGEGAR.` con punto en color brand (`src/components/ui/logo.tsx`).

### Inline styles vs CSS vars — regla crítica
- **App interna**: puede usar `className` Tailwind sin problemas.
- **Portal**: usar **siempre inline styles** en los contenedores de shell y páginas. Las CSS vars del portal (`--acc`, `--bg`, etc.) se inyectan como inline style en el div `.pw` del layout Y en una `<style>` tag, pero bajo ciertas condiciones (dark mode OS, extensiones) las vars pueden no resolver. Los colores críticos de estructura (bg, sidebar, card) van como inline style directo.
- **NUNCA** leer `bg`/`card`/`text` del campo `portalTheme` de la DB — `resolvePortalTheme()` los ignora siempre.

---

## Roadmap de módulos (estado jul-2026)

1. ✅ **Auth + multi-tenant** — completo. Tecnico → `/mi-panel`, cliente → portal (pre-fetch rol en `authenticate()`).
2. ✅ **Cotizador** — editor funcional + guardar como JSON editable en carpeta cliente + PDF on-demand.
3. ✅ **Recursos** — CRUD completo (técnicos, vehículos, activos, cuadrillas, clientes) + logo de portal por cliente.
4. ✅ **Cronograma** — calendario Día/Semana/Mes, equipos, permiso de sucursal.
5. ✅ **Flujo de Caja** — dashboard + CRUD + métricas; falta poblar prod con datos históricos.
6. ✅ **Tickets** — Kanban interno + portales JB/Decathlon/Happyland con PWA + push. Desktop kanban = `<table><tr onClick>` (no links).
7. ✅ **Informe Técnico** — editor + PDF + guardar en carpeta cliente.
8. ✅ **Carpetas de clientes** (`/documentos`) — propuestas e informes guardados como JSON editable, re-abribles en editor, PDF generado on-demand.
9. ✅ **RR.HH.** — fichas de empleado, permisos/vacaciones, liquidaciones mensuales, FES (Firma Electrónica Simple desde `/mi-panel`).
10. ✅ **Portal PWA multi-cliente** — isotipo INGEGAR dinámico PNG (`/ingegar-icon/[size]`), manifest+icon independiente por portal, logo dinámico desde `Client.logoUrl`. `apple-touch-icon` iOS también usa la ruta dinámica.
11. ✅ **Pipeline comercial** — `/pipeline` kanban columnar (Borrador/Enviada/Vista/Aceptada/Rechazada/Perdida), KPIs (total, monto en juego, tasa de cierre, por vencer >7d), integrado en `/documentos` con badge de estado y botón "Agregar al pipeline". `ProposalStatus` enum en `ClientDocument`. `src/lib/pipeline/` + `src/components/pipeline/pipeline-board.tsx`.

**Próximos (sugeridos en orden de valor):**
- Import histórico Flujo de Caja a Turso en producción (`scripts/import-flujo.ts`).
- Estadísticas por técnico: trabajos ejecutados, horas, distribución semanal.
- Alertas automáticas de seguimiento en Pipeline (propuesta enviada > 7 días sin respuesta → push/email).

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
  manifest.json           # INGEGAR One PWA manifest (id:/dashboard, SVG isotipo + /ingegar-icon/[size] — SIN screenshots)
  ingegar-isotipo.svg     # Isotipo oficial (3 triángulos: azul #1a3c7d, oscuro #1c2240, #f5b100)
  sw.js                   # Service Worker (cache + push)
  icons/                  # badge-72 (legacy PNGs reemplazados por /ingegar-icon/[size])
src/
  auth.config.ts          # Auth.js edge-safe
  auth.ts                 # Auth.js Node (credentials + bcrypt + prisma)
  proxy.ts                # protección de rutas
  generated/prisma/       # cliente Prisma generado (gitignored)
  lib/
    prisma.ts             # singleton + adapter
    tenant.ts             # tenantScope(), requireActor(allowedRoles?)
    db-adapter.ts         # SQLite vs Turso
    push.ts               # sendPushToUser/Staff, notify, notifyTenantStaff
    portal-theme.ts       # resolvePortalTheme() — solo lee primary de DB
    portal-auth.ts        # canViewPortal(), isStaffViewing()
    quotes/               # types, template, pdf, quote-id, image-data-url
    reports/              # types, template, pdf, sample
    resources/            # technicians, vehicles, assets, crews, clients, labels, schemas
    cashflow/             # queries, metrics, labels, format
    tickets/              # tickets, labels
    rrhh/                 # queries, actions, labels (RR.HH. module)
    client-documents.ts   # listClientDocuments, listAllClientDocuments, deleteClientDocument
  types/next-auth.d.ts
  components/
    ui/                   # sidebar, logo, notification-bell, push-provider
    quotes/               # QuotePreview, DownloadPdfButton, SaveDocumentButton, icons, ui primitivos
    reports/              # ReportPreview
    resources/            # forms por entidad + doc-section
    tickets/              # TicketCard, TicketFilters, portal-shell, portal-push-prompt, portal-edit-form, portal-add-item-form
    cashflow/             # KpiCard, ClientFilter, RevenueByClient, MonthlyTrend
    rrhh/                 # TechnicianHRForm, LeaveManagementView, PayrollView
  app/
    ingegar-icon/[size]/  # GET → PNG del isotipo INGEGAR (ImageResponse, fondo #111111, 3 triángulos)
    layout.tsx            # Inter font, PushProvider, apple-touch-icon → /ingegar-icon/152|180
    page.tsx              # redirect a /login o /dashboard
    (auth)/login/
    (app)/                # layout protegido (Sidebar + NotificationBell)
      dashboard/          # hero con versión + novedades
      cotizador/          # ?docId=xxx carga documento guardado para re-editar
      informe/            # ?docId=xxx carga informe guardado para re-editar
      documentos/         # carpetas de clientes: propuestas + informes editables
      mi-panel/           # panel de técnicos: FES pendientes + asignaciones
      rrhh/               # dashboard, [id] ficha empleado, vacaciones, liquidaciones
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
      quotes/generate/       # POST → PDF (Playwright, runtime=nodejs, maxDuration=60)
      reports/generate/      # POST → PDF (Playwright, runtime=nodejs, maxDuration=60)
      client-documents/      # POST/GET/PATCH/DELETE — dataJson en DB inline, no R2
      push/subscribe/        # POST/DELETE suscripciones push
      notifications/         # GET (últimas 50) + PATCH (marcar leídas)
scripts/
  import-flujo.ts         # importador idempotente Excel → Branch/Job/JobCost
tests/
  e2e/                    # Playwright E2E
  unit/                   # tests unitarios (report, quote)
```
