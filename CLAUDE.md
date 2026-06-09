# CLAUDE.md — INGEGAR Platform

Herramienta interna de gestión de INGEGAR: gestión de técnicos, cronogramas,
cotizador con plantillas propias y pipeline comercial. Multi-tenant ligero
(INGEGAR + clientes). UI en español, código en inglés.

> **Estado:** Fase 0 (fundación) completa — Auth + multi-tenant + dashboard.
> Los módulos de negocio (Cotizador, Recursos, Pipeline) aún no están construidos.

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
| PDF | `@react-pdf/renderer` (sin navegador) | 4.5.x |
| Validación | Zod | 4.x |
| Hash | bcryptjs (JS puro, sin binarios nativos) | 3.x |
| E2E | Playwright | 1.60.x |

### Decisiones de stack (por qué difiere del brief original)
- **Next 16, no 14**: el brief pedía Next 14, pero React 19 (ya instalado) exige Next 15+. Se usó la LTS actual (16).
- **Auth.js v5, no NextAuth 4**: v4 es legacy/Pages Router; v5 es nativo de App Router (`auth()` universal).
- **PDF con `@react-pdf/renderer`, NO Playwright/Chromium**: el deploy es **Benzahosting cPanel compartido**, que no puede ejecutar Chromium. Playwright queda **solo para tests E2E**.
- **SQLite + better-sqlite3**: archivo único, corre en cPanel sin servidor de DB. Suficiente para uso interno; migrar a Postgres si crece la concurrencia.

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
2. ⬜ **Cotizador**: plantillas HTML + formulario dinámico + export PDF (`@react-pdf/renderer`).
3. ⬜ **Recursos**: técnicos, proyectos, asignaciones, calendario.
4. ⬜ **Pipeline**: cotizaciones enviadas, estados, alertas de seguimiento.

**Futuro**: ticketing de mantención Just Burger (migrar desde GAS), reportes por tenant, inventario.

---

## Deploy — Benzahosting (cPanel compartido)

⚠️ **A confirmar con el proveedor antes de desplegar:**
- Requiere la función **"Setup Node.js App" (Passenger)** en el plan para correr el servidor Next.js.
- **No** ejecutar Chromium/Playwright en producción (no soportado en compartido) — por eso el PDF es por código.
- SQLite: el archivo `dev.db`/prod debe quedar fuera del webroot público y con permisos de escritura.
- `AUTH_SECRET` de producción se genera con `npx auth secret` (nunca reutilizar el de `.env` de dev).
- Build se hace localmente/CI y se sube; `npm start` sirve el output.

Si el plan no soporta Node persistente, alternativas: VPS de Benzahosting, o deploy del frontend en un host con Node y la DB junto a él.

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
  types/next-auth.d.ts  # augmentación de tipos de sesión
  components/ui/        # componentes base
  app/
    layout.tsx          # branding global (Inter, tokens)
    page.tsx            # redirige a /login o /dashboard
    (auth)/login/       # page + login-form (client) + actions (server)
    (app)/              # layout protegido + dashboard
    api/auth/[...nextauth]/route.ts
tests/e2e/              # Playwright
```
