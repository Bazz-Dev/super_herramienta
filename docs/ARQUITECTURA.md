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
Superficie de autoservicio para `role=tecnico`. Sin sidebar. Firma electrónica simple (FES) + asignaciones + gastos.

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
**Para qué**: Generar propuestas/informes en PDF y guardarlos en carpeta del cliente.
**Flujo**: Editor → preview vivo → guardar como JSON editable en `ClientDocument` → PDF generado on-demand.
**Re-editar**: `/cotizador?docId=xxx` carga el JSON guardado en el editor.
**No requiere R2**: el JSON se guarda en `ClientDocument.dataJson` (DB). `fileKey="inline"`.
**Templates activos**: solo `clasico` (template `minimal` eliminado en v1.8.0, docs legados normalizados).
**Bug timezone resuelto**: `formatDate('YYYY-MM-DD')` ahora parsea como fecha local (no UTC) evitando el desfase de 1 día en zona UTC-4.

### Carpetas de clientes (`/documentos`)
**Para qué**: Ver todas las propuestas e informes guardados, organizados por cliente.
**Acciones por documento**: Editar (reabre en editor), Descargar PDF (on-demand), Eliminar.

### Recursos (`/recursos`) — Inventario
**Para qué**: Técnicos, vehículos, activos, cuadrillas, clientes.
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

| Usuario | Contraseña | Rol | Accede a |
|---------|-----------|-----|---------|
| `admin@ingegarchile.cl` | `Ingegar@Super1` | super | Todo |
| `cristian@ingegarchile.cl` | `Ingegar@Comercial1` | supervisor | App interna |
| `carlos@ingegarchile.cl` | `Tecnico@2026` | tecnico | `/mi-panel` |
| `carolina@justburger.cl` | `justburger123` | client | `/portal/justburger` |

> **NOTA**: La contraseña del admin se genera con `SEED_ADMIN_PASSWORD` en el entorno. Si el `.env` no tiene esa variable, se usa `ingegar123`. En entornos con la variable seteada, la contraseña es la del env. Verificar con `admin@ingegarchile.cl / Ingegar@Super1` y si falla probar `ingegar123`.
