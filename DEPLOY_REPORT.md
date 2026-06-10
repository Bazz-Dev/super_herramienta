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
  en `main`, **sin remoto**. Pendiente: decisión de hosting + credenciales.

---

## 6. Riesgos pendientes
1. **PDF en serverless** (§3.1) — mitigar con Chromium serverless o desplegar en contenedor.
2. **Persistencia de DB en serverless** (§3.2) — usar Turso/Postgres o volumen.
3. **Uploads no persistentes** (§3.3) — blob store para producción real.
4. **Next-auth en beta** (`5.0.0-beta.31`) — estable en la práctica, pero fijar versión.
5. **Vercel Hobby** prohíbe uso comercial — si se elige Vercel para uso real, plan Pro.
