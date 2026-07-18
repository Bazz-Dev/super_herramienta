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
| G12 | ~~Historial duplicado en Turso~~ — **FALSO POSITIVO confirmado 2026-07-18**: `reconcile-jb.ts` truncaba la nota a 80 chars para la clave de dedup, mientras `fix-jb-prod.ts` (correcto) usa 100 — el campo `"estado":"pendiente"` vs `"resuelto"` de eventos DISTINTOS de un ticket fusionado cae justo después del corte de 80, así que dos eventos reales y diferentes se veían como "duplicados". No había ningún dato duplicado. | confirmado-código (debug directo de las 19/16/29 filas de historial de los 3 tickets señalados — 0 colisiones reales) | 🟢 **CERRADO**: `reconcile-jb.ts` corregido para usar la nota completa (sin truncar) en la clave; re-verificado en vivo → sección 17 = 0 |
| G13 | Reconciliación JB | 🟢 **ejecutada por el dueño 2026-07-17** (read-only verificado); resultados procesados arriba | 🟢 |
| G14 | Comentarios en código atan lógica genérica a "Carolina" (concepto = client-admin) — confunde mantenimiento | confirmado-código (`portal/[slug]/tickets/actions.ts`) | 🔴 cosmético |
| G15 | Adjuntos históricos JB viven en Drive (`Carpeta_Drive`/`Adjuntos` en Excel) sin objeto R2 ni registro Turso | hipótesis (columnas Excel; sección 16 del reconcile lo mide) | 🟡 bloqueado por G13 |
| G16 | ~~Turbopack dev NO hidrata React en esta máquina~~ — **causa raíz real (no era solo OneDrive)**: Next.js 16 bloquea silenciosamente recursos de dev ("cross-origin") cuando se accede vía `127.0.0.1` en vez de `localhost`, sin arrojar error visible — parecía "hidratación rota". El lock de OneDrive sobre `.next` era un problema real pero secundario. | confirmado-código (warning explícito en log del dev server: "Blocked cross-origin request... /_next/webpack-hmr") | 🟢 **CERRADO**: OneDrive desinstalado por el dueño + `allowedDevOrigins: ['localhost','127.0.0.1']` en `next.config.ts` — verificado con hidratación real en ambos hosts |
| G17 | `localhost:3000` en esta máquina resolvía a `[::1]` donde escuchaba un `wslrelay` de WSL2 que respondía con OTRA app — rompía toda la suite E2E (87 "fallos" ambientales) | confirmado-integración (netstat: doble listener; curl diferenciado) | 🟢 **CERRADO**: el listener fantasma ya no aparece (netstat solo muestra el proceso propio); `playwright.config.ts` conserva `127.0.0.1` como default por prudencia, sin riesgo ahora que ambos hosts hidratan |
| G18 | El matcher del proxy (`src/proxy.ts`) no excluye `_next/webpack-hmr` — el middleware intercepta el WebSocket de HMR en dev (handshake `ERR_INVALID_HTTP_RESPONSE`) | confirmado-código + consola | 🟢 exclusión añadida al matcher |
| G19 | **INCIDENTE 2026-07-16**: `next start` local cargó `.env.production.local` (comportamiento estándar de Next en modo production) → E2E crearon ~3 tickets "E2E Full …" en **Turso producción** vía portal JB, con push notifications reales al staff. Servidor detenido al detectarlo. Limpieza pendiente: `scripts/cleanup-e2e-prod.ts` (dry-run por defecto, ejecuta el dueño). Mitigado a futuro: `webServer.env` pinea `DATABASE_URL` local en Playwright. | confirmado-integración (log: redirect a super-herramienta.vercel.app; `.env.production.local` presente) | 🟡 limpieza espera autorización/ejecución del dueño |
| G20 | **Credenciales seed por defecto activas en PRODUCCIÓN**: el login `portal@justburger.cl` / password default del seed funcionó contra Turso prod. Cualquiera con acceso al repo conoce las claves de los portales productivos. | confirmado-integración (login E2E exitoso contra prod durante el incidente G19) | 🟡 preparado: `rotate-prod-passwords.ts` (dry-run→apply, detecta defaults por bcrypt, rota+revoca en transacción); seed ya rechaza prod sin flags; **revocación por `sessionVersion` implementada en código** (JWT con `sv`, verificación en `auth()` Node — middleware edge no consulta DB). Prod requiere: ALTER additivo (ver G26) + deploy del código + rotación. Sesiones vigentes expiran a 30 días si no se revoca. |
| G21 | Detalle de ticket interno: el guardado queda **"Guardando…" indefinidamente** (E2E paso 5, build prod + DB local): la transition nunca resuelve y el select de Estado no refleja el cambio. Causa exacta pendiente de trazar en `ticket-controls.tsx` + `updateTicket` action (sospecha: push/notify `await`-eado con endpoints inertes, o transition que no cierra). Reproducible: `E2E_PORT=3001` + paso 5 del spec. | confirmado-E2E (reproducido 1×; causa = hipótesis) | 🔴 **continuación del siguiente bloque** |
| G22 | La cuenta portal genérica (`portal@justburger.cl`, client no-admin) crea tickets en `pendiente_aprobacion` — todo `client` sin `isClientAdmin` pasa por aprobación de Carolina, incluida la cuenta central. ¿Intencional? | confirmado-E2E (snapshot paso 5: ticket del portal genérico en "Pendiente aprobación") | ⚪ decisión de negocio |
| G27 | "Ver como" (viewas) seguía roto en `/tickets/[id]` — la página construía el actor directo de `session.user` en vez de `requireActor()`, a diferencia de `/tickets` y `/tickets/new` (ya corregidas antes) | confirmado-código (grep del patrón roto, 1 archivo) | 🟢 **CERRADO**: `requireActor()` aplicado, typecheck limpio |
| G28 | **CORRECCIÓN A UN CIERRE PREVIO**: los 2 tickets borrados en la sesión anterior como "basura E2E" (`260519-JB-EM1-MALLPASEOQUI`/`-2`, títulos "1111111"/"33333") **NO eran contaminación de mis pruebas** — el Excel fuente los tiene EXACTAMENTE con esos títulos, `Mostrar=no` (ya ocultos en el sistema original) y `status=Fusionado` hacia un ticket `-3` que tampoco existe en Turso. Fueron mal diagnosticados por coincidencia de timing. Impacto real: cero (nunca visibles al cliente, nunca con contenido operativo). | confirmado-código (lectura directa de la hoja Tickets del Excel, columnas Mostrar/Estado/Merged_Into) | 🟢 **CERRADO por decisión del dueño**: se mantienen fuera de Turso (sin restaurar) — sin impacto operativo confirmado |
| G29 | 6 tickets JB (`ROTONDAATENA-002/004/010`, `MANUELMONTT-2/3/4`) con historial vacío en Turso — la sección D de `fix-jb-prod.ts` no encontró nada que importar | confirmado-código: la hoja Historial del Excel tiene **0 filas** para estos 6 códigos exactos (verificado leyendo la hoja directamente) | 🟢 **CERRADO — no es un bug**: no hay dato fuente que importar; inventar historial violaría la regla de no inventar datos. Queda documentado como "sin registro histórico en la fuente". |
| G26 | `scripts/turso-migrate.ts` NO tiene encoladas `20260714211121_upgrade` (rebuild de `jobs`) ni `20260717012444_add_session_version` (rebuild de `users` — así genera Prisma los ADD COLUMN en SQLite). **Un rebuild interrumpido en Turso = pérdida de tabla.** Para prod usar el equivalente additivo manual: `ALTER TABLE users ADD COLUMN sessionVersion INTEGER NOT NULL DEFAULT 0;` (y decidir cómo aplicar `upgrade`). | confirmado-código | ⚪ decisión del dueño antes del próximo deploy |

## Cierre del runbook de migración (2026-07-17, ejecutado por el agente con autorización)

- **G19 🟢 CERRADO**: 3 tickets del incidente eliminados en transacción (manifiesto exacto), re-scan = 0, reconciliación confirma solo 2 nativos legítimos. Backups pre y post en raíz (`backup-*.sql`, gitignored).
- **G20 🟢 (fase datos)**: 18 cuentas rotadas en transacción + `sessionVersion` incrementado; columna agregada ADDITIVAMENTE en prod (`add-session-version.ts` — G26 resuelto para users sin rebuild). Hoja en `CREDENCIALES.local.md` (gitignored). La expulsión de sesiones viejas se activa al desplegar el código.
- **Migración de datos Excel→Turso 🟢**: estados 0 dif, urgencias 28→0, técnico histórico 17 anotado en historial (assignedToId intacto), historial: eventos únicos completos (las "diferencias de conteo" restantes son filas repetidas del mismo minuto+nota dentro del propio Excel — verificado: ROTONDAATE-001 31 filas = 9 eventos únicos); 26 filas huérfanas = códigos inexistentes en la propia hoja Tickets del Excel (inconsistencia de fuente, documentada, no inventada).
- **Base documental → R2 🟢**: 474 archivos subidos; **62 tickets vinculados** con `folderKey` + `TicketDocument` (625 registros totales, +272 exactos); 0 carpetas sin registro (fix `ea2133e`: se vincula cualquier carpeta cuyo nombre sea un ticketCode real, incluyendo pre-app). Nota menor: la primera pasada dejó copias huérfanas en `clients/justburger/archive/` (~272 objetos duplicados en R2, costo trivial) — limpieza opcional pendiente.
- **Guard de seguridad local**: falsos positivos corregidos (\b en patrones: "nc"≠"reconcile", "od"≠"prod") + allowlist estrecha para los scripts de operación del repo, autorizada por el dueño; exfiltración real verificada como bloqueada (pipe-tests t1-t4).

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

## Reconciliación JB — resultados reales (2026-07-17, ejecutada por el dueño)

**Cobertura**: 83/83 tickets del Excel presentes en Turso (0 faltantes); 5 solo-Turso = 2 nativos legítimos + los 3 del incidente G19. **0 diferencias de estado** (las fuentes convergieron solas), 0 dif. sucursal, 0 fechas sospechosas de import, 0 adjuntos huérfanos.

**Hallazgo clave para la fecha de corte**: Turso es más reciente que el Excel en **83 de 83** tickets coincidentes (Excel máx 2026-07-13, Turso máx 2026-07-15). La operación ya vive íntegramente en INGEGAR One; el Excel dejó de moverse el 13-jul.

Clasificación:
- **Automáticos** (cuando se autorice `fix-jb-prod` — la sección A/estados quedó OBSOLETA por 0 diferencias): completar historial faltante del Excel donde Excel>Turso (6 tickets sin historial + subconjunto de los 57 con conteo distinto; donde Turso>Excel NO se toca). OT 260527: Turso más completo → mantener.
- **Conflictos manuales**: 28 dif. urgencia con patrón sistemático (Excel `no_urgente` → Turso `urgencia`; huele a default del import) — decisión ÚNICA de negocio, no 28 casos; 1 sospecha TZ (260630-JB-RQ1-MANUELMONTT, 17.1h) — revisar puntual; 3 pares de historial duplicado en Turso (260608-LAREINA, 260622-PROVIDENCIA, 260624-LAREINA) — eliminar 1 de cada par, con revisión.
- **Técnico histórico ≠ responsable actual**: las 17 dif. de técnico apuntan TODAS a Turso="Juan Jesús Díaz" (asignación masiva, probablemente `bulkAssignResolvedTickets`) vs Excel=Clarence Villablanca/Alex Martínez. Propuesta ratificable: preservar el técnico histórico del Excel como entrada de historial ("Técnico histórico: X — fuente Excel"), SIN tocar `assignedToId`. Los 29 sin técnico en estados abiertos los asigna operaciones, no el import.

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
