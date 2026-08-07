# ENTREGA — INGEGAR ONE, Mejoras Portal Cliente

Brief fuente: `MEJORAS APP CAROLINA.html` (raíz del repo, dejado por el dueño, untracked).
Ledger detallado por fase: `docs/superpowers/plans/2026-08-06-portal-upgrade-progress.md`.
Formato de esta entrega: los 9 puntos que exige el brief en su sección `ENTREGA`.

Estado: **FASE 0–2, FASE 4, FASE 5, FASE 6 y FASE 7 completas y verificadas.** Nada pusheado a
`origin/main` todavía — 10 commits esperando confirmación explícita del dueño antes de push +
`db:migrate:prod` (2 migraciones aditivas nuevas).

---

## 1. Resumen de componentes reutilizados

- **`TicketItem`** (modelo existente, usado antes solo como checklist post-creación vía
  `addPortalTicketItem`) — extendido con `category`/`comment` en vez de crear un modelo
  "Requirement" paralelo (FASE 2).
- **`FilePreviewButton`** (interno) — su lógica de detección de tipo (`guessKind`) se hizo
  mimeType-aware y ganó soporte de video; ningún componente nuevo de preview para el lado interno.
- **`PortalDocumentPreview`/`PortalDocumentPreviewModal`** (nuevo en P1.1, pero deliberadamente el
  ÚNICO visor de documentos del portal desde entonces) — reusado por informes, otros documentos y
  ahora la biblioteca de informes (P1B), en vez de un visor nuevo por pantalla.
- **Patrón de selección múltiple de `proposals-table.tsx`** (Set-based, chequeo de membresía real
  para "seleccionar todos", nunca comparación de tamaño) — reusado tal cual en la biblioteca de
  informes del portal (P1B).
- **`buildZipFromBuffers`/`buildZipFromR2Keys`** (`src/lib/zip.ts`, ya existían) — reusados por el
  nuevo endpoint `/api/portal/informes/zip` en vez de un empaquetador ZIP nuevo.
- **Patrón `notify()` de `src/lib/push.ts`** (ya hacía in-app + push juntos) — envuelto, no
  reemplazado, por el nuevo servicio de preferencias (FASE 6).
- **`/api/notifications` (GET/PATCH)** — ya era genérico por sesión; el portal nunca tuvo su propia
  ruta, solo le faltaba una UI que lo consumiera (`PortalNotificationBell`, gemelo del
  `NotificationBell` interno).
- **`branchDeletionBlockers`** (nuevo, `src/lib/branches.ts`) — una sola función reusada por el
  delete interno (`flujo/actions.ts`) y el nuevo self-service del portal, en vez de duplicar el
  conteo Job/Ticket/User dos veces (FASE 5).
- **Patrón de confirm chip inline** (ya establecido en la sesión, ej. `document-quick-preview.tsx`)
  — reusado en cada acción destructiva nueva (eliminar requerimiento en el wizard, eliminar
  sucursal) — nunca `window.confirm` (frontend.md).
- **Convención Tailwind-interno / inline-portal** — cada componente nuevo del portal tiene su
  gemelo exacto del lado interno cuando aplica (`NotificationPreferencesForm` ↔
  `PortalNotificationPreferencesForm`, `NotificationBell` ↔ `PortalNotificationBell`) en vez de
  intentar un componente compartido que violaría la regla dura de estilos del portal.

## 2. Lista exacta de archivos modificados

45 archivos, +2469/-478 líneas, en 16 commits (`a9c4f48`..`2651d4d`, ver `git log --oneline
a9c4f48^..HEAD`). Lista completa vía `git diff --stat a9c4f48^..HEAD`:

**Schema / datos**
- `prisma/schema.prisma`
- `prisma/migrations/20260807175304_ticket_item_category_comment_and_item_scoped_documents/`
- `prisma/migrations/20260807222831_notification_preferences/`

**Backend / actions / endpoints**
- `src/app/api/reports/generate/route.ts`, `src/app/api/quotes/generate/route.ts`
- `src/app/api/portal/informes/zip/route.ts` (nuevo)
- `src/app/portal/[slug]/tickets/actions.ts`
- `src/app/portal/[slug]/sucursales/actions.ts`, `src/app/portal/[slug]/sucursales/page.tsx`
- `src/app/(app)/flujo/actions.ts`
- `src/app/(app)/cotizador/page.tsx` (fix no-relacionado, ver nota abajo)
- `src/lib/branches.ts` (nuevo)
- `src/lib/notifications/events.ts`, `service.ts`, `actions.ts` (nuevos)
- `src/lib/reports/resolve-informe-url.ts` (nuevo)
- `src/lib/reports/pdf.ts`, `src/lib/quotes/pdf.ts`, `src/lib/tickets/tickets.ts`

**Páginas**
- `src/app/portal/[slug]/informes/page.tsx`, `tickets/[id]/page.tsx`, `cuenta/page.tsx`
- `src/app/mi-panel/tickets/[id]/page.tsx`
- `src/app/(app)/perfil/page.tsx`

**Componentes**
- `src/components/tickets/photo-gallery.tsx`, `portal-branches-manager.tsx`,
  `portal-document-preview.tsx` (nuevo), `portal-informe-btn.tsx`, `portal-informe-list.tsx`,
  `portal-new-ticket-form.tsx`, `portal-notification-bell.tsx` (nuevo),
  `portal-notification-preferences-form.tsx` (nuevo), `portal-period-filter.tsx`,
  `portal-propuesta-list.tsx`, `portal-reports-export.tsx`, `portal-shell.tsx`,
  `ticket-controls.tsx`, `ticket-documents-panel.tsx`
- `src/components/ui/file-preview-modal.tsx`, `notification-preferences-form.tsx` (nuevo)

**Tests**
- `tests/e2e/portal-flow.spec.ts`, `tests/e2e/full-ticket-flow.spec.ts`

**Documentación / evidencia**
- `docs/superpowers/plans/2026-08-06-portal-upgrade-progress.md` (ledger, actualizado en cada fase)
- `docs/superpowers/plans/screenshots/2026-08-07-fase4-reportes-{desktop,mobile}.png`

Nota: `bd0bd1c` (fix del quoteId falso en propuestas nuevas) y `1a515fa` (fix de preview/duplicado
de documentos en tickets internos) son commits del mismo rango pero **no** son parte de este brief
— fueron bloqueantes de producción reportados en vivo durante la sesión, atendidos por separado con
su propia investigación y verificación, documentados en sus propios mensajes de commit.

## 3. Migraciones realizadas

Ambas **aditivas**, aplicadas solo en local (`file:./prisma/dev.db`) hasta ahora — **no** corridas
contra Turso prod todavía, pendiente confirmación explícita + `npm run db:migrate:prod` en el mismo
turno que el push, según `.claude/rules/production-safety.md`.

1. `20260807175304_ticket_item_category_comment_and_item_scoped_documents`
   - `ALTER TABLE ticket_items ADD COLUMN category TEXT` (nullable)
   - `ALTER TABLE ticket_items ADD COLUMN comment TEXT` (nullable)
   - `ticket_documents` gana `itemId TEXT` (nullable, FK → `ticket_items`, `ON DELETE SET NULL`) —
     rebuild de tabla estándar de SQLite para agregar la FK, con `INSERT...SELECT` que preserva
     cada fila existente (`itemId` queda `NULL` para todo lo histórico).
2. `20260807222831_notification_preferences`
   - Tabla nueva `notification_preferences` (`userId` único, `allEnabled`, `overrides` JSON).

Ningún dato existente fue tocado, movido o eliminado por ninguna de las dos.

## 4. Endpoints agregados o modificados

**Nuevo:**
- `POST /api/portal/informes/zip` — ZIP masivo de informes técnicos, ownership + branch scoping
  re-verificados server-side por id.

**Modificados:**
- `POST /api/reports/generate`, `POST /api/quotes/generate` — rama `role==='client'` ahora exige
  `{ documentId }` y re-deriva el contenido server-side (antes aceptaba `ReportData`/`QuoteData`
  crudo desde cualquier sesión autenticada, sin chequeo de dueño).
- `GET/PATCH /api/notifications` — sin cambios de contrato; simplemente ahora también lo consume el
  portal (antes solo la app interna).

**Server actions modificadas/nuevas** (no son rutas HTTP, pero cambian de forma/contrato):
- `createPortalTicket` — firma cambiada de `FormData` a un objeto tipado con `requirements: []`
  (acción interna, un solo caller, no es un contrato público).
- `deletePortalBranch` (nuevo), `togglePortalBranchActive` (gana audit log).
- `getMyNotificationPreferences`/`updateMyNotificationPreferences` (nuevos, `src/lib/notifications/actions.ts`).

## 5. Evidencia de las tres rondas de pruebas

**RONDA 1 — Funcional:** cubierta de forma distribuida durante cada fase, no repetida al final:
crear ticket 1 y 3 requerimientos + editar/eliminar antes de enviar (FASE 2, wizard completo
probado en vivo vía Playwright, ver commit `7283773`); previsualizar fotos/OT/informe + descarga
individual/ZIP + filtrar informes + selección múltiple (P1.1/P1.2/P1B, commits `01f64db`/`23c1a72`/
`452bff9`); inactivar sucursal con historial / eliminar sin historial / bloqueo de sucursal inactiva
(FASE 5, commit `387a68e`, verificado con datos reales de Just Burger — 27 sucursales, una con
historial real); configurar notificaciones + verificar que el evento correcto llegue al usuario
correcto (FASE 6, commit `fe9d763` — gating probado directo contra la DB real, no un mock).

**RONDA 2 — Regresión:** corrida contra la suite e2e real existente (`portal-flow.spec.ts`,
`full-ticket-flow.spec.ts`, `mobile-audit.spec.ts`, `security.spec.ts`), no reinventada a mano.
Encontró 2 regresiones reales causadas por la reescritura del formulario de FASE 2 (ver detalle en
`2651d4d`) — corregidas y las 3 pruebas afectadas confirmadas pasando individualmente contra el
harness real. `mobile-audit`'s fallas en `/dashboard` y `/tickets` (lista) y las 2 pruebas "flaky"
de `security.spec.ts` se investigaron y confirmaron **pre-existentes, sin relación** con este
trabajo (verificado con inspección DOM en vivo, no solo lectura de código). Un ticket histórico
pre-FASE-2 (`260806-JUST-ISIDORA-CP1`) se cargó sin errores en la vista interna, confirmando
compatibilidad hacia atrás.

**RONDA 3 — Errores y bordes:** PDF inexistente/corrupto (P0.6, `422`/`404` no `500`); 30+ fotos
(lazy loading agregado, P1.2); ZIP parcial con un archivo fallido (P1B — probado con datos reales,
2 de 3 documentos generados, el tercero un registro legado con dataJson incompleto, aislado
correctamente sin tumbar el resto); doble clic en guardar/enviar (guardia de 5s ya existente,
reusada sin cambios por FASE 2); sucursal inactiva vía API directa (P0.2, rechazo server-side);
usuario sin permisos (cross-client/cross-branch probado en 7 escenarios reales contra el ZIP de
informes, P1B); filtros vacíos / cero resultados (biblioteca de informes muestra "Sin resultados
para los filtros seleccionados", no un error). Correo fallido: no aplica — no existe canal de
correo en el sistema (ver hallazgo #7).

Comandos de validación técnica corridos en cada fase (no solo al final):
`npx tsc --noEmit`, `npm run lint`, `npm run test:unit` (271/271 en cada corrida), `npm run build` —
todos limpios en la verificación final post-FASE-7.

## 6. Capturas desktop y mobile

- `docs/superpowers/plans/screenshots/2026-08-07-fase4-reportes-desktop.png` (1280×800)
- `docs/superpowers/plans/screenshots/2026-08-07-fase4-reportes-mobile.png` (390×844)

El resto de las verificaciones visuales de esta sesión se hicieron en vivo vía Playwright
(snapshots de accesibilidad + inspección DOM directa) sin guardar captura de imagen — el detalle
completo de cada corrida vive en el ledger por fase.

## 7. Lista de hallazgos adicionales no corregidos

Documentados, no corregidos (fuera de alcance de este brief o requieren aprobación explícita):

1. **Sin canal de correo electrónico** — el brief lo condiciona a "si el sistema ya tiene envío
   estable"; no existe (grepeado: sin nodemailer/resend/sendgrid/SMTP). El centro de notificaciones
   (FASE 6) cubre in-app + push únicamente.
2. **`mobile-audit.spec.ts`: `/dashboard` y `/tickets` (lista interna) tienen elementos táctiles
   bajo 40px** — enlaces de stats (15px) y pills de filtro/estado (36px). Pre-existente, en
   archivos nunca tocados por este brief (`ticket-list-view.tsx` y el dashboard interno).
3. **Sidebar del portal**: los links de navegación (`Panel`, `Requerimientos`, etc.) renderizan a
   38px, bajo el estándar de 44px del propio proyecto — en `portal-shell.tsx`, tocado esta sesión
   solo para agregar la campanita, no para rediseñar la navegación.
4. **Sin persistencia de borrador** en el wizard de múltiples requerimientos — el brief permite
   "dentro de lo razonable"; un refresh accidental antes de "Confirmar y enviar ticket" pierde los
   requerimientos ya guardados (viven solo en estado de React). Decisión de alcance explícita, no
   un olvido.
5. **Creación de ticket multi-requerimiento no es transaccional** — `createPortalTicket` crea el
   `Ticket` y luego cada `TicketItem`/`TicketDocument` en llamadas separadas, no en un
   `$transaction`. Si una falla a mitad de camino, el ticket queda con menos items de los
   esperados. **Patrón pre-existente** (el flujo de un solo requerimiento de antes tenía el mismo
   problema entre `ticket.create` y `documents.createMany`) — no introducido por este cambio, pero
   tampoco corregido; una mejora real, cambiaría el alcance de FASE 2.
6. **Sin flujo de creación multi-requerimiento del lado staff** (`/tickets/new` interno) — el brief
   escopea FASE 2 explícitamente al portal. Staff ya ve el resultado correctamente (vía las 3
   superficies actualizadas) cuando crea en nombre de un cliente a través del propio portal.
7. **`status` de `TicketItem`** (pendiente/en_proceso/resuelto) sigue sin ningún camino de
   actualización en toda la app (confirmado por grep) — se crea una vez y se muestra de solo
   lectura en todas partes, igual que antes de este cambio.
8. **"Nunca regenerar un PDF ya generado"** (requisito explícito de FASE 3/P1B) — no implementado;
   no existe caché de PDFs en el código hoy. Cada previsualización/descarga siempre re-renderiza.
   Backlog explícito, requiere su propio diseño (R2 + invalidación por versión de contenido).

## 8. Riesgos y plan de reversión

**Riesgo principal:** ninguno de los 16 commits está pusheado a `origin/main` ni las 2 migraciones
corridas contra Turso prod — el riesgo real hoy es cero para producción, todo vive en local.

**Al pushear:** ambas migraciones son aditivas (columnas/tabla nuevas, nullable, sin tocar filas
existentes) — el camino seguro ya establecido en el proyecto (`scripts/turso-migrate.ts`, aplicado
en el mismo turno que el push) cubre el riesgo estándar. Reversión si algo sale mal después de
pushear: revertir el o los commits vía `git revert` (nunca `reset --hard` sobre `main`); las
migraciones no necesitan revertirse en la base — columnas/tabla nuevas sin uso no rompen código
anterior si el código se revierte primero.

**Puntos de mayor superficie de cambio** (donde un bug tendría más impacto si aparece):
- `createPortalTicket`: cualquier ticket portal nuevo pasa por acá. Ya probado con 1 y 3
  requerimientos, con y sin archivos, con y sin sucursal fija — pero es el punto único de creación
  de todo ticket del portal desde ahora.
- `/api/reports/generate` y `/api/quotes/generate`: el cambio de ownership-check es de seguridad
  real (cerraba un hueco genuino) — un rollback accidental de solo este archivo reabriría ese hueco.

**Reversión granular si una sola fase necesita deshacerse** sin afectar a las demás: cada fase es
su propio commit atómico (`7283773`=FASE2, `387a68e`=FASE5, `fe9d763`=FASE6, `ee7614f`=FASE4,
`2651d4d`=fixes de FASE7) — revertibles individualmente vía `git revert <hash>` sin tocar las otras,
salvo conflictos triviales de línea adyacente en `ticket-controls.tsx`/`portal-shell.tsx` (tocados
por más de una fase).

## 9. Confirmación explícita

- ✅ **No se rehízo la aplicación** — cada fase extendió componentes/modelos/patrones existentes
  (`TicketItem`, `notify()`, `FilePreviewButton`'s lógica, `proposals-table.tsx`'s selección,
  `zip.ts`) en vez de reemplazarlos. Ningún módulo que funcionaba fue reescrito desde cero salvo
  `PortalNewTicketForm`, y ese SÍ era el pedido explícito de FASE 2.
- ✅ **No se eliminaron datos** — ambas migraciones son aditivas; ninguna corrección de esta sesión
  borró filas reales (la única sucursal borrada fue una de prueba, restaurada de inmediato).
- ✅ **Los flujos existentes continúan funcionando** — confirmado por la suite e2e real (54+
  pruebas pasando, las 2 regresiones reales encontradas ya corregidas y re-confirmadas), un ticket
  histórico pre-FASE-2 verificado en vivo, y cada fase individual con su propia verificación en
  datos reales de Just Burger (34 informes, 27 sucursales, tickets reales).
- ✅ **Los cambios fueron validados al menos tres veces** — cada fase corrió `tsc`+`lint`+
  `test:unit`+`build` en su propio commit, más una corrida final consolidada post-FASE-7, más la
  verificación en vivo (Playwright, DB directa, o ambas) específica de cada fase documentada en el
  ledger.

---

**Siguiente paso recomendado:** confirmar con el dueño el push de los 10 commits + la corrida de
las 2 migraciones contra Turso prod (mismo turno, según production-safety.md). FASE 3 (biblioteca
de informes, ya cubierta como P1B) y FASE 2/4/5/6/7 quedan completas; el brief completo (FASE 0–7)
está cerrado.
