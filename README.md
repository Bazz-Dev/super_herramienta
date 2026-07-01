# INGEGAR One

> **Plataforma interna de gestión operacional para INGEGAR** — una herramienta
> construida con criterio de producto, no de proyecto.

---

## Qué es

INGEGAR One es el sistema nervioso de INGEGAR Chile. Reemplaza hojas de cálculo,
carpetas en Drive y sistemas fragmentados por una sola plataforma web que cubre
el ciclo completo de operaciones: desde la cotización hasta el cierre de un
ticket de mantención, pasando por la gestión de recursos humanos, flota,
cronograma y flujo de caja.

Construida como herramienta interna con portal de cliente integrado. Multi-tenant
ligero: INGEGAR puede gestionar todos sus clientes (Just Burger, Lofi Coffee, etc.)
desde la misma app, y cada cliente ve solo lo suyo desde su portal privado.

---

## Módulos

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Auth + Multi-tenant** | ✅ | Login por credenciales, JWT, roles `super / supervisor / client`. Scoping por tenant. |
| **Cotizador** | ✅ | Editor de propuestas con plantillas A4 (`clasico` / `minimal`), preview en vivo, PDF vía Playwright, columnas dinámicas, ajustes por porcentaje. |
| **Recursos** | ✅ | CRUD de técnicos, vehículos, activos, cuadrillas y clientes. Inventario: técnico ↔ camioneta ↔ activos. |
| **Cronograma** | ✅ | Calendario Día / Semana / Mes con asignaciones multi-técnico, estados de permiso de sucursal, filtros. |
| **Flujo de Caja** | ✅ | KPIs de cobranza, desglose por cliente, tendencia mensual, CRUD de trabajos con costos. |
| **Tickets** | ✅ | Kanban interno con historial, documentos en R2, comentarios internos/públicos, push notifications. |
| **Portal Cliente** | ✅ | PWA independiente por cliente (tema propio), login separado, tickets, reportes, push notifications, nueva solicitud. |
| **Informe Técnico** | ✅ | Editor de informes con secciones reordenables, registro fotográfico, PDF A4. |
| **Carpetas de Clientes** | ✅ | Propuestas e informes guardados como JSON editable, re-abribles en editor, PDF on-demand. |
| **RR.HH.** | ✅ | Fichas de empleado, contratos, permisos/vacaciones, liquidaciones mensuales, FES. |
| **Mi Panel** | ✅ | Vista personal del técnico: vehículo asignado, documentos con alertas de vencimiento, asignaciones, RR.HH., tickets, gastos. |
| **Pipeline** | ⬜ | Cotizaciones enviadas + seguimiento comercial (próximo). |

---

## Stack técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js App Router (Turbopack) | 16.x |
| UI | React | 19.x |
| Lenguaje | TypeScript | 5.9.x |
| Estilos | Tailwind CSS v4 (CSS-first `@theme`) | 4.3.x |
| ORM | Prisma 7 + driver adapter `better-sqlite3` | 7.8.x |
| Base de datos | SQLite local / Turso (libSQL) en producción | — |
| Autenticación | Auth.js v5 (credentials + JWT) | 5.0.x |
| PDF | Playwright/Chromium (`page.pdf`, A4 paginado) | 1.60.x |
| Almacenamiento | Cloudflare R2 (documentos de tickets) | — |
| Validación | Zod | 4.x |
| Push Notifications | web-push + VAPID (PWA / Service Worker) | — |
| Tests | Playwright E2E + Vitest unitarios | — |

### Por qué este stack

- **Next.js 16 sobre 14**: React 19 Concurrent Mode requiere Next 15+.
- **Playwright para PDF**: Fidelidad pixel-perfect de HTML/CSS arbitrario. Alternativas como `@react-pdf/renderer` no renderizan el CSS de las plantillas.
- **SQLite + Turso**: Desarrollo en archivo local, producción en Turso (libSQL). Mismo schema Prisma, mismo código, sin cambiar una línea.
- **Auth.js v5**: Native App Router. v4 es legacy/Pages Router.
- **R2 (Cloudflare)**: Almacenamiento de objetos sin egress fees para servir archivos de tickets a clientes.

---

## Arquitectura

### Multi-tenant

```
Tenant (ingegar / justburger / loficoffee)
  └── Users (super | supervisor | client | tecnico)
  └── Tickets, Assets, Assignments, etc.
```

Toda query de datos incluye `tenantScope(actor)`:

```ts
await prisma.ticket.findMany({ where: { ...tenantScope(session.user) } })
```

El rol `super` ve todo. Los demás se filtran por su `tenantId`.

### Autenticación (Auth.js v5)

```
src/auth.config.ts  ← edge-safe (sin Prisma/bcrypt), usado por el proxy
src/auth.ts         ← Node (Credentials provider, bcrypt, Prisma)
src/proxy.ts        ← middleware de rutas (antes se llamaba middleware.ts)
```

Roles:
- `super` — acceso completo, ve todos los tenants
- `supervisor` — acceso al tenant propio, sin DB admin
- `client` — redirigido al portal `/portal/[slug]/tickets`
- `tecnico` — acceso a `/mi-panel` y sus asignaciones

### PDF (Playwright)

```
renderQuoteHTML(data)    →  mismo HTML para preview (iframe) y PDF
                            No hay dos fuentes de verdad
page.pdf({ format: 'A4', printBackground: true })
```

En Vercel usa `@sparticuz/chromium + playwright-core`. En local usa `playwright` directamente. La función `launchBrowser()` elige automáticamente.

### Portal Cliente (PWA)

Cada cliente tiene su portal en `/portal/[slug]/`. Es una PWA instalable con:
- Tema propio (color primario configurable desde INGEGAR One)
- Push notifications con VAPID
- Tickets propios con historial, comentarios, sub-tareas y documentos
- Formulario de nueva solicitud
- Service Worker con cache shell

---

## Inicio rápido

### Prerrequisitos

- Node.js 20+ (LTS)
- npm 10+

### Instalación

```bash
git clone https://github.com/Bazz-Dev/super_herramienta.git
cd super_herramienta
npm install
```

### Variables de entorno

Crea un archivo `.env` en la raíz:

```env
# Auth
AUTH_SECRET=<genera con: openssl rand -base64 32>
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# Base de datos (local)
DATABASE_URL=file:./prisma/dev.db

# Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_KEY=<tu-clave-publica>
VAPID_PRIVATE_KEY=<tu-clave-privada>
VAPID_EMAIL=mailto:admin@ingegarchile.cl

# R2 (Cloudflare) — para documentos de tickets
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

Genera claves VAPID:
```bash
npx web-push generate-vapid-keys
```

### Base de datos

```bash
npm run db:migrate   # aplica migraciones
npm run db:seed      # crea tenants + usuario admin
```

Credenciales del seed:
- **Email:** `admin@ingegarchile.cl`
- **Password:** `ingegar123` (o el valor de `SEED_ADMIN_PASSWORD`)

### Desarrollo

```bash
npm run dev
# Abre http://localhost:3000
```

> Tras cambiar el schema Prisma, reinicia el servidor dev — el cliente Prisma se cachea en `globalThis`.

---

## Comandos

```bash
npm run dev           # Servidor de desarrollo (Turbopack)
npm run build         # prisma generate + next build
npm start             # Servir build de producción
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm run db:migrate    # prisma migrate dev
npm run db:seed       # Poblar DB inicial
npm run db:studio     # Prisma Studio (GUI)
npm run db:reset      # ⚠️ Resetear DB (destructivo — requiere confirmación)
npm run test:e2e      # Playwright E2E (levanta dev server automáticamente)
```

---

## Estructura del proyecto

```
prisma/
  schema.prisma         # Modelos de datos
  seed.ts               # Datos iniciales (tenants + admin)
  migrations/           # Historial de migraciones SQLite
prisma.config.ts        # Prisma 7: datasource URL + seed
public/
  manifest.json         # PWA manifest
  sw.js                 # Service Worker
  icons/                # Iconos (72→512 + maskable + badge)
src/
  auth.ts / auth.config.ts / proxy.ts
  lib/
    prisma.ts           # Singleton Prisma
    tenant.ts           # tenantScope(), requireActor()
    push.ts             # Push notifications
    quotes/             # Cotizador: types, template, pdf
    reports/            # Informe técnico: types, template, pdf
    resources/          # Recursos: technicians, vehicles, assets...
    tickets/            # Tickets: queries, labels
    cashflow/           # Flujo de caja: queries, metrics
    rrhh/               # RR.HH.: queries, labels
  components/
    ui/                 # Sidebar, NotificationBell, PushProvider, Logo
    quotes/             # QuotePreview, DownloadPdfButton, SaveDocumentButton
    tickets/            # TicketCard, PortalShell, PortalNewTicketForm...
    resources/          # Formularios por entidad
    cashflow/           # KpiCard, ClientFilter, MonthlyTrend...
    rrhh/               # TechnicianHRForm, LeaveManagementView, PayrollView
  app/
    (auth)/login/
    (app)/              # Layout protegido (sidebar + topbar)
      dashboard/
      cotizador/        # ?docId=xxx carga documento guardado
      informe/
      documentos/       # Carpetas de clientes
      mi-panel/         # Vista personal del técnico
      rrhh/             # RR.HH. y sub-páginas
      tickets/          # Kanban interno
      cronograma/
      flujo/
      recursos/         # tecnicos, vehiculos, activos, cuadrillas, clientes
    portal/[slug]/      # Portal cliente (tema propio, PWA)
    api/
      auth/[...nextauth]/
      quotes/generate/
      reports/generate/
      push/subscribe/
      notifications/
      technicians/      # API REST para técnicos (expiry alerts, etc.)
scripts/
  import-jb-tickets.ts # Importador idempotente Excel → DB (Just Burger)
  turso-migrate.ts     # Migrador para producción Turso
tests/
  e2e/                 # Tests Playwright E2E
  unit/                # Tests unitarios
```

---

## Deploy

### Vercel (recomendado)

La app corre en Vercel con serverless functions. El PDF se genera con `@sparticuz/chromium`.

Variables de entorno requeridas en Vercel:

```
AUTH_SECRET
AUTH_URL
AUTH_TRUST_HOST=true
DATABASE_URL=libsql://...        # URL de Turso
TURSO_AUTH_TOKEN
NEXT_PUBLIC_VAPID_KEY
VAPID_PRIVATE_KEY
VAPID_EMAIL
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

### VPS / Contenedor

```bash
npx playwright install --with-deps chromium
# Usa DATABASE_URL=file:./prisma/prod.db o apunta a Turso
npm run build && npm start
```

---

## Reglas de desarrollo

- **UI en español, código en inglés.** Variables, funciones, nombres de archivo: inglés. Texto visible al usuario: español.
- **Inline styles en el portal.** Las CSS vars pueden fallar bajo dark mode del OS. Los contenedores de estructura del portal usan `style={}` directamente.
- **`tenantScope(actor)` en toda query.** Nunca hardcodear `tenantId`.
- **PDF = misma fuente de verdad.** `renderQuoteHTML(data)` genera el HTML para el iframe de preview Y para Playwright. No hay dos plantillas.
- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- **Nunca push directo a `main` sin revisión.**
- **Verificar `DATABASE_URL` antes de cualquier migración.** `file:` = local seguro. `libsql://` = producción con datos reales de clientes.

---

## Contexto de negocio

INGEGAR Chile es una empresa de servicios de mantención y climatización. Sus
clientes son cadenas de retail y restaurantes con múltiples sucursales en Chile.

La app nació de la necesidad de reemplazar un sistema de tickets en Google Apps
Script y carpetas en Drive que no escalaban. La v3 (esta versión) unifica en una
sola plataforma todo lo que antes vivía disperso.

Datos clave de producción:
- 83 tickets históricos de Just Burger migrados con historial completo
- 13 sucursales de Just Burger
- 7 técnicos activos
- Multi-tenant: INGEGAR + Just Burger + Lofi Coffee

---

## Créditos

Esta plataforma fue diseñada y construida durante 2025–2026 como una colaboración
entre humano y agente — una apuesta por construir herramientas de software de
calidad de producto sin los tiempos y costos de un equipo de desarrollo tradicional.

Es nuestra opera magna. La construimos juntos, commit a commit, con criterio de
co-fundador técnico en cada decisión.

---

```
                            INGEGAR One
                     Plataforma de gestión operacional

        Diseño, arquitectura y producto ··············· Bazz
        Ingeniería, implementación y código ············ Astra

                         INGEGAR Chile — 2026
```

---

*Hecho con convicción. Construido para durar.*
