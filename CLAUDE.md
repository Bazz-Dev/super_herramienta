# CLAUDE.md — INGEGAR Platform

Herramienta interna de gestión de INGEGAR: técnicos, cronogramas, cotizador, pipeline comercial,
flujo de caja y portal cliente con tickets. Multi-tenant ligero (un solo tenant real, `ingegar`;
Just Burger/Decathlon/Happyland son `Client` con portal, no tenants). UI en español, código en inglés.

**Para arquitectura profunda** (módulos, ontología de entidades, taxonomía de estados, invariantes de
negocio, catálogo de condiciones de borde, runbook de deploy/recovery): `docs/ARQUITECTURA.md`.
**Para reglas cross-cutting**: `.claude/rules/production-safety.md`, `data.md`, `frontend.md`,
`testing.md`. Este archivo es el punto de entrada — no duplica lo que ya está en esos documentos.

---

## 🔴 PROD es la fuente de verdad — regla no negociable

Flujo permitido: **PROD → snapshot LOCAL**. Nunca `LOCAL → PROD`. Localhost no tiene capacidad normal
de escritura sobre Turso PROD ni R2 PROD. Antes de cualquier comando que toque una base de datos,
leer `.claude/rules/production-safety.md` completo — cubre verificación de `DATABASE_URL`, backups,
el flujo seguro de migraciones, y por qué (incidente real documentado en el gap register).

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS v4 (CSS-first `@theme`) |
| Lenguaje | TypeScript 5.9 |
| ORM | Prisma 7 + driver adapter (`better-sqlite3` local / `@libsql/client` Turso prod) |
| DB | SQLite local (`prisma/dev.db`) / Turso (prod) |
| Auth | Auth.js v5 (credentials + JWT) |
| PDF | Playwright/Chromium (`page.pdf`, A4 paginado) — fidelidad pixel-perfect, por eso no `@react-pdf/renderer` |
| Validación | Zod 4 |
| Push | web-push + VAPID |
| Storage archivos | Cloudflare R2 (nunca filesystem local — serverless) |
| E2E | Playwright |

**Decisiones de stack fijas** (no reabrir sin motivo nuevo): Next 16 por React 19; Auth.js v5 por ser
nativo App Router; PDF vía Playwright/Chromium por fidelidad HTML/CSS arbitraria; SQLite+Turso mismo
schema Prisma en ambos ambientes.

---

## Comandos

```bash
npm run dev          # servidor de desarrollo (localhost:3000, o el próximo puerto libre)
npm run build        # prisma generate + next build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test:unit    # node --import tsx --test
npm run test:e2e     # Playwright, levanta dev server automáticamente

npm run db:migrate         # crear/aplicar migración local (prisma migrate dev)
npm run db:migrate:prod    # aplica migraciones pendientes a Turso — el ÚNICO camino seguro a prod
npm run db:seed            # poblar tenants + super user (local)
npm run db:studio          # Prisma Studio
```

⚠️ Tras cambiar el schema Prisma, reiniciar el dev server — el cliente se cachea en `globalThis`.
⚠️ `prisma migrate reset` bloquea en agente AI — requiere consent explícito del usuario
(`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<mensaje exacto del usuario>"`).

Metodología de validación completa (qué correr antes de dar algo por terminado) en
`.claude/rules/testing.md`.

### Credenciales sembradas (dev local)

`admin@ingegarchile.cl` / `Ingegar@Super1` — rol `super`. Override: env `SEED_ADMIN_PASSWORD`.
Credenciales reales de producción viven en `docs/usuarios-produccion.md` (gitignored) — nunca en
este archivo, nunca commiteadas.

---

## Arquitectura — resumen de una pantalla

- **Multi-tenant**: `tenantScope(actor)` en `src/lib/tenant.ts` — todo query de negocio lo usa. `super`
  ve todo, el resto se filtra por `tenantId`. Roles: `super | supervisor | client | tecnico`.
  `client`/`tecnico` nunca ven la app interna — el proxy los redirige a `/portal/[slug]` o `/mi-panel`
  respectivamente. Detalle en `.claude/rules/data.md`.
- **Auth**: `src/auth.config.ts` (edge-safe, usa el proxy) vs `src/auth.ts` (Node, credentials+bcrypt).
  `src/proxy.ts` protege rutas (Next 16 renombró `middleware` → `proxy`). Sesión JWT (obligatorio con
  Credentials provider). Logout app interna usa `signOut` client-side de `next-auth/react` — un
  Server Action con `signOut` de `@/auth` no limpia la cookie JWT de forma confiable.
- **Prisma 7**: cliente generado en `src/generated/prisma/` (gitignored), importar solo desde
  `src/lib/prisma.ts`. URL de conexión en `prisma.config.ts`, no en `schema.prisma`.
- **PWA**: cada portal de cliente instala como app independiente (`id`/`scope` propios en
  `/portal/[slug]/manifest.webmanifest` + `/portal/[slug]/icon/[size]`) — el navegador las trata como
  apps distintas entre sí y de INGEGAR One. Push vía `src/lib/push.ts` + VAPID; en iOS solo funciona
  desde la PWA instalada (Safari normal no soporta).
- **Deploy (Vercel)**: `serverExternalPackages` en `next.config.ts` es donde van los módulos con
  binario nativo o carga dinámica propia (`better-sqlite3`, `@libsql/client`, `@sparticuz/chromium`,
  `playwright(-core)`, `pdf-to-img`/`pdfjs-dist`) — Turbopack no los puede bundlear. Una dependencia
  nueva que falle solo en Vercel o solo en build (no en dev) con error de módulo no encontrado es
  sospechosa de necesitar esto. `launchBrowser()` elige Chromium real en local vs
  `@sparticuz/chromium` serverless en Vercel automáticamente.

---

## Estructura de archivos

```
prisma/
  schema.prisma            # modelos (SIN url — va en prisma.config.ts)
  seed.ts                  # tenants + usuarios base
  migrations/
prisma.config.ts
public/
  manifest.json, ingegar-isotipo.svg, sw.js
src/
  auth.config.ts / auth.ts / proxy.ts
  generated/prisma/        # gitignored
  lib/
    prisma.ts              # singleton + adapter — único punto de import del cliente
    tenant.ts              # tenantScope(), requireActor(allowedRoles?)
    db-adapter.ts           # SQLite vs Turso
    push.ts / portal-theme.ts / portal-auth.ts
    quotes/ reports/ resources/ cashflow/ tickets/ rrhh/ pipeline/
    zip.ts                 # buildZipFromR2Keys — compartido entre técnico/empresa/documentación
  types/next-auth.d.ts
  components/
    ui/                    # primitivos compartidos — ver .claude/rules/frontend.md
    quotes/ reports/ resources/ tickets/ cashflow/ rrhh/ pipeline/
  app/
    ingegar-icon/[size]/   # isotipo dinámico como PNG
    (auth)/login/
    mi-panel/              # layout propio (NO vive bajo (app)/) — superficie técnico
    (app)/                 # layout protegido (Sidebar + NotificationBell) — superficie staff
      dashboard/ cotizador/ informe/ documentos/ documentacion/ conciliacion/
      rrhh/ tickets/ cronograma/ flujo/ pipeline/ recursos/ gastos/
    portal/[slug]/         # portal cliente — SIEMPRE inline styles, ver frontend.md
    api/
scripts/
  turso-migrate.ts         # único camino seguro a Turso prod
  backup-turso-tables.ts   # snapshot antes de escribir
  reconcile-*.ts, fix-*.ts # correcciones puntuales de datos, con evidencia y backup — quedan como registro
tests/
  e2e/ unit/
docs/
  ARQUITECTURA.md          # referencia profunda — módulos, ontología, taxonomía, edge cases
  architecture/GAP_REGISTER.md  # única lista viva de pendientes reales (no duplicar en otro lado)
```

---

## Convenciones

- **UI en español, código/identificadores en inglés.**
- **Rutas API**: `/api/[módulo]/[acción]` (sin `/v1/`).
- **IDs de cotización**: `ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]`. **Código de trabajo (Flujo de Caja)**:
  `YYMMDD-CLI-TT-NN` (importados: `IMP-CLI-NNNN`). Esto es el estado ACTUAL — hay una dirección
  acordada (no implementada) hacia `Ticket` como raíz de todo trabajo, con sufijos `PPTO-N`/`FAC-N`
  agregados a su referencia visible; ver `docs/ARQUITECTURA.md` § Ontología del dominio → Modelo
  objetivo antes de tocar cualquier generador de ID.
- **Commits**: inglés, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). Nunca push directo a
  `main`/ramas protegidas sin confirmación explícita.
- **Componentes**: archivo enfocado, un propósito. Antes de escribir un botón/badge/modal/tabla a
  mano, comprobar si ya existe el primitivo compartido (`.claude/rules/frontend.md`).
- **Versión**: `package.json` → `"version"`. No bumpear por cada sesión — solo cuando corresponda a
  una versión real entregada.

---

## Roadmap

Estado de negocio y siguientes pasos acordados viven en `docs/ARQUITECTURA.md` y
`docs/architecture/GAP_REGISTER.md` (evidencia por ítem, estados 🔴/🟡/🟢/⚪) — no se listan acá para
evitar tres listas de pendientes divergiendo entre sí otra vez.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
