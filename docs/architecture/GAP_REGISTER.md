# GAP REGISTER — INGEGAR One

Registro único de brechas de estabilización. Cada entrada lleva categoría de evidencia:
`confirmado-código` | `confirmado-datos` | `confirmado-integración` | `confirmado-E2E` | `hipótesis` | `pendiente` | `decisión-requerida`.

Estados: 🔴 abierta · 🟡 en curso · 🟢 cerrada (con evidencia) · ⚪ decisión de negocio.

Última actualización: 2026-07-16.

| # | Brecha | Evidencia | Estado |
|---|--------|-----------|--------|
| G1 | `fix-jb-prod.ts` pisa estados de Turso con Excel sin fecha de corte — puede regresar tickets ya avanzados en la app | confirmado-código (`scripts/fix-jb-prod.ts` sección A) | ⚪ requiere regla de corte (propuesta en §Regla de corte) |
| G2 | `ClientDocument`↔`Ticket` relacionados por `metadata` JSON, no FK — no consultable ni con integridad referencial | confirmado-código (`ClientDocument.metadata`, schema línea 672) | 🔴 |
| G3 | Documentos RR.HH.: `TechnicianDocument.fileUrl` comenta ruta legacy `/uploads/docs/` (¿no R2? muere en serverless) | hipótesis (comentario schema línea 479) | 🔴 verificar flujo real de subida |
| G4 | `docs/ARQUITECTURA.md` congelado en v1.8: sin `pendiente_aprobacion`, plantillas viejas, versión errónea | confirmado-código (auditoría 2026-07-15) | 🔴 actualizar SOLO tras comprobar flujos reales |
| G5 | CLAUDE.md documenta tenants inexistentes (`justburger`,`loficoffee`) y password admin equivocado | confirmado-código (`prisma/seed.ts:19-25` vs CLAUDE.md:83-84) | 🔴 |
| G6 | R2 en desarrollo: credenciales/bucket sin confirmar — adjuntos E2E dependen de esto | pendiente (paso 9 de `full-ticket-flow.spec.ts`) | 🟡 |
| G7 | Cadena informe→ticket→carpeta cliente sin prueba end-to-end (el fix de autocompletar cliente ya está commiteado) | pendiente | 🔴 |
| G8 | Paginación de tickets ausente: `getTickets` con límite fijo subido a 500 (commit a109a96) en vez de paginar | confirmado-código (`src/lib/tickets/tickets.ts`) | 🔴 |
| G9 | PWA multi-instalación (INGEGAR One + JB + otro portal simultáneos): colisión real no reproducida | pendiente (requiere prueba manual en dispositivo/Chrome) | 🔴 |
| G10 | Matriz de permisos por rol verificada solo en UI; falta verificación server-side sistemática por acción | pendiente (paso 7 del E2E cubre un caso técnico) | 🔴 |
| G11 | Flujo Ticket→Trabajo→Gasto→Costo→Cobro→Flujo de caja sin E2E; riesgo de doble conteo no verificado | pendiente | 🔴 |
| G12 | Historial duplicado en Turso por posibles importaciones repetidas | hipótesis (sección 17 de `reconcile-jb.ts` lo mide) | 🟡 bloqueado por G13 |
| G13 | Reconciliación JB: el security-guard local bloquea `--env-file=.env.production.local` + red; requiere ejecución manual del dueño | confirmado-integración (hook `security-guard.sh`) | 🟡 comando listo, espera ejecución manual |
| G14 | Comentarios en código atan lógica genérica a "Carolina" (concepto = client-admin) — confunde mantenimiento | confirmado-código (`portal/[slug]/tickets/actions.ts`) | 🔴 cosmético |
| G15 | Adjuntos históricos JB viven en Drive (`Carpeta_Drive`/`Adjuntos` en Excel) sin objeto R2 ni registro Turso | hipótesis (columnas Excel; sección 16 del reconcile lo mide) | 🟡 bloqueado por G13 |
| G16 | **Turbopack dev NO hidrata React en esta máquina** (cero fibers en todas las páginas, todos los navegadores; el mismo código hidrata perfecto en build de producción). `.next` no se puede ni renombrar: locks de OneDrive — el repo vive en `OneDrive\Desktop`, violando la regla propia "repos fuera de C:\". Workaround activo: E2E contra build prod (`E2E_PORT=3001`). | confirmado-integración (probes con fibers React, dev vs prod, Chromium headless + Chrome real) | 🔴 mover repo fuera de OneDrive o limpiar `.next` con OneDrive pausado |
| G17 | `localhost:3000` en esta máquina resuelve a `[::1]` donde escucha un `wslrelay` de WSL2 que responde con OTRA app — rompía toda la suite E2E (87 "fallos" ambientales). Mitigado: Playwright ahora usa `127.0.0.1`. | confirmado-integración (netstat: doble listener; curl diferenciado) | 🟢 mitigado en `playwright.config.ts`; conviene documentarlo en CLAUDE.md |
| G18 | El matcher del proxy (`src/proxy.ts`) no excluye `_next/webpack-hmr` — el middleware intercepta el WebSocket de HMR en dev (handshake `ERR_INVALID_HTTP_RESPONSE`) | confirmado-código + consola | 🟢 exclusión añadida al matcher |
| G19 | **INCIDENTE 2026-07-16**: `next start` local cargó `.env.production.local` (comportamiento estándar de Next en modo production) → E2E crearon ~3 tickets "E2E Full …" en **Turso producción** vía portal JB, con push notifications reales al staff. Servidor detenido al detectarlo. Limpieza pendiente: `scripts/cleanup-e2e-prod.ts` (dry-run por defecto, ejecuta el dueño). Mitigado a futuro: `webServer.env` pinea `DATABASE_URL` local en Playwright. | confirmado-integración (log: redirect a super-herramienta.vercel.app; `.env.production.local` presente) | 🟡 limpieza espera autorización/ejecución del dueño |
| G20 | **Credenciales seed por defecto activas en PRODUCCIÓN**: el login `portal@justburger.cl` / password default del seed funcionó contra Turso prod. Cualquiera con acceso al repo conoce las claves de los portales productivos. | confirmado-integración (login E2E exitoso contra prod durante el incidente G19) | 🟡 preparado: `rotate-prod-passwords.ts` (dry-run→apply, detecta defaults por bcrypt, rota+revoca en transacción); seed ya rechaza prod sin flags; **revocación por `sessionVersion` implementada en código** (JWT con `sv`, verificación en `auth()` Node — middleware edge no consulta DB). Prod requiere: ALTER additivo (ver G26) + deploy del código + rotación. Sesiones vigentes expiran a 30 días si no se revoca. |
| G21 | Detalle de ticket interno: el guardado queda **"Guardando…" indefinidamente** (E2E paso 5, build prod + DB local): la transition nunca resuelve y el select de Estado no refleja el cambio. Causa exacta pendiente de trazar en `ticket-controls.tsx` + `updateTicket` action (sospecha: push/notify `await`-eado con endpoints inertes, o transition que no cierra). Reproducible: `E2E_PORT=3001` + paso 5 del spec. | confirmado-E2E (reproducido 1×; causa = hipótesis) | 🔴 **continuación del siguiente bloque** |
| G22 | La cuenta portal genérica (`portal@justburger.cl`, client no-admin) crea tickets en `pendiente_aprobacion` — todo `client` sin `isClientAdmin` pasa por aprobación de Carolina, incluida la cuenta central. ¿Intencional? | confirmado-E2E (snapshot paso 5: ticket del portal genérico en "Pendiente aprobación") | ⚪ decisión de negocio |
| G26 | `scripts/turso-migrate.ts` NO tiene encoladas `20260714211121_upgrade` (rebuild de `jobs`) ni `20260717012444_add_session_version` (rebuild de `users` — así genera Prisma los ADD COLUMN en SQLite). **Un rebuild interrumpido en Turso = pérdida de tabla.** Para prod usar el equivalente additivo manual: `ALTER TABLE users ADD COLUMN sessionVersion INTEGER NOT NULL DEFAULT 0;` (y decidir cómo aplicar `upgrade`). | confirmado-código | ⚪ decisión del dueño antes del próximo deploy |

## Cerradas (continuación)

| # | Brecha | Cierre |
|---|--------|--------|
| G23 | Técnico sin vía para registrar atención | **confirmado-E2E**: `/mi-panel/tickets` (lista) + `[id]` (detalle) + `tecnico-ticket-actions` — transiciones acotadas (`TECNICO_TRANSITIONS`, cierre reservado a supervisión), comentario, evidencia a R2. Server-side: `requireActor(['tecnico'])` + `assignedToId` en actions y en `POST /api/tickets/[id]/documents` (subir sí, borrar no). Sigue vedado el listado interno. E2E paso 7 verde (run 13). |
| G24 | "Revalidación borra texto" | Reclasificada con evidencia: el texto no se borraba — el **único `useTransition` compartido** bloqueaba todos los controles mientras cualquier acción corría. Fix: transiciones separadas (fields/status/comment) + indicador "· guardando…" en Estado. E2E pasos 5-6 estables. |
| G25 | Colisión de `ticketCode` en creación interna: mismo día+cliente+urgencia+sucursal → violación de unique y **la creación falla silenciosamente** (el portal deduplicaba; el interno no) | **confirmado-E2E+datos** (run 12 paso 11): dedup con sufijo agregado a `createTicket` (mismo patrón del portal). Run 13 verde. |

## Procedimiento de contención G19 (orden estricto — ejecuta el dueño)

0. **Validar CLI**: `turso --version` (si no existe: `irm get.tur.so/install.ps1 | iex` en PowerShell o `curl -sSfL https://get.tur.so/install.sh | bash` en WSL) → `turso auth login` → `turso db list` para confirmar el nombre exacto de la DB. Si `.dump` no está disponible en tu versión: `turso db shell <nombre-db> ".dump"` (comillas) o exportar por tablas.
1. **Backup de Turso producción** (elige una):
   - Dump lógico completo (recomendado, requiere Turso CLI logueado):
     `turso db shell <nombre-db> .dump > backup-g19-$(date +%Y%m%d-%H%M).sql`
   - Verificar el dump: que el archivo pese >0 y contenga `CREATE TABLE tickets`.
   - Nota: los planes pagos de Turso incluyen point-in-time restore — si está activo, anotar el timestamp actual como punto de restauración.
2. **Scan read-only** → genera el manifiesto de IDs exactos:
   `npx tsx --env-file=.env.production.local scripts/cleanup-e2e-prod.ts --scan`
3. **Revisión humana** del manifiesto `docs/architecture/incident-g19-manifest.json` + salida del scan → aprobación explícita en el chat.
4. **Aplicar** (solo tras 1-3): `npx tsx --env-file=.env.production.local scripts/cleanup-e2e-prod.ts --apply --confirm-g19`
   - Borra solo IDs del manifiesto, re-verificados campo a campo, en transacción. Aborta ante cualquier desviación. No toca usuarios, notificaciones ni R2.

## Regla de corte Excel/Turso (propuesta — decisión requerida)

1. **Fecha de corte** = fecha de creación del primer ticket nativo de INGEGAR One (mínimo `createdAt` de los tickets "solo en Turso" que entrega la sección 10 del reconcile). No se elige a mano: sale de los datos.
2. **Antes del corte**: Excel es autoritativo → se completa lo faltante en Turso (historial, fechas, técnico histórico). Nunca se borra lo ya existente.
3. **Después del corte**: Turso es autoritativo → ningún dato del Excel pisa estados, técnicos ni fechas posteriores al corte.
4. **Conflictos**: ticket con actividad en ambas fuentes después del corte (sección 14 del reconcile: "Excel más nuevo que Turso") → lista de revisión manual, nunca resolución automática.
5. **Técnico histórico ≠ responsable actual**: la columna `Tecnico` del Excel se conserva como dato histórico (nota/historial); `assignedToId` actual solo lo define operaciones sobre tickets abiertos.

## Cerradas

| # | Brecha | Cierre |
|---|--------|--------|
| C1 | Hardcode `-JB-` en form interno de tickets (todos los clientes salían como JB) | confirmado-código+build; commit `5e0bbc6`; validación E2E en paso 11 del spec |
| C2 | Plantilla `basica` inexistente y `pro` sin banner de portada; docs legacy `minimal` rompían Zod | confirmado-código+unit+PDF real; commit `afad6af` |
| C3 | `fix-jb-prod.ts` inventaba datos (estado desconocido→resuelto, fecha inválida→now) y escribía sin dry-run | confirmado-código; commit `0f512e4` |
| C4 | Hook `syntax-check.sh` fallaba en Windows por `python3` inexistente | confirmado-código; guard `command -v python3` (fuera del repo, `~/.claude/hooks/`) |
