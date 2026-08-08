# INGEGAR Platform — Arquitectura y Contexto

> Documento de referencia para navegación rápida. Actualizar al agregar módulos o cambiar modelos.
> Última actualización: 2026-07-28 — v1.13.0. **Pendientes vivos: ver `docs/architecture/GAP_REGISTER.md`** (2 abiertos ahora mismo — G19: limpieza de tickets E2E que se filtraron a Turso prod el 2026-07-16, espera autorización del dueño; G22: decisión de negocio sobre aprobación de la cuenta portal genérica). Este documento describe arquitectura estable, no tracking de tareas.
>
> **PROD es la fuente de verdad.** Flujo permitido: `PROD → snapshot LOCAL`. Nunca `LOCAL → PROD`. Ver `.claude/rules/production-safety.md`.

---

## Para qué sirve la plataforma

Herramienta interna de gestión de INGEGAR. Centraliza operaciones, recursos, facturación y comunicación con clientes. Multi-tenant: INGEGAR opera varios clientes (Just Burger, Decathlon, Unity, otros futuros).

---

## Usuarios y roles

| Rol | Quién | Acceso |
|-----|-------|--------|
| `super` | Gerencia INGEGAR (Sergio, admin) | Todo — todos los tenants |
| `supervisor` | Staff operacional (Cristian, Sebastián) | App interna — tenant propio |
| `tecnico` | Técnicos en terreno | Solo `/mi-panel` (autoservicio + FES) |
| `client` | Contacto del cliente (Carolina JB, etc.) | Solo portal propio `/portal/{slug}` |

**`client` no es un rol plano**: `User.branchId` (opcional) + `User.isClientAdmin` determinan qué ve. Sin `branchId` o con `isClientAdmin=true` → ve todo el cliente. Con `branchId` y `isClientAdmin=false` (usuario de sucursal) → scopeado a esa sucursal en tickets/dashboard/reportes, y sus tickets nuevos entran en `pendiente_aprobacion` en vez de `nuevo` hasta que un admin del cliente los apruebe. Ver Portal cliente y Ticket — `status` más abajo.

**Regla clave**: `role=client` y `role=tecnico` NUNCA entran a la app interna. El middleware los redirige a su superficie correspondiente.

---

## Superficies de la app

### 1. App interna (`/`) — staff INGEGAR
Ruta base protegida. Solo `super` y `supervisor`.

### 2. Portal cliente (`/portal/{slug}`) — clientes + staff
Cada cliente tiene su portal propio con tema visual (solo `primary` desde DB; bg/card/text hardcoded claros).
- JB: `/portal/justburger` — tema rojo oscuro
- Decathlon: `/portal/decathlon` — tema azul

**Portal rules**: portal siempre light mode (inline styles, nunca CSS vars). Clientes pueden editar tickets y agregar sub-tareas si `status=nuevo|en_revision`.

### 3. Mi Panel (`/mi-panel`) — técnicos
Superficie de autoservicio para `role=tecnico`. Sidebar propio (`MiPanelSidebar`) con el mismo patrón responsive del sidebar interno (drawer móvil + fijo en desktop) — reemplaza la barra superior mínima anterior, deja espacio para agregar secciones de autoservicio sin re-diseñar. Firma electrónica simple (FES) + asignaciones + gastos.

---

## Módulos actuales (v2.0.0)

### Cronograma (`/cronograma`)
**Para qué**: Calendario de trabajos en terreno.
**Modelos**: `Assignment`, `AssignmentAssignee`
**Vistas**: Día/Semana/Mes + Por técnico (swimlane) + Carga laboral.
**Mobile**: vista agenda list (< md) — asignaciones próximas agrupadas por día, ordenadas por fecha, click abre modal de detalle.
**Vinculación**: `Assignment.ticketId` — un trabajo puede estar vinculado a un ticket.

### Tickets (`/tickets`) — Staff + Portal cliente
**Para qué**: Gestión de requerimientos de clientes.
**Modelos**: `Ticket`, `TicketHistory`, `TicketItem`, `TicketDocument`, `TicketCollaborator`
**Campos clave**: `showToClient`, `internalNotes`, `deletedAt` (soft delete), `folderKey` (R2 prefix), `parentTicketId` (fusión, sin `@relation` — resolver con query propia)
**Portal**: cliente ve tickets con `showToClient=true`, puede editar si `status=nuevo`, agregar sub-tareas si `status=nuevo|en_revision`.
**Aprobación de sucursal**: un usuario de portal con `branchId` (no admin) crea tickets en `pendiente_aprobacion`; un admin del cliente los aprueba (→`nuevo`, notifica staff) o rechaza (→`cancelado`) desde `/portal/[slug]/tickets` (`approvePortalTicket`). Staff y usuarios de portal sin `branchId`/con `isClientAdmin` crean directo en `nuevo`.
**Fusión**: exclusiva del portal cliente (admin del cliente) — INGEGAR One no tiene esta opción en su selector de Estado. Fusionar es confirmación explícita e irreversible por acción; desfusionar restaura el `status` exacto previo a la fusión (leído de `TicketHistory`, no un default fijo). Cerrados en INGEGAR One incluye `fusionado` (antes era invisible en toda vista interna).
**Eliminar**: disponible en Activos y Cerrados (mismo `deleteTicket`, gate `super`/`supervisor`).
**Correlativo de `ticketCode`** (`createTicketWithUniqueCode`, `src/lib/tickets/ticket-code.ts`): la colisión (mismo día+cliente+urgencia+sucursal) ya no se maneja con un check previo + sufijo `Date.now()` — reintenta la creación real sobre la constraint única (`P2002`) con un sufijo determinístico (`-2`, `-3`…), correcto bajo el modelo de concurrencia de Turso/libSQL (MVCC, conflictos al commit). Mismo patrón para `Job.code` (`generateJobCodeWithRetry`, `src/lib/cashflow/generate-code.ts`).
**Documentos del trabajo** (`ticket-documents-panel.tsx`, en la ficha): vista de solo lectura que agrupa Fotografías/Videos/Otros (con origen cliente/técnico/administrador, derivado de `TicketDocument.uploadedBy.role`), OT, Propuestas, Informes, OC, Facturas y Boletas — extiende el mismo patrón de `/documentacion` (lee fuentes reales en paralelo, no fusiona tablas ni copia archivos). Ver Ontología del dominio § Modelo objetivo.
**PT/OT/IT — 3 casilleros fijos** (`ticket-controls.tsx`, editor interactivo de la ficha, staff-only): reemplaza la sección "Documentos de trabajo" por 3 casilleros con el mismo lenguaje visual que Contrato/Carnet en la ficha de técnico (`doc-section.tsx`'s `FixedSlot` — lleno `border-ok-200`/vacío `border-dashed`). Mapea el flujo real: **PT** (propuesta) se genera antes o junto con el ticket vía Cotizador — vacío enlaza a `/cotizador?new=1`; **OT** la sube el técnico en terreno (mismo endpoint que ya usaba, solo se restyled); **IT** (informe) lo genera y envía la administración — vacío dispara `goToNewInforme()` (guarda campos pendientes antes de navegar). Esta ficha es staff-only por construcción (el técnico nunca llega a `/tickets/[id]`, ver `.claude/rules/data.md`), así que no hay lógica de ocultar PT/IT por rol acá — la vista del técnico (`/mi-panel/tickets/[id]`, `TecnicoTicketActions`) tiene su propio casillero, solo OT.

### Flujo de Caja (`/flujo`, `/flujo/reportes`, `/flujo/trabajos/[id]`)
**Para qué**: Control financiero de trabajos ejecutados — facturación, cobranza, márgenes. Rediseñado 2026-07-28 contra `flujo de caja produccion/*.html` (prototipo de referencia del dueño).
**Modelos**: `Branch`, `Job` (dos sistemas de estado, ver Taxonomía más abajo), `JobCost`.
**`/flujo`**: panel "Control de hoy" (4 indicadores de excepción — vencidas/vencen en 7 días/sin OC/programados — NO dependen del filtro de período) + lista de trabajos agrupada por cliente→período con toggle Lista/Calendario (mes-grid con punto de color por estado) + búsqueda. Filtro de período: un solo control Desde/Hasta (`DateRangeFilter`, `src/components/cashflow/date-range-filter.tsx`), no presets relativos.
**`/flujo/reportes`**: filtros completos (cliente/sucursal/tipo/estado/flujo/financiero/sin técnico/rango de fechas) + tabla con drill-down por fila (panel con contexto completo, sin navegar) + export Excel que respeta los mismos filtros.
**Predicados de negocio**: `src/lib/cashflow/job-presets.ts` — única fuente de verdad para "vencido"/"sin OC"/"pagado"/etc., con fallback a campos clásicos (ver Taxonomía). No reimplementar estas reglas en un componente.
**`recordDate()`** (`group-by-client-period.ts`): fecha de agrupación con fallback `executionDate → parseada del código YYMMDD → createdAt` — sin esto, jobs sin `executionDate` (todo el histórico importado) desaparecían de la lista.
**Carga histórica**: `scripts/import-flujo.ts` (JB: 205 jobs, Decathlon: 1, Unity: 1) — ya aplicada a Turso prod.
**Ticket de origen obligatorio para trabajos nuevos** (2026-08-02, cierra el punto #1 del informe): `/flujo/trabajos/new` exige seleccionar un ticket del cliente antes de guardar (mismo patrón que Cotizador/Informe) — antes de este fix, un trabajo creado directo acá quedaba sin `originTicketId` igual que los 328 del histórico, así que el backlog de "Triage legado" en Conciliación se habría seguido llenando. `updateJob` es una función separada — editar trabajos existentes sin ticket (históricos) no se ve afectado.

### Cotizador (`/cotizador`) + Informes Técnicos (`/informe`)
**Para qué**: Generar propuestas/informes en PDF y guardarlos en carpeta del cliente — el cliente ve los documentos consolidados dentro del portal, en el menú Informes (`/portal/[slug]/informes`) para informes técnicos y Propuestas para comerciales. Soporta tanto documentos JSON editables (generados desde el editor) como archivos reales subidos a R2 (informes históricos vinculados desde evidencia de ticket) — ambos casos descargables desde el portal.
**Flujo**: Editor → preview vivo → guardar como JSON editable en `ClientDocument` → PDF generado on-demand.
**Ticket de origen obligatorio** (2026-08-02, informe #1 del plan de ordenamiento): ambos editores exigen elegir un ticket antes de guardar (validado en cliente y en servidor, `POST /api/client-documents` — no aplica a `type:'otro'`, el upload libre de `/documentos`). El servidor deriva `clientId` del ticket, no del dropdown del modal, para que no puedan quedar desincronizados. "+ Crear ticket nuevo" abre `/tickets/new` en pestaña nueva (no pierde el formulario) + botón "Refrescar" para traer la lista sin recargar. Antes del 2026-08-02, Cotizador no tenía ningún vínculo a ticket e Informe lo tenía pero roto: el botón Guardar mandaba el `ticketId` de la URL en vez del seleccionado en el dropdown — corregido.
**Re-editar**: `/cotizador?docId=xxx` carga el JSON guardado en el editor.
**No requiere R2**: el JSON se guarda en `ClientDocument.dataJson` (DB). `fileKey="inline"`.
**Templates activos**: `clasico`, `basica` (variante CSS liviana del clásico), `pro` (layout propio: hero negro, grilla meta, condiciones en tabla). Docs legados con template `minimal` se mapean a `basica`.
**Bug timezone resuelto**: `formatDate('YYYY-MM-DD')` ahora parsea como fecha local (no UTC) evitando el desfase de 1 día en zona UTC-4.

### Carpetas de clientes (`/documentos`)
**Para qué**: Ver todas las propuestas e informes guardados, organizados por cliente.
**Acciones por documento**: Editar (reabre en editor), Descargar PDF (on-demand), Eliminar.
**Integración con Pipeline**: propuestas muestran badge de estado + botón "Agregar al pipeline" / "Ver en pipeline →".

### Pipeline comercial (`/pipeline`)
**Oculto del menú desde 2026-08-08** (decisión del dueño: sin uso real, no aporta valor hoy) — ruta, página y datos siguen intactos, solo se quitó el link de `NAV_SECTIONS` en `sidebar.tsx`; reversible con un cambio de una línea si se retoma.
**Para qué**: Seguimiento de propuestas enviadas — kanban por estado, KPIs, monto en juego.
**Acceso**: solo `super`/`supervisor`.
**Modelo**: campos en `ClientDocument` (type=`propuesta`): `proposalStatus` (enum `ProposalStatus`: `borrador|enviada|vista|aceptada|rechazada|perdida`), `proposalAmount`, `sentAt`, `viewedAt`, `responseAt`, `followUpAt`, `proposalNote`.
**KPIs**: total en pipeline, monto en juego (enviada+vista), tasa de cierre, propuestas por vencer (>7 días sin respuesta).

### Recursos (`/recursos`) — Inventario
**Para qué**: Técnicos, vehículos, activos, clientes. (Cuadrillas: descartado — módulo `Crew` sin uso en la operación real, removido por completo el 2026-07-28: ruta, modelo, migración, seed y tests.)
**Modelos**: `Technician`, `Vehicle`, `Asset`, `Client`, `Branch`, `TechnicianDocument`
**Relaciones**: Técnico ↔ Vehículo 1:1, Vehículo → Activos 1:N.
**Perfil técnico**: navegación por tabs (Resumen / Datos / Vehículo / Documentos). Resumen: stats de cronograma + stats de tickets + tickets recientes + próximas asignaciones. Links accionables a `/tickets?usuario=id` y `/cronograma?tecnico=id`.
**ContractType enum**: `indefinido | plazo_fijo | ayudante | no_renovado | despedido`. Los dos últimos = desvinculados (sección separada en lista, auto-inactivan).
**Documentos**: `DocSection` lista archivos con preview inline vía signed-URL proxy (`/api/files?key=...`).
**Dashboard — Carga por técnico**: cards siempre visibles (no gated por filtro de período) agrupadas por `Ticket.assignedToId` (`User.id`, nunca `Technician.id` directo — ver `.claude/rules/data.md`), con especialidad resuelta vía `User.technicianId` y link a la ficha solo cuando existe un `Technician` detrás de la asignación.
**Ficha de cliente** (`/recursos/clientes/[id]`): además del form de edición, gestiona sucursales (`BranchManager`) y usuarios de portal (`PortalUserManager`, `super`-only: crear, editar email/username, resetear password, activar/desactivar). Ambas listas van dentro de `CollapsibleSection` (colapsadas por defecto si hay más de 6 filas — Just Burger tiene 27 sucursales y 15 usuarios) para no dominar la página.
**Ficha de sucursal** (`/recursos/clientes/[id]/sucursales/[branchId]`): datos editables (dirección/ciudad/contacto, reusa `updateBranch`/`toggleBranch`), usuarios de portal con ese `branchId` (solo lectura — editar sigue viviendo en la ficha del cliente), tickets de esa sucursal. Link "Ver ficha →" desde `BranchManager`.

### Bóveda de credenciales (`/recursos/credenciales`) — solo `super`
**Para qué**: Accesos a servicios externos de la empresa (informe #21) — cifrados en reposo (AES-256-GCM, `src/lib/secrets/crypto.ts`), ocultos por defecto.
**Modelos**: `Secret`, `SecretReveal` (auditoría de quién reveló y cuándo — nunca guarda el valor).
**Revelar**: exige reautenticación (password del propio usuario, `bcrypt.compare`) y queda bloqueado bajo "ver como" (mismo criterio identity-bound que RR.HH./FES, ver G32 en el gap register).
**Permisos**: único link del nav que se filtra por rol — invisible para `supervisor` (antes el nav de INGEGAR One mostraba lo mismo a super y supervisor por igual, confiando solo en el gate de la página).

### Documentación y acreditación (`/documentacion`)
**Para qué**: vista cruzada de solo-lectura sobre documentos ya existentes (técnicos, empresa, OT de tickets) para preparar rápido un paquete de acreditación — NO es una biblioteca de archivos nueva, no duplica ningún archivo.
**Fuentes leídas** (`src/lib/resources/documentacion.ts`): `TechnicianDocument`, `CompanyDocument`, `Ticket.otFileUrl` (la OT vive en `Ticket`, no en `ClientDocument` — son documentos con dueño y ciclo de vida distintos, ver `.claude/rules/data.md`).
**Funciones**: filtrar/buscar, selección individual o masiva, ZIP (`POST /api/documents/zip`, reusa `buildZipFromR2Keys`), banner de técnicos con documentación obligatoria incompleta.
**Preview universal**: `FilePreviewButton` (`src/components/ui/file-preview-modal.tsx`) — modal in-app (nunca navega afuera), reusado en técnico/empresa/`/documentacion`. Un solo patrón de preview en toda la app.

### Conciliación (`/conciliacion`)
**Para qué**: compara cada `Job` contra su `Ticket` de origen (`originTicketId`), y ese ticket contra su OT (`Ticket.otFileUrl`) e informe técnico (`ClientDocument` type=`informe`). Cada estado con problema (sin ticket / sin OT / sin IT) tiene una acción directa a resolverlo, no solo una etiqueta.
**Dos pestañas** (2026-08-02, informe #4/#9): "Conciliación" (día a día, todos los estados) y **"Triage legado"** — espacio de trabajo separado para el backlog real del modelo anterior (328 de 386 `Job` sin `originTicketId` al momento de esta sesión, ver `scripts/check-ticket-doc-linking.ts`). Selección múltiple + "Vincular a ticket existente" (dropdown scopeado por cliente del `Job`, nunca cross-cliente) o "Marcar como legado" (`Job.legacyNoTicket`, nuevo campo — deja de contar como pendiente sin forzar un ticket falso, reversible con "Deshacer"). Nunca vincula ni marca automáticamente — cada fila o selección es una decisión humana explícita.

### Gastos (`/gastos`)
**Para qué**: Control de gastos operacionales por técnico (combustible, viáticos, materiales).
**Modelos**: `Expense`
**Flujo**: Técnico registra (desde el ticket o `/mi-panel/gastos`) → supervisor aprueba/rechaza → notificación push. `/gastos` es solo vista general/filtro/exportación, nunca punto de ingreso.
**KPIs**: mismo `KpiCard` compartido que Dashboard/Flujo de Caja (card blanca + borde izquierdo de color) desde 2026-08-08 — antes tenía su propio estilo de fondo pastel plano, inconsistente con el resto de la app.
**Nota de estado (2026-08-08)**: el módulo funciona end-to-end pero no tiene uso real todavía — cero registros de `Expense` tanto en local como en Turso prod al momento de esta nota.

### RR.HH. (`/rrhh`)
**Para qué**: Gestión de personas — fichas de empleados, permisos/vacaciones, liquidaciones, FES.
**Modelos**: `LeaveRequest`, `Payroll` + campos `hireDate`, `baseSalary`, `address` en `Technician`.
**Vistas**: Dashboard (`/rrhh`), Ficha empleado (`/rrhh/[id]`), Permisos (`/rrhh/vacaciones`), Liquidaciones (`/rrhh/liquidaciones`).
**FES**: Firma Electrónica Simple desde `/mi-panel` — SHA-256 hash + RUT confirmado + IP + timestamp.
**Acceso**: solo `super` y `supervisor`.

### Portal cliente (`/portal/[slug]`)
**Vistas**: Dashboard, Tickets (lista filterable + tabs Activos/Cerrados), Detalle de ticket, Nueva solicitud.
**PWA**: manifest dinámico, push notifications (web-push + VAPID), service worker.
**Sesión**: separada de la app interna, `role=client`.
**Mobile-first**: portal íntegramente diseñado para celular (inline styles, sin Tailwind en shell).
**Feedback de estado**: todos los botones usan `useTransition` + `isPending` para deshabilitar + texto "Enviando…" / "Guardando…".
**Privacidad**: cada cliente ve solo sus propios tickets (`getClientTickets(clientId)`, nunca cross-tenant). Usuario de sucursal (`branchId` set, `isClientAdmin=false`): además scopeado a su propia sucursal — dashboard, `/tickets` y `/reportes` filtran por `branchId` (los tres llaman `getClientTickets(clientId, branchFilter)` con el mismo criterio; un fix real de esta sesión: dashboard y reportes no aplicaban ese filtro y exponían las demás sucursales del cliente).
**Staff en portal**: puede crear tickets en nombre del cliente (redirige a `/tickets/{id}` al enviar). `isStaffViewing()` muestra banner "Creando en nombre de {cliente}" en el form. El dashboard oculta el CTA "Nueva solicitud" para staff (ya que pueden entrar directo desde el form).

---

## Modelos Prisma — mapa de relaciones

```
Tenant ──< User (role: super|supervisor|tecnico|client)
       ──< Client (portalSlug?, portalTheme?)
                ──< ClientDocument (propuestas+informes editables)
                ──< Branch (sucursal física)
                         ──< Job ──< JobCost
                ──< Ticket ──< TicketHistory
                           ──< TicketItem
                           ──< TicketDocument
                           ──< TicketCollaborator
       ──< Technician (contractType, hireDate, baseSalary, address...)
                ──< Vehicle (revTecnicaExpiry, soapExpiry...)
                         ──< Asset
                ──< TechnicianDocument
                ──< LeaveRequest (vacaciones/permisos)
                ──< Payroll (liquidaciones)
                ──< SignatureRequest (FES)
                ──< Expense
       ──< Assignment ──< AssignmentAssignee (técnico+rol)
                      ──< Expense
       ──< Secret ──< SecretReveal (bóveda de credenciales, solo super)
```

> No muestra `Job.originTicketId`, `Job.originProposalId` ni `ClientDocument.ticketId` — son FK reales pero opcionales, omitidas aquí por brevedad. Ver "Relaciones clave y sus invariantes" § Modelo objetivo para el diagrama de destino donde pasan a ser obligatorias.

---

## Ambientes

| Ambiente | BD | Cómo correr |
|----------|-----|------------|
| Desarrollo | SQLite (`prisma/dev.db`) | `npm run dev` |
| Producción | Turso libSQL | push a `main` → Vercel auto-deploy |

**Variables clave prod** (en Vercel dashboard): `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_VAPID_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`, `CRON_SECRET`.

---

## 🔴 Flujo SEGURO para schema changes — CRÍTICO

```bash
# 1. Verificar que DATABASE_URL local apunta a SQLite (nunca a Turso)
#    prisma.config.ts usa: process.env.DATABASE_URL ?? 'file:./prisma/dev.db'

# 2. Editar prisma/schema.prisma

# 3. Crear migración LOCAL (solo afecta dev.db)
npx prisma migrate dev --name descripcion_cambio

# 4. Regenerar cliente Prisma
npx prisma generate

# 5. Verificar tipos
npm run typecheck

# 6. Commit + push a main (Vercel deploya el código)
git add -A && git commit -m "feat: ..." && git push origin main

# 7. Aplicar a Turso producción — SOLO después del commit y SOLO con el script seguro
npm run db:migrate:prod
```

**`npm run db:migrate:prod` usa `scripts/turso-migrate.ts`** que:
- Mantiene tabla `_applied_migrations` para saber qué migraciones ya corrieron
- NUNCA re-ejecuta una migración ya aplicada (evita DROP TABLE accidental sobre datos reales)
- Aborta si una migración falla — no continúa corrompiendo la DB

**NUNCA**: `prisma migrate dev/reset/push` con `DATABASE_URL` apuntando a Turso.

---

## Recovery de datos — Turso PITR

Si se pierden datos en producción:
```bash
# 1. Ir al dashboard de Turso o usar CLI
turso db restore <nombre-db> --timestamp "2026-06-30T18:00:00Z"

# 2. Una vez restaurada, marcar migraciones previas como aplicadas (sin re-correrlas)
npm run db:migrate:bootstrap  # crea _applied_migrations con el historial hasta hoy

# 3. Aplicar solo las migraciones nuevas
npm run db:migrate:prod
```

---

## Flujo de deploy

```bash
npm run dev               # dev server localhost:3000
npm run typecheck         # verificar tipos
git add . && git commit   # conventional commit
git push origin main      # → Vercel auto-deploy (hook pre-push corre typecheck)
```

---

## Scripts de utilidad

| Script | Qué hace |
|--------|----------|
| `npm run db:seed` | Tenants + usuarios base (dev) |
| `npm run db:migrate:prod` | Aplica migraciones PENDIENTES a Turso (seguro, idempotente) |
| `npm run db:migrate:bootstrap` | Marca todas las migraciones como aplicadas sin ejecutarlas (post-recovery) |
| `npm run import:jb:prod` | Importa tickets históricos JB desde Excel (idempotente) |
| `npm run import:flujo:prod` | Importa jobs flujo de caja desde Excel (idempotente) |

---

## Suite de tests (estado actual)

### Tests unitarios (`npm run test:unit`)
Corren con `node --import tsx --test` (Node.js 24 + tsx 4.x). Las importaciones de fuentes `.ts` **deben incluir extensión** explícita (`.ts`) — sin extensión falla con `ERR_MODULE_NOT_FOUND` en Node 24 ESM.

| Archivo | Qué cubre |
|---------|-----------|
| `totals.test.ts` | `computeTotals` — IVA, UF, USD, ajustes porcentuales |
| `template.test.ts` | `renderQuoteHTML` — estructura HTML, secciones, caracteres especiales |
| `pdf.test.ts` | `generateQuotePdf` — genera PDF binario válido con Playwright/Chromium |
| `report.test.ts` | `generateReportPdf` — genera PDF de informe técnico |
| `cashflow-format.test.ts` | `clp()`, `pct()` — formato moneda chilena |
| `cashflow-metrics.test.ts` | `computeMetrics()`, `jobMargin()`, `jobIsOverdue()` |
| `cashflow-normalize.test.ts` | `parseMoneyCLP()`, `normalizeCollectionStatus()`, etc. |
| `cashflow-schemas.test.ts` | Schemas Zod de Job y JobCost; `fromDateInput()` / `toDateInput()` |
| `quote-edge-cases.test.ts` | `computeTotals` — 9 describe blocks: IVA, empty, UF, USD, qty=0, ajustes negativos, rounding |
| `resources-logic.test.ts` | `CONTRACT_TYPE_ACTIVE/TERMINATED`, schemas Zod técnicos/vehículos/clientes, label maps completos |
| `rrhh-labels.test.ts` | Label maps RR.HH. (leave/payroll), `MONTH_NAMES`, cálculo líquido de liquidación |

### Tests E2E (`npm run test:e2e`)
Playwright + Chromium. Requieren dev server corriendo (se inicia automáticamente). 4 workers por defecto, 60s timeout.

| Archivo spec | Qué cubre |
|-------------|-----------|
| `auth.spec.ts` | Login, redirección sin auth, credenciales inválidas |
| `mobile-audit.spec.ts` | No-horizontal-scroll + touch-targets ≥40px en todas las rutas; portal mobile |
| `technicians.spec.ts` | Lista técnicos, crear + eliminar técnico |
| `resources.spec.ts` | Activos, cronograma seeded |
| `cashflow.spec.ts` | Dashboard KPIs flujo de caja, jobs list, branches admin |
| `features-v2.spec.ts` | Cotizador, cronograma vistas, vehiculos, clientes, activos |
| `quotes.spec.ts` | Preview cotizador, endpoint PDF auth |
| `tickets-flow.spec.ts` | Kanban board, crear ticket, badge de urgencia, filtros, abrir detalle |
| `recursos-flow.spec.ts` | CRUD técnicos + vehículos, campos de vencimiento, activos/clientes |
| `cotizador-flow.spec.ts` | Editor cotizador, IVA, agregar ítem, carpetas de clientes |
| `cronograma-flow.spec.ts` | Vistas calendario/técnico/carga, vista técnico swimlane, nueva asignación |
| `rrhh-flujo.spec.ts` | Dashboard RR.HH., vacaciones, liquidaciones, navegación empleado; Flujo KPIs, trabajos, sucursales, filtro cliente |
| `portal-flow.spec.ts` | Login portal, dashboard KPIs, hamburger post-hydration, abrir sidebar, crear ticket, logout |

### Herramienta clave: mobile-audit
Recorre todas las rutas en viewport 390×844 verificando:
- `document.documentElement.scrollWidth <= clientWidth + 5` — sin overflow horizontal
- Todos los elementos interactivos visibles ≥ 40px de alto
- Usa `waitForLoadState('load')` (no `networkidle`) en páginas con polling/push activo

---

## Pendientes prioritarios

> Lista viva movida a `docs/architecture/GAP_REGISTER.md` (evidencia por ítem, estado 🔴/🟡/🟢/⚪). Esta sección solo deja constancia de lo ya resuelto desde v1.8; para "qué falta hoy" usar el gap register, no este documento.

### ✅ Resuelto desde v1.8 (quedaba listado aquí como pendiente)
- **Pipeline comercial** (`/pipeline`) — implementado v1.10, ver módulo arriba.
- **Mi Panel (técnicos)** — dejó de estar subdesarrollado: menú propio (Inicio/Tickets/Agenda/Gastos/RR.HH.), KPIs reales en vez de shortcuts genéricos, tickets vinculados correctamente vía `effectiveId`.
- **Loading states / animaciones de carga** — `Spinner`, `TopProgress`, skeletons (`loading.tsx`) y focus rings ya implementados en todo el flujo (verificado contra `docs/superpowers/plans/2026-07-04-mobile-first-ux.md`).
- **Velocidad portal cliente** — `getPortalClientBySlug()` cacheado (`unstable_cache`, 60s), queries paralelizadas con `Promise.all` en detalle de ticket, relaciones no usadas removidas de los `select`.

### 🔵 Bugs conocidos (encontrados en audit jul-2026)
- **Passwords en tests E2E**: 5 spec files usaban `ingegar123` pero la DB en dev tiene `Ingegar@Super1` (generada con `SEED_ADMIN_PASSWORD` en `.env`). Corregido en v1.8.0.
- **Unit tests Node 24**: `node --import tsx` con Node.js v24 no resuelve imports TypeScript sin extensión. Todos los imports de fuentes en unit tests deben usar `.ts` explícito. Corregido en v1.8.0.
- **networkidle en E2E**: Páginas con push subscriptions, Service Worker y polling nunca alcanzan `networkidle`. Cambiado a `waitForLoadState('load')`. Corregido en v1.8.0.
- **Portal hamburger useEffect**: El botón hamburger del portal se renderiza condicionalmente vía `isMobile` (useState inicializado en `false`, flip en `useEffect`). El test debe usar `waitForSelector('[aria-label="Abrir menú"]')` para esperar la hidratación. Corregido en v1.8.0.
- **Fechas UTC-4**: `new Date('YYYY-MM-DD')` = UTC midnight. En Chile (UTC-4) se muestra el día anterior. Corregido con `fromDateInput()` en vehiculos, gastos, documentos de técnicos. La regla aplica a CUALQUIER `<input type="date">` guardado vía Prisma.

### Roadmap / valor diferencial pendiente
Ver `docs/architecture/GAP_REGISTER.md` y la sección "Próximos" de `CLAUDE.md` — ambos se mantienen vivos; este documento no duplica esa lista para no volver a desincronizarse.

---

## Convenciones de código

- UI en **español**, código/identificadores en **inglés**
- Commits: inglés, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Queries scoped por tenant: `{ ...tenantScope(actor) }` en todo `where`
- Server Actions en `app/(app)/{módulo}/actions.ts` — siempre con `requireActor()`
- Portal actions: verificar `session.user.clientId === clientId`
- `requireActor(roles?)` — acepta array de roles permitidos, redirige a `/dashboard` si no coincide
- Portal: SIEMPRE inline styles en contenedores de shell. NUNCA CSS vars.

---

## Accesos de prueba

| Usuario | Contraseña (default seed) | Rol | Accede a |
|---------|--------------------------|-----|---------|
| `admin@ingegarchile.cl` | `Ingegar@Super1` | super | Todo |
| `sgarrido@ingegarchile.cl` | `Ingegar@Ops1` | supervisor | App interna |
| `cristian@ingegarchile.cl` | `Ingegar@Com1` | supervisor | App interna |
| `jesus@ingegarchile.cl` | `Tecnico@2026` | tecnico | `/mi-panel` |
| `portal@justburger.cl` | `JustBurger@2026` | client | `/portal/justburger` |
| `portal@decathlon.cl` | `Decathlon@2026` | client | `/portal/decathlon` |

> Todas las contraseñas se generan desde variables de entorno (`SEED_ADMIN_PASSWORD`, `SEED_JB_PASSWORD`, etc.). Los valores de arriba son los defaults si la variable no está en `.env`.

---

## Ontología del dominio

> Mapa conceptual de entidades y sus relaciones fundamentales. Usar como referencia al diseñar queries, validaciones y tests.

### Entidades raíz

| Entidad | Qué es | Scope | Identificador de negocio |
|---------|--------|-------|--------------------------|
| `Tenant` | Organización que usa la plataforma | — | `slug` (ej: `ingegar`) |
| `User` | Persona con acceso al sistema | tenant | `email` o `username` |
| `Client` | Empresa cliente de INGEGAR | tenant | `rut` + `portalSlug?` |
| `Technician` | Técnico en terreno | tenant | nombre + `contractType` |
| `Vehicle` | Camioneta o vehículo de trabajo | tenant | `plate` (patente única) |
| `Asset` | Instrumento/herramienta inventariada | tenant | `code` (ej: INV-001) |

### Entidades de trabajo

| Entidad | Qué es | Padre | Ciclo de vida |
|---------|--------|-------|---------------|
| `Ticket` | Requerimiento de mantención | Client | `nuevo → en_revision → en_ejecucion → resuelto` (o cancelado/fusionado) |
| `Assignment` | Trabajo agendado en calendario | Tenant+Client | `scheduled → in_progress → done` (o cancelled) |
| `Job` | Trabajo facturado (Flujo de Caja) | Client+Branch | `borrador → facturado → pagado` (`JobStatus`) |
| `Branch` | Sucursal física del cliente | Client | inmutable tras creación |
| `JobCost` | Costo individual de un job | Job | sin ciclo, valores numéricos |

### Entidades RR.HH.

| Entidad | Qué es | Padre |
|---------|--------|-------|
| `LeaveRequest` | Solicitud de permiso/vacaciones | Technician |
| `Payroll` | Liquidación mensual | Technician |
| `SignatureRequest` | FES (Firma Electrónica Simple) | Technician |
| `Expense` | Gasto operacional | Technician + Assignment? |

### Entidades de documentos

| Entidad | Qué es | Padre |
|---------|--------|-------|
| `ClientDocument` | Propuesta/informe guardado como JSON | Client |
| `TechnicianDocument` | Documento HR del técnico (contrato, EPP…) | Technician |
| `TicketDocument` | Archivo adjunto a un ticket | Ticket |

### Relaciones clave y sus invariantes

```
Client ──< Branch        1:N  — una sucursal pertenece a exactamente un cliente
Client ──< Ticket        1:N  — tickets aislados por cliente (nunca cross-tenant)
Client ──< Job           1:N  — via Branch.clientId
Client ──< ClientDocument 1:N — propuestas/informes del cliente

Technician ──< Vehicle    1:1  — cada camioneta tiene máx. 1 técnico asignado
Vehicle    ──< Asset      1:N  — instrumentos en esa camioneta

Assignment ──< AssignmentAssignee M:N — técnico principal (tecnico) + ayudantes
Assignment ──? Ticket      opt — un trabajo puede referenciar un ticket

Job            ──? Ticket opt — Job.originTicketId, 1:1 vía Ticket.jobId (@unique)
Job            ──? ClientDocument opt — Job.originProposalId (trazabilidad pipeline→Job)
ClientDocument ──? Ticket opt — ClientDocument.ticketId, FK real pero nullable
```

**Invariantes de integridad:**
- Un `Vehicle` con `technicianId` bloquea reasignar ese técnico a otra camioneta sin `freeTechnician()` primero.
- Eliminar un `Client` con `Jobs` activos falla (`onDelete: Restrict`).
- `portalSlug` es único en `Client` — solo un cliente puede tener ese portal URL.
- `plate` es único en `Vehicle` dentro del tenant.
- El rol `client` siempre tiene `clientId != null`; el rol `tecnico` siempre tiene `technicianId != null`.
- `Job.originTicketId`/`ClientDocument.ticketId` son **nullable hoy** y no se exigen en la creación — ver "Modelo objetivo" abajo para el criterio de hacia dónde va esto y por qué no se cambia sin plan.

### 🎯 Modelo objetivo — Ticket como raíz de agregación (dirección acordada, NO implementado)

> Acordado 2026-08-02 a partir de "Informe Final INGEGAR ONE v4" (`INGEGAR UPGRADE/Informe_Final_INGEGAR_ONE_v4_COMPLETO.html`, 33 cambios evaluados contra este código). Esta sección es **criterio de diseño para futuras sesiones**, no una descripción del código actual — no asumir que nada de esto ya existe. Antes de tocar una sola línea de esto, releer "Job — dos sistemas de estado en paralelo" más abajo: ya se vivió una vez el costo de no hacer backfill al extender un modelo de estados, y el mismo error es fácil de repetir con `Ticket`.

**Qué cambia respecto al diagrama de arriba:**
- Hoy `Job` y `ClientDocument` cuelgan de `Client`/`Branch` como hermanos de `Ticket`, con un link opcional de vuelta. Ambas FK (`originTicketId`, `ticketId`) **ya existen y son reales** — el trabajo pendiente es de *validación de servidor* (hacerlas obligatorias en la creación de registros nuevos), no de schema.
- Objetivo: `Ticket` es el punto de partida de todo trabajo. Desde el ticket se crean, anidados, los demás números del expediente: OT (ya vive en `Ticket.otFileUrl`, sin cambio de tabla), Informe Técnico ("IT", `ClientDocument` type=`informe`), Propuesta/Cotización (`ClientDocument` type=`propuesta`, hoy es lo mismo que alimenta Pipeline), y el `Job` de Flujo de Caja con su OC/factura/pagos.
- Los tres generadores de ID actuales (`ticket-code.ts`, `quote-id.ts`, `generate-code.ts` de Job) **no se fusionan en uno**. El ticket conserva su correlativo diario propio; propuesta y factura le agregan sufijos `PPTO-N`/`FAC-N` a la referencia visible solo cuando existen, sin reemplazar el ID interno de cada entidad. Ningún ID ya emitido cambia retroactivamente.

**Diagrama objetivo** (contraste con el actual, arriba):
```
Client ──< Branch
Client ──< Ticket (raíz — todo lo demás nace desde acá)
              ├──< ClientDocument (propuesta, ticketId NOT NULL para registros nuevos) [PPTO-N]
              ├──< ClientDocument (informe, ticketId NOT NULL para registros nuevos)   [IT]
              ├──< Job (originTicketId NOT NULL para registros nuevos)
              │        ├──< JobCost
              │        └──< JobInstallment[]  ← YA IMPLEMENTADO (2026-08-02, punto #12): una fila por
              │                                  cuota con su propia OC/factura/crédito/pago
              │                                  ([FAC-N] por cuota), en vez de las 3 tablas separadas
              │                                  originalmente imaginadas acá (PurchaseOrder/Invoice/
              │                                  Payment) — una cuota agrupa naturalmente su OC+factura
              │                                  +pago como un solo evento de cobro, no tres FKs sueltas.
              │                                  `Job.installments` sigue siendo opcional en cualquier
              │                                  query — los campos planos (`purchaseOrder`,
              │                                  `invoiceNumber`, etc.) siguen siendo la fuente de
              │                                  verdad para trabajos de pago único (la mayoría).
              └──< TicketDocument (OT, fotos, videos — misma tabla de hoy, sin fusionar)
```

**Guardrails no negociables al implementar cualquier pieza de esto** (para no contradecir invariantes ya probadas en este proyecto):
1. **No forzar relaciones históricas.** Un `Job`/`ClientDocument` viejo sin `ticket_id` no se le asigna uno por similitud de nombre/fecha — va a bandeja de regularización, decisión humana (misma disciplina que `production-safety.md` exige para duplicados; ver el caso real de las 13 sucursales duplicadas reconciliadas por `scripts/reconcile-2026-phase3-dedupe-branches.ts`).
2. **Backfill en el mismo commit, no "después" — o mejor, evitarlo calculando en vez de guardando.** Resuelto en la práctica (2026-08-02, punto 3 del informe): en vez de replicar los 5 enums de etapa de `Job` como columnas nuevas en `Ticket` (que sí habría exigido backfill de los tickets existentes), el resumen de 4 estados se **calcula** desde `Ticket` + su `Job`/`Propuesta` vinculados (`src/lib/tickets/ticket-state-summary.ts`) — cero campo nuevo, cero backfill, cero segundo lugar donde el dato pueda desincronizarse. Si en el futuro se necesita un campo *guardado* (no solo mostrado) en `Ticket`, sigue aplicando la regla original: backfill en el mismo commit, nunca "después" — ver "Job — dos sistemas de estado en paralelo".
   Mismo criterio aplicado en la práctica al punto #12 (cuotas, 2026-08-02): `Job.installments` es un campo **opcional** en el tipo compartido de `job-presets.ts` — presente solo cuando el caller lo selecciona explícitamente en su query Prisma. Los 386 trabajos existentes (todos de pago único) y el código que no fue tocado esta sesión (dashboard, `/flujo/reportes`) siguen leyendo los campos planos de siempre, byte-idéntico a antes — cero backfill porque no hace falta: un trabajo sin cuotas simplemente nunca puebla ese array.
3. **"Documento único" = vista, no tabla nueva.** Unificar OT/fotos/informe se hace extendiendo el patrón de solo-lectura que ya usa `/documentacion` (lee `TechnicianDocument`+`CompanyDocument`+`Ticket.otFileUrl` en paralelo sin fusionar). Fusionar `ClientDocument`/`TicketDocument`/`Ticket.otFileUrl` en una tabla nueva rompe la regla ya escrita en `.claude/rules/data.md` ("OT vs Carpetas de clientes — no son lo mismo, no se fusionan").
4. **Corrección de colisión de correlativo, patrón correcto para Turso/libSQL**: `ticket-code.ts` hoy resuelve colisiones con un sufijo `Date.now()` (parche); `generate-code.ts` de Job usa `MAX(existing)+1` sin lock a propósito (comentado `ponytail: equipo chico`). Turso/libSQL usa MVCC bajo `BEGIN CONCURRENT` — los conflictos se resuelven al hacer commit, no con locks pesimistas. El fix correcto es constraint única `(clientId, dateKey)` + captura de conflicto (P2002) + reintento, nunca un lock de aplicación.
5. **Todo migra aditivo, vía el camino ya establecido.** `prisma migrate dev` local → `scripts/turso-migrate.ts` contra Turso, con backup previo (`scripts/backup-turso-tables.ts`) — igual que cualquier otro schema change (ver "Flujo SEGURO para schema changes" más abajo). Nunca `prisma db push`/CLI directo contra Turso.

**Pendiente de proceso**: fusionar los 33 puntos del informe en `docs/architecture/GAP_REGISTER.md` (cruzados con G2, G20, G25, G31, G32, G34, G37, G41, G43, G45, que ya son evidencia real de varios de estos problemas) antes de implementar cualquier etapa — para no mantener esta lista y el gap register divergiendo, tal como `CLAUDE.md` ya pide evitar.

---

## Taxonomía completa de estados

### Ticket — `status`

```
[pendiente_aprobacion] ──(admin cliente aprueba)──→ [nuevo] ──→ [en_revision] ──→ [en_ejecucion] ──→ [esperando_aprobacion] ──→ [resuelto]
        │                                              ↓               ↓               ↓                       ↓
        └──(admin cliente rechaza)──→ [cancelado]  [cancelado]    [cancelado]    [cancelado]              [cancelado]

[cualquier estado abierto] ──→ [fusionado]  ← solo desde el portal cliente (admin del cliente); desfusionar restaura el status previo exacto
```

| Status | Label UI | Quién puede editar en portal | Cómo se llega |
|--------|----------|------------------------------|----------------|
| `pendiente_aprobacion` | Pendiente aprobación | Admin del cliente (aprobar/rechazar) | Automático: lo crea un usuario de sucursal (`branchId` set, `isClientAdmin=false`) |
| `nuevo` | Nuevo | Cliente + staff | Creación directa (staff, admin del cliente, o aprobación de una `pendiente_aprobacion`) |
| `en_revision` | En Revisión | Solo staff | |
| `en_ejecucion` | En Ejecución | Solo staff | |
| `esperando_aprobacion` | Esperando Aprobación | Staff + cliente (aprobar/rechazar) | |
| `resuelto` | Resuelto | Solo staff | |
| `cancelado` | Cancelado | Solo staff | También el resultado de rechazar una `pendiente_aprobacion` |
| `fusionado` | Fusionado | Solo cliente — admin del cliente (fusionar/desfusionar), con confirmación explícita | Exclusivamente portal cliente — no existe en el selector de Estado de INGEGAR One |

**Regla portal**: cliente puede **agregar sub-tareas** solo si `status ∈ {nuevo, en_revision}`.

**Resumen de 4 estados (2026-08-02, informe #3)**: `src/lib/tickets/ticket-state-summary.ts` — operativo/documental/comercial/financiero, mostrados en la ficha del ticket. Implementado **calculado, no como columnas nuevas**: a diferencia de lo que este documento planteaba antes de revisar el modelo real de `Job` en profundidad, no se replicaron los 5 enums de etapa de `Job` en `Ticket` — se deriva del `Ticket` + su `Job`/`Propuesta` vinculados (reusando los predicados de `job-presets.ts`). Cero backfill porque no hay campo nuevo que backfillear. Este `status` clásico sigue siendo la fuente real del estado operativo, no se reemplaza.

### Ticket — `urgency`

| Urgency | Label | Color | SLA esperado |
|---------|-------|-------|-------------|
| `emergencia` | Emergencia | Rojo | < 2h respuesta |
| `urgencia` | Urgente | Naranja | < 24h respuesta |
| `no_urgente` | Normal | Gris | < 72h respuesta |
| `preventivo` | Preventivo | Azul | Según calendario |

### Assignment — `status`

| Status | Label | Significado |
|--------|-------|-------------|
| `scheduled` | Programada | En el calendario, no iniciada |
| `in_progress` | En curso | Técnico en el lugar |
| `done` | Completada | Trabajo terminado |
| `cancelled` | Cancelada | Gana sobre permiso — siempre gris en calendario |

**Color evento en calendario** = `permissionEventColor(permissionRequested, status)`:
- `cancelled` → siempre gris con tachado
- `permissionRequested=true` → verde (permiso OK)
- `permissionRequested=false` → amarillo (pendiente de permiso)

### Technician — `contractType`

| Type | Label | Estado laboral | Efecto en app |
|------|-------|----------------|---------------|
| `indefinido` | Contrato indefinido | Activo | Normal |
| `plazo_fijo` | Plazo fijo | Activo | Normal |
| `ayudante` | Ayudante / eventual | Activo | Normal |
| `no_renovado` | No renovado | **Desvinculado** | Sección separada, `active=false` automático |
| `despedido` | Despedido | **Desvinculado** | Sección separada, `active=false` automático |

`CONTRACT_TYPE_ACTIVE = [indefinido, plazo_fijo, ayudante]`
`CONTRACT_TYPE_TERMINATED = [no_renovado, despedido]`

### Vehicle — `status`

| Status | Label |
|--------|-------|
| `active` | Operativa |
| `maintenance` | En mantención |
| `retired` | De baja |

### Asset — `status`

| Status | Label |
|--------|-------|
| `available` | Disponible |
| `in_use` | En uso |
| `maintenance` | Mantención |
| `retired` | De baja |

### Job (Flujo de Caja) — dos sistemas de estado en paralelo

`Job` tiene los campos **clásicos** (`status`: `pendiente|en_proceso|ejecutado|anulado`, `collectionStatus`:
`sin_oc|pendiente_pago|pagado`) y un sistema **v2** más granular añadido después
(`processFlow`, `commercialStage`, `operationalStage`, `documentationStage`,
`financialStage` — ver enums en `schema.prisma`). `derive-legacy-status.ts`
deriva los clásicos a partir de v2 en cada escritura, para que
`computeMetrics()`/dashboard/flujo (que leen los clásicos) no queden
desincronizados.

**🔴 Trampa real, ya mordida una vez (2026-07-28)**: los 207 jobs importados
del histórico (Excel) SOLO tienen los campos clásicos poblados — `financialStage`/
`operationalStage`/`commercialStage` quedaron en su default de schema
(`no_po`/`pending`/`intake`) para el 100% de ellos, porque nunca hubo un backfill
al introducir v2. Cualquier predicado de negocio sobre `Job` que lea SOLO los
campos v2 (`isPaidJob`, `isExecutedJob`, etc. en `src/lib/cashflow/job-presets.ts`)
da resultados incorrectos para todo ese histórico — p.ej. trabajos realmente
pagados aparecían como "no pagados". Ya corregido con un fallback explícito a
los campos clásicos en cada predicado (ver comentario en `job-presets.ts`), pero
**cualquier predicado nuevo sobre `Job` debe considerar este mismo fallback**
o repetirá el bug para datos importados.

### LeaveRequest — `status`

`pendiente → aprobado → rechazado`

### Payroll — `status`

`borrador → emitido → pagado`

### Client — `label`

`principal | ocasional | prospecto | inactivo | proyecto`

### TechnicianDocument — `docType`

`contrato | epp | altura | antecedentes | licencia | otro`

---

## Reglas de negocio e invariantes

> Constraints que NUNCA deben romperse. Si un test pasa pero una de estas reglas se viola, hay un bug.

### Aislamiento multi-tenant (crítico)
1. **Todo query** que retorne datos de negocio DEBE incluir `{ ...tenantScope(actor) }` en el `where`.
2. El rol `super` ve todos los tenants (`tenantScope` retorna `{}`). Todos los demás ven solo su propio tenant.
3. **Portal**: el rol `client` ve solo sus propios tickets via `getClientTickets(clientId)` — nunca datos de otro cliente del mismo tenant.
4. **Test clave**: crear ticket con user A, intentar acceder con user B de diferente tenant → debe retornar 404/403.

### Permisos por rol
5. `tecnico` y `client` NUNCA acceden a la app interna (`/dashboard`, `/recursos`, etc.). El middleware los redirige antes de que lleguen a cualquier Server Component.
6. `client` accede solo al portal de **su** cliente (el `clientId` de su sesión). El `slug` en la URL se valida contra el `portalSlug` del `Client` asociado al user.
7. `super` puede ver el portal de cualquier cliente (preview como staff — `isStaffViewing()` es true).

### Integridad de inventario
8. Antes de asignar un técnico a un nuevo vehículo, se llama `freeTechnician(techId)` para desvincularlo del anterior. No se puede tener 2 vehículos apuntando al mismo técnico.
9. Al marcar un técnico como `no_renovado` o `despedido`, su campo `active` se pone en `false` automáticamente. Los tests deben verificar que no aparece en la lista activa.

### Fechas y zonas horarias
10. Cualquier `<input type="date">` que se guarde en Prisma DEBE parsear con `fromDateInput()` (no `new Date('YYYY-MM-DD')` que es UTC midnight → desfase de 1 día en Chile UTC-4).
11. Fechas de vencimiento de vehículos (`revTecnicaExpiry`, `soapExpiry`) se muestran como alerta cuando faltan ≤ 30 días. El cálculo usa `new Date()` local del servidor.

### PDF y documentos
12. El PDF de cotizadores/informes se genera **siempre on-demand** (nunca se guarda el binario). Solo se guarda el JSON del editor en `ClientDocument.dataJson`.
13. `ClientDocument.fileKey = "inline"` → datos en DB. `fileKey != "inline"` → datos en R2 (flujo legacy). `isR2Key("inline")` retorna `false`.
14. Al regenerar un PDF de un documento re-editado, se usa el `dataJson` actualizado, no el original.

### Validación de formularios
15. Campos marcados `*` en UI son `required` en el schema Zod. El servidor RECHAZA requests sin esos campos incluso si el frontend los omite.
16. RUT de cliente se valida formato `XX.XXX.XXX-X`. Múltiples RUTs por cliente via `clientRuts[]` (campo JSON).
17. Patente de vehículo: único por tenant. Crear un segundo vehículo con la misma patente falla.

---

## Catálogo de condiciones de borde

> Escenarios que históricamente causan bugs o fallan en producción. Ordenados por módulo y severidad.

### 🔴 Auth / Sesión

| Condición | Comportamiento esperado | Riesgo |
|-----------|------------------------|--------|
| Usuario con rol `client` navega a `/dashboard` | Middleware redirige a `/portal/{slug}` | Si el proxy falla, ve datos de otros clientes |
| Técnico (`role=tecnico`) navega a `/recursos` | Middleware redirige a `/mi-panel` | Exposición de datos internos |
| `canViewPortal(null, clientId)` | Retorna `false` — sin sesión no hay acceso | OK (verificado en código) |
| Staff (`super/supervisor`) accede a `/portal/{slug}` | Accede como preview — `isStaffViewing()=true` | Diferente de vista cliente real |
| Token JWT expirado mid-session | Next.js + Auth.js v5 redirige a login sin mensaje | UX: sin feedback al usuario |
| Login con `username` vs `email` | El campo `login` acepta ambos | El seed crea ambos campos; no confundir |

### 🔴 Multi-tenant

| Condición | Esperado | Test sugerido |
|-----------|----------|---------------|
| Crear recurso sin `tenantId` | Error DB (campo required) | Unit test schema Zod |
| `tenantScope(superUser)` | Retorna `{}` (sin filtro) | Unit test directo |
| Super user ve tickets de todos los clientes | Sí — diseño intencional | Verificar en test E2E |
| Crear ticket como client de tenant A, leer como client de tenant B | 404 | E2E test crítico pendiente |

### 🟠 Tickets

| Condición | Esperado |
|-----------|----------|
| Ticket con `showToClient=false` en portal | Portal NO lo muestra |
| Crear ticket sin cliente seleccionado | Error 400 (cliente requerido) |
| Fusionar ticket A en ticket B (desde portal, admin del cliente) | A queda en `status=fusionado`, `parentTicketId=B.id`, B acumula historial; INGEGAR One no tiene esta acción |
| Desfusionar A | Restaura el `status` que A tenía justo antes de fusionarse (leído de `TicketHistory`), no un default fijo |
| Usuario de sucursal (`branchId`, no admin) crea ticket | Queda en `pendiente_aprobacion`, invisible para otras sucursales del mismo cliente, notifica al admin del cliente (no a staff) |
| Admin del cliente aprueba/rechaza `pendiente_aprobacion` | Aprobar → `nuevo` + notifica staff; rechazar → `cancelado` + notifica al creador |
| Portal: cliente intenta editar ticket `en_ejecucion` | UI oculta botones de edición; server action rechaza |
| Ticket con `urgency=emergencia` → notificación push | Push enviado a todos los staff del tenant |
| `estimatedDate` en el pasado | Muestra badge "Vencido X días" en portal dashboard |
| Soft delete: `deletedAt != null` | No aparece en ninguna lista, pero historial disponible para auditoría |

### 🟠 Cronograma

| Condición | Esperado |
|-----------|----------|
| Asignación que superpone con otra del mismo técnico | Actualmente: **no se valida** — se permite overlap |
| `status=cancelled` con `permissionRequested=true` | El gris "cancelled" gana — el color verde se ignora |
| Técnico con `active=false` en selector de asignación | No debe aparecer en el dropdown |
| Asignación sin técnicos asignados | Válida, pero sin aparecer en vistas por técnico |
| Cambio de vista Día→Semana→Mes con filtro activo | Filtro se preserva entre vistas |

### 🟠 Recursos

| Condición | Esperado |
|-----------|----------|
| Asignar técnico ya asignado a otro vehículo | `freeTechnician()` se llama automáticamente |
| Crear vehículo con patente duplicada | Error único — UI debe mostrar mensaje claro |
| Técnico desvinculado (`no_renovado`/`despedido`) | Aparece en sección "Desvinculados", no en lista activa |
| Activo sin vehículo asignado | Aparece como "sin vehículo" — no error |
| Documento de técnico con fecha de vencimiento pasada | Muestra alerta roja en ficha |
| Técnico con `hireDate` null | RR.HH. section puede fallar si trata como Date |
| `/recursos/clientes/[id]/sucursales/[branchId]` con `branchId` de otro cliente | `notFound()` — se valida `branch.clientId === id` explícitamente, no solo que la sucursal exista |
| Sucursal/lista de usuarios de portal con ≤ 6 filas | `CollapsibleSection` abierta por defecto; > 6 filas, cerrada (Just Burger: 27 sucursales, 15 usuarios) |

### 🟠 Flujo de Caja

| Condición | Esperado |
|-----------|----------|
| `getByText('Facturado')` sin `{ exact: true }` | Strict mode violation — "sobre lo facturado" también matchea |
| Job con `collectionStatus=sin_oc` | Aparece en KPI "Sin OC" separado del pipeline de cobranza |
| Margin calculation con `revenue=0` | Evitar división por cero — retornar `null` o `0%` |
| Importar job duplicado via script Excel | Idempotente — no crea duplicados (`jobCode` como dedup key) |
| `Branch` con `Jobs` activos siendo eliminada | `onDelete: Restrict` — error controlado |

### 🟠 Cotizador / PDF

| Condición | Esperado |
|-----------|----------|
| Cotización con 0 ítems | `computeTotals` retorna `0` en todos los campos — no error |
| Item con `quantity=0` | Contribuye `0` al total — no se filtra |
| Ajuste con `percent=0` y `enabled=true` | Agrega línea `0` — debe incluirse en output |
| `taxRate=0` (exento) | `tax=0`, `total=net` |
| Cotización con > 50 ítems | PDF puede paginarse incorrectamente — no hay validación de máximo |
| Imagen data URI muy grande (> 5MB) | El PDF puede fallar — no hay validación de tamaño |
| Template `minimal` (legacy) | Se normaliza a `clasico` automáticamente en `renderQuoteHTML` |
| PDF generation timeout (> 30s) | HTTP 408 o 500 — Playwright Chromium puede fallar bajo carga |

### 🟠 Portal (JB)

| Condición | Esperado |
|-----------|----------|
| `canViewPortal(superSession, clientId)` | Retorna `true` — staff puede previsualizar portal |
| Portal sin `portalSlug` en DB | `notFound()` — 404 page |
| Login con credenciales incorrectas | Mensaje "Correo o contraseña incorrectos." — sin revelar si el usuario existe |
| `router.push()` post-login | Es client-side async — tests deben usar `waitForURL(dashboard)` no `waitForLoadState` |
| Portal en iOS Safari (no PWA) | Push notifications deshabilitadas — `pushSupported()` retorna `false` |
| Ticket con `showToClient=false` | No visible en portal, aunque el cliente conozca el ID |
| KPI "Emergencias" cuando hay 0 emergencias | Badge verde (sin urgencias) — no muestra animación de alerta |
| Usuario de sucursal ve dashboard/reportes/tickets | Los tres scopean por `branchId` con el mismo criterio (`getClientTickets(clientId, branchFilter)`) — antes solo `/tickets` lo hacía, dashboard y reportes mostraban las demás sucursales |
| Staff usando "Ver como" (impersonar portal) | Rol real sigue siendo `super`/`supervisor` en el JWT — nunca activa gates de `role==='client'` (fusionar, aprobar sucursal, etc.), por diseño |

### 🟡 RR.HH.

| Condición | Esperado |
|-----------|----------|
| Liquidación con `deductions > base + extras` | Líquido negativo — la app no bloquea, pero es inválido en negocio |
| `LeaveRequest` aprobada que se solapea con otra | Actualmente: no hay validación de solapamiento |
| `Payroll` en estado `emitido` siendo editada | Debe requerir confirmación — actualmente no hay guard |
| Técnico sin `baseSalary` | RR.HH. muestra `$0` — no error pero información incompleta |

### 🟡 PWA / Push

| Condición | Esperado |
|-----------|----------|
| SW cachea `chrome-extension://` URLs | Filtrado explícito en `sw.js` — no cachea extensiones |
| `manifest.json` con `screenshots` field | Causa error en Chrome — campo omitido intencionalmente |
| Push con VAPID expirado | `web-push` falla silenciosamente — log de error en server |
| Usuario revoca permiso push post-suscripción | Próximo push falla con 410 — suscripción debe eliminarse de DB |

---

## Mapa de cobertura de tests vs. condiciones de borde

| Condición | Cubierto | Tipo test |
|-----------|----------|-----------|
| Auth: redirección sin sesión | ✅ | E2E auth.spec.ts |
| Auth: credenciales inválidas | ✅ | E2E auth.spec.ts |
| Tenant scope: super ve todo | ✅ | Unit resources-logic.test.ts |
| `computeTotals` qty=0 | ✅ | Unit quote-edge-cases.test.ts |
| `computeTotals` taxRate=0 | ✅ | Unit quote-edge-cases.test.ts |
| `computeTotals` ajuste negativo | ✅ | Unit quote-edge-cases.test.ts |
| CLP tax es entero | ✅ | Unit quote-edge-cases.test.ts |
| `fromDateInput()` vs UTC | ✅ | Unit cashflow-schemas.test.ts |
| Contract type active/terminated | ✅ | Unit resources-logic.test.ts |
| Patente duplicada → error | ❌ | Pendiente unit test |
| Ticket cross-tenant → 403 | ❌ | Pendiente E2E test |
| Técnico desvinculado → sección separada | ✅ | E2E recursos-flow.spec.ts |
| Portal login → dashboard redirect | ✅ | E2E portal-flow.spec.ts |
| Portal `showToClient=false` | ✅ | E2E full-ticket-flow.spec.ts paso 13 (G34) |
| Flujo `getByText` exact match | ✅ | E2E cashflow/rrhh-flujo (fixed) |
| PDF generación sin timeout | ✅ | E2E quotes.spec.ts (timeout=30s) |
| Mobile touch targets ≥40px | ✅ | E2E mobile-audit.spec.ts |
| No scroll horizontal en rutas clave | ✅ | E2E mobile-audit.spec.ts |
| Vehículo revTecnica vencimiento UI | ✅ | E2E recursos-flow.spec.ts |
| Payroll líquido = base + extras - deductions | ✅ | Unit rrhh-labels.test.ts |
| Push subscription cleanup tras 410 | ❌ | Pendiente unit test |
