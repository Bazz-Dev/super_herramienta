# INGEGAR Platform — Arquitectura y Contexto

> Documento de referencia para navegación rápida. Actualizar al agregar módulos o cambiar modelos.
> Última actualización: julio 2026 — v1.8.0 (test audit pass)

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

## Módulos actuales (v1.8.0)

### Cronograma (`/cronograma`)
**Para qué**: Calendario de trabajos en terreno.
**Modelos**: `Assignment`, `AssignmentAssignee`
**Vistas**: Día/Semana/Mes + Por técnico (swimlane) + Carga laboral.
**Mobile**: vista agenda list (< md) — asignaciones próximas agrupadas por día, ordenadas por fecha, click abre modal de detalle.
**Vinculación**: `Assignment.ticketId` — un trabajo puede estar vinculado a un ticket.

### Tickets (`/tickets`) — Staff + Portal cliente
**Para qué**: Gestión de requerimientos de clientes.
**Modelos**: `Ticket`, `TicketHistory`, `TicketItem`, `TicketDocument`, `TicketCollaborator`
**Campos clave**: `showToClient`, `internalNotes`, `deletedAt` (soft delete), `folderKey` (R2 prefix)
**Portal**: cliente ve tickets con `showToClient=true`, puede editar si `status=nuevo`, agregar sub-tareas si `status=nuevo|en_revision`.

### Flujo de Caja (`/flujo`)
**Para qué**: Control financiero de trabajos ejecutados — facturación, cobranza, márgenes.
**Modelos**: `Branch`, `Job`, `JobCost`
**Carga histórica**: `scripts/import-flujo.ts` (JB: 205 jobs, Decathlon: 1, Unity: 1).

### Cotizador (`/cotizador`) + Informes Técnicos (`/informe`)
**Para qué**: Generar propuestas/informes en PDF y guardarlos en carpeta del cliente — el cliente ve los documentos consolidados dentro del portal, en el menú Informes (`/portal/[slug]/informes`) para informes técnicos y Propuestas para comerciales. Soporta tanto documentos JSON editables (generados desde el editor) como archivos reales subidos a R2 (informes históricos vinculados desde evidencia de ticket) — ambos casos descargables desde el portal.
**Flujo**: Editor → preview vivo → guardar como JSON editable en `ClientDocument` → PDF generado on-demand.
**Re-editar**: `/cotizador?docId=xxx` carga el JSON guardado en el editor.
**No requiere R2**: el JSON se guarda en `ClientDocument.dataJson` (DB). `fileKey="inline"`.
**Templates activos**: solo `clasico` (template `minimal` eliminado en v1.8.0, docs legados normalizados).
**Bug timezone resuelto**: `formatDate('YYYY-MM-DD')` ahora parsea como fecha local (no UTC) evitando el desfase de 1 día en zona UTC-4.

### Carpetas de clientes (`/documentos`)
**Para qué**: Ver todas las propuestas e informes guardados, organizados por cliente.
**Acciones por documento**: Editar (reabre en editor), Descargar PDF (on-demand), Eliminar.

### Recursos (`/recursos`) — Inventario
**Para qué**: Técnicos, vehículos, activos, clientes. (Cuadrillas: módulo sin uso en la operación real — ruta/modelo `Crew` intactos pero quitado de la navegación.)
**Modelos**: `Technician`, `Vehicle`, `Asset`, `Crew`, `Client`, `TechnicianDocument`
**Relaciones**: Técnico ↔ Vehículo 1:1, Vehículo → Activos 1:N, Cuadrilla ↔ Técnicos M:N.
**Perfil técnico**: navegación por tabs (Resumen / Datos / Vehículo / Documentos). Resumen: stats de cronograma + stats de tickets + tickets recientes + próximas asignaciones. Links accionables a `/tickets?usuario=id` y `/cronograma?tecnico=id`.
**ContractType enum**: `indefinido | plazo_fijo | ayudante | no_renovado | despedido`. Los dos últimos = desvinculados (sección separada en lista, auto-inactivan).
**Documentos**: `DocSection` lista archivos con preview inline vía signed-URL proxy (`/api/files?key=...`).

### Gastos (`/gastos`)
**Para qué**: Control de gastos operacionales por técnico (combustible, viáticos, materiales).
**Modelos**: `Expense`
**Flujo**: Técnico registra → supervisor aprueba/rechaza → notificación push.

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
**Privacidad**: cada cliente ve solo sus propios tickets (`getClientTickets(clientId)`, nunca cross-tenant).
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
       ──< Crew ──< Technician (M:N)
       ──< Assignment ──< AssignmentAssignee (técnico+rol)
                      ──< Expense
```

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
| `resources.spec.ts` | Activos, cuadrillas, cronograma seeded |
| `cashflow.spec.ts` | Dashboard KPIs flujo de caja, jobs list, branches admin |
| `features-v2.spec.ts` | Cotizador, cronograma vistas, vehiculos, clientes, activos |
| `quotes.spec.ts` | Preview cotizador, endpoint PDF auth |
| `tickets-flow.spec.ts` | Kanban board, crear ticket, badge de urgencia, filtros, abrir detalle |
| `recursos-flow.spec.ts` | CRUD técnicos + vehículos, campos de vencimiento, activos/cuadrillas/clientes |
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

## Pendientes prioritarios (v1.9.0)

### 🔴 UX críticos portal cliente
- **Portal ticket list**: mobile UX todavía inferior a ingegar-one internal. Falta densidad visual, jerarquía tipográfica fuerte, cards con más contexto (sucursal, técnico, urgencia en una línea).
- **Portal detalle ticket**: layout no aprovecha espacio en desktop. Sección de progreso (steps) es estática, sin timestamps en cada paso. Falta: botón directo para llamar al técnico o enviar WhatsApp.
- **Botones en general**: los `useTransition` + `isPending` existen en forms de portal, pero navegación por `<a href>` en `portal-ticket-list` no tiene feedback de loading al entrar al detalle (es una navegación de página completa sin spinner).
- **App interna — sidebar mobile**: no colapsa correctamente en viewports < 640px. Tabs y tablas internas no son mobile-first.
- **Portal ticket detail**: usa `var(--p-*)` en inline styles (legacy, funciona por aliases en layout pero viola convención). Migrar a vars canónicas `var(--tx)`, `var(--bg)`, etc.
- **Portal tickets en cronograma**: mantenciones preventivas (`urgency=preventivo`) no aparecen en cronograma del portal — solo aparecen `Assignment` records.

### 🟠 Desconexiones entre entidades (pendientes de UI)
- **Ticket ↔ Assignment**: `Assignment.ticketId` existe en DB pero el calendario no muestra el ticket vinculado en el evento. Desde detalle de ticket, no hay forma de ver si hay un trabajo agendado asociado.
- **Ticket ↔ Job (Flujo de Caja)**: un ticket ejecutado no genera automáticamente un `Job`. Son mundos separados. Oportunidad: al resolver un ticket, ofrecer crear el Job con monto/costos.
- **Técnico ↔ Tickets — link profundo**: stats OK, pero no hay vista "todos los tickets de este técnico" con filtro en `/tickets?assignedTo=id`.

### 🔵 Bugs conocidos (encontrados en audit jul-2026)
- **Passwords en tests E2E**: 5 spec files usaban `ingegar123` pero la DB en dev tiene `Ingegar@Super1` (generada con `SEED_ADMIN_PASSWORD` en `.env`). Corregido en v1.8.0.
- **Unit tests Node 24**: `node --import tsx` con Node.js v24 no resuelve imports TypeScript sin extensión. Todos los imports de fuentes en unit tests deben usar `.ts` explícito. Corregido en v1.8.0.
- **networkidle en E2E**: Páginas con push subscriptions, Service Worker y polling nunca alcanzan `networkidle`. Cambiado a `waitForLoadState('load')`. Corregido en v1.8.0.
- **Portal hamburger useEffect**: El botón hamburger del portal se renderiza condicionalmente vía `isMobile` (useState inicializado en `false`, flip en `useEffect`). El test debe usar `waitForSelector('[aria-label="Abrir menú"]')` para esperar la hidratación. Corregido en v1.8.0.
- **Fechas UTC-4**: `new Date('YYYY-MM-DD')` = UTC midnight. En Chile (UTC-4) se muestra el día anterior. Corregido con `fromDateInput()` en vehiculos, gastos, documentos de técnicos. La regla aplica a CUALQUIER `<input type="date">` guardado vía Prisma.

### 🟡 Valor diferencial pendiente
- **Portal: mini dashboard "resumen del mes"**: tickets abiertos/resueltos, tiempo promedio de respuesta, % SLA cumplido. Primer dato que valida el servicio al cliente.
- **Dashboard interno**: KPIs sin tendencia temporal. Sin tiempo promedio de resolución. Sin alertas de SLA vencido.
- **Mi Panel (técnicos)**: subdesarrollado. Falta vista semanal de agenda, tickets asignados, historial de trabajos. Toda la data existe.
- **Estadísticas por técnico**: histograma semanal de trabajos, carga vs capacidad, comparativa entre técnicos.

### ⬜ Features nuevos
- **Pipeline**: cotizaciones enviadas, estados (enviada/vista/aceptada/rechazada), alertas de seguimiento.
- **Import histórico Flujo de Caja a Turso prod** (`scripts/import-flujo.ts` contra `DATABASE_URL` de producción).
- **Migración JB desde GAS**: tickets históricos al portal nuevo.
- **Notificación al técnico**: cuando se le asigna un ticket desde la app interna, recibir push en Mi Panel.

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
| `Crew` | Cuadrilla de técnicos | tenant | nombre |

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
Crew       ──< Technician  M:N — cuadrilla de técnicos
```

**Invariantes de integridad:**
- Un `Vehicle` con `technicianId` bloquea reasignar ese técnico a otra camioneta sin `freeTechnician()` primero.
- Eliminar un `Client` con `Jobs` activos falla (`onDelete: Restrict`).
- `portalSlug` es único en `Client` — solo un cliente puede tener ese portal URL.
- `plate` es único en `Vehicle` dentro del tenant.
- El rol `client` siempre tiene `clientId != null`; el rol `tecnico` siempre tiene `technicianId != null`.

---

## Taxonomía completa de estados

### Ticket — `status`

```
[nuevo] ──→ [en_revision] ──→ [en_ejecucion] ──→ [esperando_aprobacion] ──→ [resuelto]
   ↓               ↓               ↓                       ↓
[cancelado]   [cancelado]    [cancelado]              [cancelado]

[nuevo] ──→ [fusionado]  ← cuando se duplica con otro ticket
```

| Status | Label UI | Quién puede editar en portal |
|--------|----------|------------------------------|
| `nuevo` | Nuevo | Cliente + staff |
| `en_revision` | En Revisión | Solo staff |
| `en_ejecucion` | En Ejecución | Solo staff |
| `esperando_aprobacion` | Esperando Aprobación | Staff + cliente (aprobar/rechazar) |
| `resuelto` | Resuelto | Solo staff |
| `cancelado` | Cancelado | Solo staff |
| `fusionado` | Fusionado | Solo staff |

**Regla portal**: cliente puede **agregar sub-tareas** solo si `status ∈ {nuevo, en_revision}`.

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

### Job (Flujo de Caja) — `status` / `collectionStatus`

| JobStatus | Label | Cobranza → CollectionStatus |
|-----------|-------|---------------------------|
| `sin_oc` | Sin OC | `sin_oc` → KPI separado |
| `cotizado` | Cotizado | — |
| `facturado` | Facturado | `pendiente → parcial → cobrado` |
| `cancelado` | Cancelado | — |

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
| Fusionar ticket A en ticket B | A queda en `status=fusionado`, B acumula historial |
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
