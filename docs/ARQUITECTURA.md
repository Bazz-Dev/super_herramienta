# INGEGAR Platform — Arquitectura y Contexto

> Documento de referencia para navegación rápida. Actualizar al agregar módulos o cambiar modelos.
> Última actualización: junio 2026 — v1.7.0

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

## Módulos actuales (v1.7.0)

### Cronograma (`/cronograma`)
**Para qué**: Calendario de trabajos en terreno.
**Modelos**: `Assignment`, `AssignmentAssignee`
**Vistas**: Día/Semana/Mes + Por técnico (swimlane) + Carga laboral.
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

### Carpetas de clientes (`/documentos`)
**Para qué**: Ver todas las propuestas e informes guardados, organizados por cliente.
**Acciones por documento**: Editar (reabre en editor), Descargar PDF (on-demand), Eliminar.

### Recursos (`/recursos`) — Inventario
**Para qué**: Técnicos, vehículos, activos, cuadrillas, clientes.
**Modelos**: `Technician`, `Vehicle`, `Asset`, `Crew`, `Client`, `TechnicianDocument`
**Relaciones**: Técnico ↔ Vehículo 1:1, Vehículo → Activos 1:N, Cuadrilla ↔ Técnicos M:N.

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
**Vistas**: Dashboard, Tickets (filterable), Reportes, Nueva solicitud.
**PWA**: manifest dinámico, push notifications (web-push + VAPID), service worker.
**Sesión**: separada de la app interna, `role=client`.

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

## Pendientes prioritarios (v1.8.0)

1. **Pipeline**: cotizaciones enviadas, estados (enviada/vista/aceptada/rechazada), alertas de seguimiento.
2. **Import histórico Flujo de Caja a Turso prod** (`scripts/import-flujo.ts` contra `DATABASE_URL` de producción).
3. **Estadísticas por técnico**: trabajos ejecutados, horas, distribución semanal.
4. **Migración JB desde GAS**: tickets históricos al portal nuevo.

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
| `admin@ingegarchile.cl` | `ingegar123` | super | Todo |
| `cristian@ingegarchile.cl` | `Ingegar@Comercial1` | supervisor | App interna |
| `carlos@ingegarchile.cl` | `Tecnico@2026` | tecnico | `/mi-panel` |
| `carolina@justburger.cl` | (configurado en setup) | client | `/portal/justburger` |
