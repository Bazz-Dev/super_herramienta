# CLAUDE.md — INGEGAR Platform

Herramienta interna de gestión de INGEGAR: gestión de técnicos, cronogramas,
cotizador con plantillas propias y pipeline comercial. Multi-tenant ligero
(INGEGAR + clientes). UI en español, código en inglés.

> **Estado:** Auth + multi-tenant, **Cotizador** (editor + PDF), **Recursos**
> (técnicos, vehículos, activos, cuadrillas, clientes) y **Cronograma** (calendario)
> construidos. Pendiente: persistencia de cotizaciones y módulo Pipeline.

---

## Stack (validado jun-2026)

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.2.x |
| UI | React | 19.2.x |
| Lenguaje | TypeScript | 5.9.x |
| Estilos | Tailwind CSS (v4, CSS-first `@theme`) | 4.3.x |
| ORM | Prisma 7 + driver adapter `better-sqlite3` | 7.8.x |
| DB | SQLite (archivo `prisma/dev.db`) | — |
| Auth | Auth.js v5 (`next-auth@5`, credentials + JWT) | 5.0.0-beta.x |
| PDF | **Playwright/Chromium** (`page.pdf` A4 paginado, pie repetido) | 1.60.x |
| Validación | Zod | 4.x |
| Hash | bcryptjs (JS puro, sin binarios nativos) | 3.x |
| E2E | Playwright | 1.60.x |

### Decisiones de stack (por qué difiere del brief original)
- **Next 16, no 14**: el brief pedía Next 14, pero React 19 (ya instalado) exige Next 15+. Se usó la LTS actual (16).
- **Auth.js v5, no NextAuth 4**: v4 es legacy/Pages Router; v5 es nativo de App Router (`auth()` universal).
- **PDF con Playwright/Chromium** (revisado): el cotizador exige fidelidad pixel-perfect a una plantilla HTML. `@react-pdf/renderer` NO renderiza HTML/CSS arbitrario, así que se descartó. Playwright renderiza el HTML real y exporta vía `page.pdf()` a 390px. **Implica que el deploy NO puede ser cPanel compartido** (no corre Chromium) → ver sección Deploy.
- **SQLite + better-sqlite3**: archivo único, sin servidor de DB. Suficiente para uso interno; migrar a Postgres si crece la concurrencia.

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
npm run db:reset     # resetear DB y re-sembrar

npm run test:e2e     # Playwright (levanta dev server automáticamente)
```

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
- `src/types/next-auth.d.ts` — augmenta `Session`/`User` con `role`, `tenantId`, `tenantSlug`.
- Estrategia de sesión: **JWT** (obligatorio con Credentials provider).
- Rutas protegidas: prefijos en `PROTECTED_PREFIXES` dentro de `auth.config.ts`.

### Prisma 7 (importante)
- El generador emite el cliente en **`src/generated/prisma/`** (no en `node_modules`). Está gitignored; se regenera con `prisma generate` (incluido en `npm run build`).
- Importar el cliente **solo** desde `src/lib/prisma.ts` (singleton con el adapter).
- La URL de conexión vive en **`prisma.config.ts`** (no en `schema.prisma` — Prisma 7 lo movió ahí). `.env` carga vía `dotenv`.

### Módulo Cotizador (`src/lib/quotes/`, `src/components/quotes/`)
- **Editor online funcional** (`/cotizador`): campos editables, alcance, exclusiones y condiciones como listas, tabla de ítems con **columnas dinámicas**, cálculo automático de neto/IVA/total, **preview en vivo** (debounce 250ms) y descarga PDF.
- **2 plantillas A4** seleccionables: `clasico` (principal) y `minimal`. El valor histórico de 390px del `DESIGN-SYSTEM.MD` quedó **obsoleto** (override del usuario → A4).
- **Imágenes opcionales** en ambas plantillas: banner de portada (`coverImageUrl`) + sección "Registro fotográfico" (`images[]` con pie de foto). Se convierten a **data URI en el cliente** (`src/lib/quotes/image-data-url.ts`: redimensiona ≤1600px + recomprime) y se guardan inline en `QuoteData` — **no** se suben al servidor. Esto funciona en Vercel serverless (filesystem read-only); el viejo `/api/uploads` quedó obsoleto.
- **UX/UI**: íconos SVG (no emojis, `src/components/quotes/icons.tsx`), `cursor-pointer` + transiciones 150ms + focus-visible, empty states, toolbar de preview con zoom y "abrir en pestaña", `prefers-reduced-motion` global, responsive. Basado en la skill `ui-ux-pro-max` (se mantuvo la marca ámbar/Inter, no la paleta sugerida).
- **Una sola fuente de verdad de render**: `renderQuoteHTML(data)` (`template.ts`) genera el HTML que usan **tanto** el `QuotePreview` (iframe, escalado a A4) **como** el PDF (Playwright) → preview ≈ PDF.
- `types.ts` — `QuoteData` (template, customColumns, items con `custom`, coverImageUrl) + Zod + `computeTotals`. **Ajustes** (`adjustments`: utilidad, gastos administrativos, ajuste comercial) sobre el costo base antes del neto, cada uno con checkbox + % editable → `{ base, adjustments[], net, tax, total }`.
- `template.ts` — 3 plantillas, A4, paginación segura (`break-inside: avoid` en filas/secciones, `thead` repetido, `break-after: page` en portada). Valores escapados con `esc()`.
- `pdf.ts` — `generateQuotePdf()`: arma el HTML y delega en `renderHtmlToPdf()` (módulo compartido `src/lib/pdf/render.ts` con el `launchBrowser()` serverless/local). A4, `displayHeaderFooter` (n.º de página + contacto), margins 14/16mm. **Node runtime only.**
- `quote-id.ts` — genera `ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]`.
- API: `POST /api/quotes/generate` (→ PDF) y `POST /api/uploads` (imagen de portada → `public/uploads`, gitignored). Ambas autenticadas, `runtime='nodejs'`.
- Componentes (`src/components/quotes/`): `quote-editor` (orquestador), `items-editor` (columnas dinámicas), `scope-editor`, `string-list-editor`, `cover-image-upload`, `quote-preview`, `download-pdf-button`, `ui` (primitivos).
- **Pendiente**: persistencia en DB (modelo `Quote`, guardar/listar/editar) — se hará junto al Pipeline. Validación visual fina vs. los PDFs de `design-reference/`.

### Módulo Informe Técnico (`src/lib/reports/`, `src/components/reports/`, `/informe`)
- **Creador de Informe Técnico** (`/informe`): misma lógica que el cotizador pero para el documento "Informe Técnico". Editor con identificación (n.º reporte, versión, contacto, cliente, sucursal, dirección, observación, OT), **secciones numeradas** (título + párrafo + viñetas, reordenables) y **registro fotográfico** (fotos como data URI vía el mismo helper de cliente). Preview en vivo (debounce 250ms) + descarga PDF A4.
- Estructura basada en el PDF de muestra `design-reference/IT - 260519-JB-PR-78 - PROVIDENCIA.pdf`: masthead de marca, tarjeta de identificación, secciones (Alcance / Actividades / Observaciones / Conclusión) y anexo fotográfico al final.
- `types.ts` — `ReportData` (Zod) + `reportFilename()` (`IT - <reportId> - <SUCURSAL>`). `template.ts` — `renderReportHTML(data)`, única fuente de verdad para preview y PDF; el registro fotográfico arranca en página nueva (`break-before: page`). `sample.ts` — informe de muestra (caso Providencia) que precarga el editor. `pdf.ts` — `generateReportPdf()` usa `renderHtmlToPdf()` compartido.
- API: `POST /api/reports/generate` (→ PDF, autenticada, `runtime='nodejs'`). Agregada a `outputFileTracingIncludes` en `next.config.ts` (mismo Chromium serverless que el cotizador).
- Tests: `tests/unit/report.test.ts` (HTML, escape anti-inyección, nombre de archivo, PDF válido, borde vacío, anexo fotográfico en página propia).

### Módulo Recursos (`src/lib/resources/`, `src/components/resources/`, `/recursos`)
- 5 entidades CRUD, todas scoped por tenant (`tenantScope` / `canAccessTenant`): **Técnicos**, **Vehículos** (camionetas), **Activos** (herramientas, enum `AssetStatus`), **Cuadrillas** (M:N con técnicos), **Clientes**.
- Patrón por entidad: `lib/resources/<entidad>.ts` (queries) + `app/(app)/recursos/<entidad>/actions.ts` (`'use server'` create/update/delete con Zod + `revalidatePath`) + páginas `page.tsx` (lista), `new/`, `[id]/` + componente form en `components/resources/`. Cada página/lista lleva un **enlace "← atrás"** (a Recursos o al Dashboard).
- `lib/resources/schemas.ts` — Zod inputs. `labels.ts` — etiquetas/colores de estados (activos, vehículos, roles de asignado, color de permiso). `dates.ts` — helpers `datetime-local`.
- **Relación de inventario (clave)**: un **Técnico ↔ una Camioneta** (`Vehicle.technicianId @unique`, 1:1); una **Camioneta ↔ N Herramientas** (`Asset.vehicleId`). Así el inventario y el estado se ven por camioneta. El perfil del técnico (`tecnicos/[id]`) muestra su camioneta + herramientas; la camioneta (`vehiculos/[id]`) lista su inventario. Al asignar un técnico a una camioneta, se libera de cualquier otra (helper `freeTechnician`).
- **Clientes**: modelo `Client` (tenant-scoped); CRUD propio en `/recursos/clientes`. En la asignación se elige de un desplegable o se **crea al vuelo** (`createClientInline`, exportado desde `clientes/actions.ts`).
- Creación: el `tenantId` se toma del actor (super crea bajo `ingegar` pero ve todos).
- ⚠️ **Tras cambiar el schema Prisma, reiniciar el dev server**: el cliente se cachea en `globalThis` y el hot-reload no lo recarga.

### Módulo Cronograma (`src/app/(app)/cronograma/`, `/cronograma` — **top-level**, fuera de Recursos)
- Calendario de trabajos enfocado en **qué equipo está con qué cliente, cuándo, y si se pidió permiso de sucursal**.
- Modelo `Assignment` (enum `AssignmentStatus`) + `clientId` + `permissionRequested` (bool) + `meetingUrl`. El equipo se modela con **`AssignmentAssignee`** (M:N técnico↔asignación, enum `AssigneeRole` = `tecnico | ayudante`) → permite ver/formar equipos ad-hoc (técnico + ayudantes) y su distribución semanal. **No** enlaza cuadrilla ni activo.
- `schedule-calendar.tsx`: vistas **Día/Semana/Mes** (grid de horas en día/semana), **click en celda → crear** (modal con `AssignmentForm`), **click en evento → detalle** (modal: equipo con roles, cliente, permiso, editar/eliminar). **Filtro por técnico** (Todos / cada técnico) en la toolbar.
- **Color del evento = permiso de sucursal**: `permissionEventColor()` → **verde** si `permissionRequested`, **amarillo** si no, gris/tachado si `cancelled`. El estado (`AssignmentStatus`) queda como dato secundario.
- `assignment-form.tsx`: hidden input `assignees` con JSON `[{technicianId, role}]`; checkbox `permissionRequested`; cliente con creación inline. La acción reemplaza assignees en bloque (delete+create en transacción) al editar.
- Las acciones (`createAssignment`/`updateAssignment`/`deleteAssignment`) viven en `app/(app)/cronograma/actions.ts`.

### Módulo Flujo de Caja (`src/lib/cashflow/`, `src/app/(app)/flujo/` — **top-level**)
- Registro histórico de trabajos facturados: costos reales vs. ingresos, estado de cobranza, y gestión de sucursales por cliente.
- **Modelos Prisma**: `Branch` (sucursal del cliente — `clientId`, `tenantId`, `name`, `active`; unique `[clientId, name]`), `Job` (trabajo ejecutado — campos financieros `netAmount`/`taxAmount` en CLP entero, `collectionStatus`, `purchaseOrder`, `invoiceNumber`, `executionDate`; scoping `tenantId + clientId`), `JobCost` (costos del trabajo — `category`, `amount` en CLP entero, `supplier`, `documentRef`).
- **Enums**: `JobType` (`requerimiento|emergencia|preventivo|proyecto|otro`), `JobStatus` (`pendiente|en_proceso|ejecutado|anulado`), `CollectionStatus` (`sin_oc|pendiente_pago|pagado`), `CostCategory` (`materiales|mano_obra|subcontrato|transporte|otros`).
- **Relaciones**: `Client → Branch[]` y `Client → Job[]` (inversas en `Client`); `Branch → Job[]`; `Job → JobCost[]` (cascade delete).
- **Scoping**: `tenantId` en `Job` y `Branch` — usar `tenantScope(actor)` igual que otros módulos. `Client` ya está scoped; `Branch` y `Job` heredan el scope via `clientId`.
- **Ruta**: `/flujo` (pendiente de implementar).
- **Carga histórica**: `scripts/import-flujo.ts` (pendiente — importará desde Excel/CSV a `Branch`, `Job`, `JobCost`).

---

## Convenciones del proyecto

- **UI en español, código/identificadores en inglés.**
- **Rutas API**: `/api/v1/[módulo]/[acción]`.
- **IDs de cotización**: `ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]`.
- **Commits**: inglés, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- **Componentes**: archivos enfocados; un propósito por archivo.

### Branding
- Primario `#f5b100` (`bg-brand` / `text-brand`), texto `#111111` (`text-ink`).
- Tokens definidos en `src/app/globals.css` vía `@theme`.
- Fuente: **Inter** (`next/font/google`).
- Logo: `INGEGAR.` con punto en color brand (`src/components/ui/logo.tsx`).

---

## Roadmap de módulos (orden de build)

1. ✅ **Auth + multi-tenant** (Fase 0 — hecho).
2. 🟡 **Cotizador** (editor funcional listo): editor online + 3 plantillas A4 + columnas dinámicas + cálculo automático + preview en vivo + PDF + subida de imagen. **Falta**: persistencia en DB (guardar/listar/editar cotizaciones).
3. ✅ **Recursos**: técnicos, vehículos (1:1 técnico), activos (inventario por camioneta), cuadrillas y clientes — CRUD completo con persistencia y scoping multi-tenant.
4. ✅ **Cronograma** (top-level): calendario Día/Semana/Mes, equipos técnico/ayudante, cliente, color por permiso de sucursal, filtro por técnico.
5. ✅ **Flujo de Caja** (`/flujo`): `Branch`/`Job`/`JobCost` + enums; importador idempotente (`scripts/import-flujo.ts`, 205 trabajos), métricas puras (cobranza/aging/backlog SIN OC/margen), queries+actions scoped, dashboard con KPIs filtrable por cliente, CRUD de trabajos con costos+margen en vivo, admin de sucursales. **Pendiente prod**: correr el import contra Turso para poblar datos en producción.
6. ⬜ **Pipeline**: cotizaciones enviadas, estados, alertas de seguimiento.

**Futuro**: **estadísticas por técnico/cliente** (trabajos por persona, distribución semanal); ticketing de mantención Just Burger (migrar desde GAS); reportes por tenant.

---

## Deploy — Vercel (serverless) o VPS/contenedor

El cotizador genera PDFs con Chromium y la app usa SQLite. El código soporta **dos targets**
(ver `DEPLOY_REPORT.md` para el runbook completo):

### Vercel (serverless) — target actual
- **PDF**: `src/lib/quotes/pdf.ts` → `launchBrowser()` elige por entorno. En serverless
  (`process.env.VERCEL`) usa **`@sparticuz/chromium` + `playwright-core`**; en local usa
  `playwright`. Ambos por import dinámico.
- **DB**: `src/lib/db-adapter.ts` elige el adapter por `DATABASE_URL`. En Vercel usa
  **Turso (libSQL)** (`libsql://` + `TURSO_AUTH_TOKEN`); el `schema.prisma` sigue siendo
  SQLite. Bootstrap del esquema: `scripts/turso-bootstrap.sql`.
- **Uploads de imágenes** (`/api/uploads` → `public/uploads`) **no persisten** en serverless;
  para producción real migrar a un blob store (Vercel Blob / S3 / R2). Opcional para el cotizador.
- Vars: `AUTH_SECRET`, `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_URL`/`NEXTAUTH_URL`,
  `AUTH_TRUST_HOST=true`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.

### VPS / contenedor (Railway, Render, Fly) — alternativa
- Con disco persistente: SQLite (`file:`) + `npx playwright install --with-deps chromium`
  funcionan tal cual, sin Turso ni @sparticuz. El selector de adapter/navegador cae solo
  en el camino local.

---

## Estructura

```
prisma/
  schema.prisma         # modelos (Tenant, User) — SIN url (va en prisma.config.ts)
  seed.ts               # tenants + super user
  migrations/
prisma.config.ts        # Prisma 7: schema + datasource url + seed
src/
  auth.config.ts        # config Auth.js edge-safe
  auth.ts               # Auth.js Node (credentials + bcrypt + prisma)
  proxy.ts              # protección de rutas (ex-middleware)
  generated/prisma/     # cliente Prisma generado (gitignored)
  lib/
    prisma.ts           # singleton del cliente + adapter
    tenant.ts           # scoping multi-tenant
    quotes/             # types, format, template (HTML), pdf (Playwright), sample
  types/next-auth.d.ts  # augmentación de tipos de sesión
  components/
    ui/                 # componentes base
    quotes/             # QuotePreview (iframe) + DownloadPdfButton
  app/
    layout.tsx          # branding global (Inter, tokens)
    page.tsx            # redirige a /login o /dashboard
    (auth)/login/       # page + login-form (client) + actions (server)
    (app)/              # layout protegido + dashboard + cotizador
    api/auth/[...nextauth]/route.ts
    api/quotes/generate/route.ts   # POST → PDF
tests/e2e/              # Playwright
scripts/test-pdf.ts     # genera un PDF de ejemplo a disco (dev)
```
