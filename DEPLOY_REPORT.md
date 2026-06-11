# DEPLOY_REPORT — INGEGAR Platform

> Auditoría de producción y bitácora de despliegue. Mantenido por el proceso de
> "preparación para producción". Fecha de inicio: 2026-06-10.

---

## 1. Resumen ejecutivo

Plataforma interna Next.js 16 (App Router) + React 19 + Prisma 7. Estado del código:
**compila, lint y typecheck en verde; 17/17 E2E en verde.** Apto para producción
**con observaciones** — hay dos decisiones de arquitectura que condicionan el destino
de despliegue (ver §3).

El objetivo inmediato del negocio: que un socio pruebe el **Cotizador** en una URL.
Flujo del cotizador: `login → /cotizador (editor + preview en vivo) → descargar PDF`.
Esto exige (a) una base de datos con el usuario sembrado para el login y (b) Chromium
para generar el PDF.

---

## 2. Validación técnica (ejecutada)

| Check | Comando | Resultado |
|-------|---------|-----------|
| Instalación | `npm install` | ✅ OK (496 paquetes) |
| Build producción | `npm run build` | ✅ OK (27 rutas generadas) |
| Lint | `npm run lint` | ✅ Sin errores |
| Typecheck | `npm run typecheck` | ✅ Sin errores |
| E2E | `npm run test:e2e` | ✅ 17/17 |
| Migraciones | `prisma migrate deploy` | ✅ 4 migraciones aplicadas |

### Vulnerabilidades (`npm audit`): 5 moderadas — **aceptadas**
Ambas son dependencias **transitivas de tooling de desarrollo**, sin exposición en el
runtime de producción. Su corrección automática (`audit fix --force`) sería destructiva:

- `@hono/node-server` ← vía `prisma`/`@prisma/dev` (CLI de desarrollo). El "fix"
  degradaría **Prisma a v6** (breaking).
- `postcss` ← vía `next` (build-time). El "fix" degradaría **Next a v9** (absurdo).

Decisión: no aplicar. Se resolverán cuando Next/Prisma publiquen parches en su línea actual.

---

## 3. Hallazgos de arquitectura para producción (CRÍTICO)

El stack fue diseñado (ver `CLAUDE.md`) para un **VPS con Node + Chromium**, no para
hosting serverless. Dos puntos condicionan el destino:

### 3.1 Generación de PDF con Playwright completo
`src/lib/quotes/pdf.ts` hace `import { chromium } from 'playwright'` y lanza un Chromium
real. En **serverless (Vercel/Lambda)** ese binario no está disponible → la descarga de
PDF (lo que el socio quiere probar) **fallaría**.
- **VPS/contenedor (Railway/Render/Fly):** funciona tal cual con `npx playwright install --with-deps chromium`.
- **Vercel:** requiere migrar a `playwright-core` + `@sparticuz/chromium` (Chromium serverless).

### 3.2 Base de datos SQLite en archivo (`better-sqlite3`)
El archivo `prisma/dev.db` vive en disco. En **serverless** el filesystem es efímero/solo
lectura → el usuario sembrado no persiste y el **login fallaría**; como `/cotizador` está
detrás de auth, el socio no llegaría al editor.
- **VPS/contenedor con volumen persistente:** SQLite funciona tal cual.
- **Vercel:** requiere DB gestionada. Opción de mínimo cambio: **Turso (libSQL)** —
  mantiene el dialecto SQLite y el `schema.prisma`, solo se cambia el adapter y se aporta
  una URL + token. (Alternativa: Postgres en Neon, cambio mayor.)

### 3.3 Subida de imágenes (`/api/uploads` → `public/uploads`)
Escribe al filesystem local (gitignored). En serverless no persiste. Para el cotizador es
**opcional** (banner/anexo fotográfico). Para v1 de prueba es aceptable; para producción
real conviene un blob store (Vercel Blob / S3 / R2). **Riesgo pendiente, no bloqueante.**

---

## 4. Inventario de producción

### 4.1 Variables de entorno
| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `AUTH_SECRET` | **Sí** | Secreto Auth.js v5. Generar con `npx auth secret`. **Nunca** reutilizar el de dev. |
| `DATABASE_URL` | **Sí** | Cadena de conexión. Dev: `file:./prisma/dev.db`. Serverless: URL de Turso/Postgres. |
| `AUTH_URL` | Sí (prod) | URL pública de la app (ej. `https://ingegar.vercel.app`). |
| `NEXTAUTH_URL` | Sí (prod) | Igual que `AUTH_URL` (compatibilidad). |
| `AUTH_TRUST_HOST` | Recom. (prod) | `true` detrás de proxy (Vercel/Railway). |
| `SEED_ADMIN_PASSWORD` | Opcional | Override del password del super admin al sembrar. |
| `TURSO_AUTH_TOKEN` | Si Turso | Token de la base libSQL (solo en la ruta Vercel). |

### 4.2 Servicios externos
- **Hosting** (a decidir: Railway / Render / Vercel).
- **Base de datos** (SQLite-en-volumen o Turso/Postgres según hosting).
- **GitHub** (repositorio + auto-deploy).
- *(Futuro)* Blob store para uploads de imágenes.

### 4.3 Dependencias críticas (runtime)
- `next@16`, `react@19`, `next-auth@5-beta`, `@prisma/client@7` + adapter, `playwright`
  (PDF), `bcryptjs` (hash), `zod` (validación).

---

## 5. Bitácora de decisiones

- **2026-06-10** — Auditoría inicial. Build/lint/typecheck/E2E verdes. Detectados los dos
  blockers serverless (§3.1, §3.2). `.gitignore` correcto (ignora `dev.db`, `.env*`,
  `src/generated`, `public/uploads`). `gh` y `vercel` CLI **no instalados**. Repo git local
  en `main`, **sin remoto**. Commit de estado estable `718d44a`.
- **2026-06-10** — Decisión de hosting: **Vercel** (elegido por el usuario). Se adapta el
  código a serverless:
  - **PDF (§3.1) RESUELTO**: `src/lib/quotes/pdf.ts` ahora elige el navegador por entorno
    (`launchBrowser()`): en serverless usa `@sparticuz/chromium` + `playwright-core`; en
    local/tests usa `playwright` (Chromium empaquetado), ambos por import dinámico.
    `playwright` movido a devDependencies; `playwright-core` a dependencies.
  - **DB (§3.2) RESUELTO en código**: `src/lib/db-adapter.ts` elige el adapter por
    `DATABASE_URL` — `better-sqlite3` para `file:` (local), **libSQL/Turso** para
    `libsql://`/`http(s)://` (prod). `prisma.ts` y `seed.ts` usan el factory compartido.
  - `next.config.ts`: `serverExternalPackages` incluye los paquetes nativos/binarios.
  - SQL de bootstrap para Turso generado en `scripts/turso-bootstrap.sql`.
  - Verificado: build + 17/17 E2E (incl. generación de PDF local) en verde tras los cambios.
  - Pendiente: credenciales del usuario (GitHub, Turso, Vercel) — ver §7.
- **2026-06-10** — **GitHub publicado**: `https://github.com/Bazz-Dev/super_herramienta`
  (privado). Remoto `origin`, rama `main`. ⚠️ El usuario compartió tokens de Turso en el
  chat → **rotar tras el deploy**.
- **2026-06-10** — **Turso aprovisionado**: base `ingegar` (`libsql://ingegar-ingegar.aws-ap-northeast-1.turso.io`).
  Esquema aplicado con `scripts/deploy-db.ts` (usa `@libsql/client`, sin CLI de Turso) +
  seed. Verificado (`scripts/verify-db.ts`): 3 tenants, super admin, datos demo. El primer
  token entregado era de plataforma (401); el segundo, database token `rw`, funcionó.
  Secrets (DATABASE_URL, TURSO_AUTH_TOKEN, AUTH_SECRET de prod) en `.env.production.local`
  (gitignored). Pendiente: **Vercel** (requiere `vercel login` interactivo del usuario).
- **2026-06-10** — Usuario importó el repo en Vercel vía dashboard (auto-deploy). **Primer
  build falló**: `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`
  en `prisma generate`. Causa: `prisma.config.ts` usaba `env('DATABASE_URL')` (helper que
  **lanza** si falta). **CORREGIDO** (`2a911ef`): usa `process.env.DATABASE_URL ?? 'file:...'`
  — `generate` no necesita la URL; el runtime la resuelve vía adapter. ⚠️ Que faltara en el
  build sugiere que las env vars no estaban aplicadas → **verificar las 5 vars en Vercel**.
- **2026-06-10** — Renombrado UI: "Cotizador" → "Generador de Propuesta Técnico Comercial"
  (`767880f`). Ruta `/cotizador` y código en inglés sin cambios.
- **2026-06-11** — **Calidad del PDF (debugging sistemático con evidencia visual)**. Se
  rasterizó el PDF a PNG para inspeccionar. Causas raíz halladas y corregidas en
  `template.ts`: (1) `.cover { break-after: page }` forzaba una primera página casi vacía
  → eliminado, el contenido fluye tras la portada (base 3→2 págs); (2) caja "Validez"
  huérfana → `break-before: avoid` la mantiene con sus condiciones; (3) banner con franja
  blanca por margen negativo → banner limpio dentro del ancho de contenido. Tabla larga,
  totales y anexo fotográfico ya paginaban bien. **Tests añadidos** (`tests/unit/`,
  `npm run test:unit`): 16 casos (totales, render/anti-XSS, generación de PDF con bordes:
  vacío, estrés multipágina, monedas, caracteres especiales; guardia de regresión ≤2 págs).
  Scripts de diagnóstico: `scripts/diag-pdf.ts` (rasteriza para inspección visual).
- **2026-06-11** — Deploy con env vars OK: **login funciona en producción**, pero
  `/api/quotes/generate` daba **500** (Chromium serverless). Fixes (`da257f1`):
  (1) `outputFileTracingIncludes` fuerza el binario de `@sparticuz/chromium` dentro de la
  función (Next no lo trazaba → executablePath inexistente → 500); (2) `setContent` con
  `waitUntil:'load'` + tope de 2.5s a las fuentes (networkidle se cuelga en serverless);
  (3) el 500 ahora devuelve `detail` con el error real para diagnóstico desde el cliente.
  **Navegación**: barra de módulos persistente (Inicio/Propuestas/Recursos/Cronograma) con
  estado activo, header pegajoso, logo a inicio. Pendiente: verificar PDF en prod tras redeploy.

---

## 7. Runbook de despliegue (Vercel + Turso + GitHub)

> Estos pasos requieren **tus credenciales** (cuentas GitHub / Turso / Vercel). El asistente
> los ejecuta contigo o tú los corres con el prefijo `!` en el prompt.

### 7.1 GitHub (publicar el repo)
```bash
# Opción A — GitHub CLI (recomendado)
winget install GitHub.cli         # o: https://cli.github.com
gh auth login                     # autenticación interactiva
gh repo create ingegar-platform --private --source=. --remote=origin --push

# Opción B — manual: crea el repo vacío en github.com y luego:
git remote add origin https://github.com/<usuario>/ingegar-platform.git
git push -u origin main
```

### 7.2 Turso (base de datos serverless)
```bash
# Instala Turso CLI (https://docs.turso.tech/cli/installation) y autentica:
turso auth login
turso db create ingegar
turso db show ingegar --url            # → DATABASE_URL (libsql://...)
turso db tokens create ingegar         # → TURSO_AUTH_TOKEN
# Crea el esquema (una vez):
turso db shell ingegar < scripts/turso-bootstrap.sql
# Siembra el super admin + datos demo apuntando a Turso:
DATABASE_URL="libsql://...turso.io" TURSO_AUTH_TOKEN="<token>" npm run db:seed
```

### 7.3 Vercel (deploy)
```bash
npm i -g vercel
vercel login
vercel link                            # vincula el proyecto
# Variables de entorno (production):
vercel env add AUTH_SECRET production           # pega: npx auth secret
vercel env add DATABASE_URL production          # libsql://...turso.io
vercel env add TURSO_AUTH_TOKEN production       # token de Turso
vercel env add AUTH_TRUST_HOST production        # true
vercel env add PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD production  # 1
# AUTH_URL / NEXTAUTH_URL se setean al conocer el dominio final.
vercel --prod
```
Tras el deploy: setear `AUTH_URL` y `NEXTAUTH_URL` al dominio asignado y redeploy.

### 7.4 Auto-deploy (loop de feedback con tu socio)
Al conectar el repo de GitHub en el dashboard de Vercel (o vía `vercel link`), **cada push
a `main` despliega a producción** y cada push a otra rama genera una **URL de preview**.
Recomendado: trabajar en ramas `feature/*` → PR → preview para tu socio → merge a `main`.

---

## 6. Riesgos pendientes
1. **PDF en serverless** (§3.1) — mitigar con Chromium serverless o desplegar en contenedor.
2. **Persistencia de DB en serverless** (§3.2) — usar Turso/Postgres o volumen.
3. **Uploads no persistentes** (§3.3) — blob store para producción real.
4. **Next-auth en beta** (`5.0.0-beta.31`) — estable en la práctica, pero fijar versión.
5. **Vercel Hobby** prohíbe uso comercial — si se elige Vercel para uso real, plan Pro.
