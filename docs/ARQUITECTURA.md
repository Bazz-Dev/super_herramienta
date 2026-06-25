# INGEGAR Platform — Arquitectura y Contexto

> Documento de referencia para navegación rápida. Actualizar al agregar módulos o cambiar modelos.
> Última actualización: junio 2026

---

## Para qué sirve la plataforma

Herramienta interna de gestión de INGEGAR. Centraliza operaciones, recursos, facturación y comunicación con clientes. Multi-tenant: INGEGAR opera varios clientes (Just Burger, Decathlon, Unity, otros futuros).

---

## Usuarios y roles

| Rol | Quién | Acceso |
|-----|-------|--------|
| `super` | Gerencia INGEGAR (Sergio, admin) | Todo — todos los tenants |
| `supervisor` | Staff operacional (Cristian, Sebastián) | App interna — tenant propio |
| `client` | Contacto del cliente (Carolina JB, etc.) | Solo portal propio `/portal/{slug}` |

**Regla clave**: `role=client` NUNCA entra a la app interna. El middleware lo redirige al portal.

---

## Superficies de la app

### 1. App interna (`/`) — staff INGEGAR
Ruta base protegida. Solo `super` y `supervisor`.

### 2. Portal cliente (`/portal/{slug}`) — clientes + staff
Cada cliente tiene su portal propio con tema visual personalizado (colors desde `Client.portalTheme`).
- JB: `/portal/justburger` — tema rojo oscuro
- Futuro cliente: crear `Client` con `portalSlug` + usuario `role=client` con `clientId`

**Acceso desde app interna**: el staff (`super`/`supervisor`) puede navegar al portal directamente desde el sidebar de INGEGAR sin re-autenticarse. El helper `canViewPortal()` (`src/lib/portal-auth.ts`) acepta ambos roles. Staff no puede crear tickets — solo ver lo que ve el cliente.

**Sesión**: JWT con `maxAge: 30 días`. Aplica igual para clientes y staff.

---

## Módulos actuales

### Cronograma (`/cronograma`)
**Para qué**: Calendario de trabajos en terreno — qué equipo está con qué cliente, cuándo, permiso de sucursal.
**Modelos**: `Assignment`, `AssignmentAssignee`
**Flujo**: Crear asignación → asignar técnico(s) con rol (técnico/ayudante) → marcar permiso solicitado → color del evento = permiso (verde/amarillo)
**Vista**: Día / Semana / Mes. Filtro por técnico.

### Tickets (`/tickets`) — Staff + Portal cliente
**Para qué**: Gestión de requerimientos de clientes. Dos superficies:
- **Staff** (`/tickets`): ve todos los tickets del tenant, con notas internas, puede cambiar estado, asignar técnico, toggle "visible al cliente"
- **Portal** (`/portal/{slug}/tickets`): el cliente ve solo tickets con `showToClient=true`, sin notas internas ni historial interno

**Modelos**: `Ticket`, `TicketHistory`, `TicketItem`, `TicketDocument`, `TicketCollaborator`
**Campos clave**:
- `showToClient: Boolean @default(true)` — controla visibilidad en portal
- `internalNotes` — NUNCA llega al portal
- `TicketHistory.isInternal` — filtra qué historial ve el cliente

**Carga inicial**: `scripts/import-jb-tickets.ts` — importa 81 tickets históricos de JB desde Excel GAS.
**Flujo normal**: Staff crea ticket (`/tickets/new`) o cliente lo crea desde el portal → staff gestiona estado → cliente sigue evolución en portal.

### Flujo de Caja (`/flujo`)
**Para qué**: Control financiero de trabajos ejecutados — facturación, cobranza, márgenes. **No es tickets** — son trabajos facturados con montos, OC, facturas y estado de pago.
**Modelos**: `Branch` (sucursal del cliente), `Job` (trabajo facturado), `JobCost` (costos del trabajo)
**Carga inicial**: `scripts/import-flujo.ts` — importa histórico desde 3 Excel:
  - `design-reference/Flujo de Caja Just Burger General 2026.xlsx` → JB
  - `design-reference/FLUJO DE CAJA DECATHLON GENERAL 20262.xlsx` → Decathlon
  - `design-reference/FLUJO DE CAJA GENERAL UNITY 2026.xlsx` → Unity
**Flujo normal**: después del import histórico, nuevos trabajos se crean desde la plataforma (`/flujo` → Nuevo trabajo).
**Estado BD actual** (jun-2026): JB 205 trabajos ($73M neto), Decathlon 1 trabajo ($980K), Unity 1 trabajo ($700K). Total $74.8M.

### Propuestas / Cotizador (`/cotizador`)
**Para qué**: Generar cotizaciones técnico-comerciales en PDF. Editor online con plantillas A4.
**Flujo**: Rellenar editor → preview en vivo → descargar PDF. Las imágenes se convierten a data URI en el cliente (no se suben al servidor).
**Pendiente**: persistencia en BD (guardar/listar/editar cotizaciones). Hoy se generan y descargan, no se guardan.

### Informes Técnicos (`/informe`)
**Para qué**: Generar informes técnicos en PDF con secciones y registro fotográfico.
**Mismo patrón** que Cotizador — editor + preview + PDF. Sin persistencia aún.

### Recursos (`/recursos`)
**Para qué**: Inventario operacional — quién trabaja, con qué vehículo, con qué herramientas.
**Modelos**: `Technician`, `Vehicle`, `Asset`, `Crew`, `Client`
**Relaciones clave**:
- Técnico ↔ Vehículo: 1:1 (`Vehicle.technicianId @unique`)
- Vehículo → Activos: 1:N (`Asset.vehicleId`)
- Cuadrilla ↔ Técnicos: M:N
**Campos nuevos en Técnico**: `contractType`, `contractEndDate`, `dailyRate`, `birthDate`, `emergencyContact`, `emergencyPhone`
**Campos nuevos en Vehículo**: `revTecnicaExpiry`, `soapExpiry`, `permisoCirculacionExpiry`, `lastServiceDate`, `nextServiceDate`

---

## Modelos Prisma — mapa de relaciones

```
Tenant ──< User (role: super|supervisor|client)
       ──< Client (portalSlug?, portalTheme?)
                ──< Branch (sucursal física)
                         ──< Job (trabajo facturado) ──< JobCost
                ──< Ticket ──< TicketHistory
                           ──< TicketItem
                           ──< TicketDocument
                           ──< TicketCollaborator
       ──< Technician (contractType, birthDate, emergencyContact...)
                ──< Vehicle (revTecnicaExpiry, soapExpiry...)
                         ──< Asset (herramientas)
       ──< Crew ──< Technician (M:N)
       ──< Assignment ──< AssignmentAssignee (M:N técnico+rol)
```

`User.clientId` → apunta al `Client` cuando `role=client`. Esa es la llave del portal.

---

## Ambientes

| Ambiente | BD | Cómo correr |
|----------|-----|------------|
| Desarrollo | SQLite (`prisma/dev.db`) | `npm run dev` |
| Producción | Turso libSQL | push a `main` → Vercel auto-deploy |

**Variables clave prod** (en `.env.production.local`): `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, `AUTH_URL`

**Migrations prod**: `npm run db:fix:prod` — aplica tablas faltantes a Turso directamente.

---

## Scripts de utilidad

| Script | Qué hace |
|--------|----------|
| `npm run db:seed` | Tenants + usuarios base (dev) |
| `npm run db:seed:prod` | Usuarios base en Turso |
| `npm run setup:jb:prod` | Crea cliente JB con portal + usuario Carolina en Turso |
| `npm run import:jb:prod` | Importa tickets históricos JB desde Excel (idempotente) |
| `npm run import:flujo:prod` | Importa jobs de flujo de caja (JB + Decathlon + Unity) desde Excel (idempotente) |
| `npm run db:fix:prod` | Crea tablas faltantes en Turso (recovery) |

---

## Pendientes prioritarios

1. **Flujo de Caja JB**: borrar 771 jobs incorrectos importados del archivo de tickets, reimportar desde el Excel correcto (`Flujo de Caja Just Burger General 2026.xlsx`) — **requiere autorización explícita para borrar**.
2. **Persistencia Cotizador**: guardar/listar/editar cotizaciones en BD (modelo `Quote` pendiente).
3. **Pipeline**: módulo de seguimiento de cotizaciones enviadas — no iniciado.
4. **Historial JB**: solo 67 de 781 entradas históricas importadas. El import saltó entradas cuando ya había historial. Revisar.

---

## Convenciones de código

- UI en **español**, código/identificadores en **inglés**
- Commits: inglés, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Queries scoped por tenant: `{ ...tenantScope(actor) }` en todo `where`
- Datos del portal: NUNCA `internalNotes` en respuestas al cliente
- Server Actions en `app/(app)/{módulo}/actions.ts` — siempre con `requireActor()`
- Portal actions en `app/portal/[slug]/{módulo}/actions.ts` — siempre verificar `session.user.clientId === clientId`

---

## Accesos de prueba

| Usuario | Contraseña | Rol | Accede a |
|---------|-----------|-----|---------|
| `admin@ingegarchile.cl` | `ingegar123` | super | Todo |
| `cristian@ingegarchile.cl` | `Ingegar@Comercial1` | supervisor | App interna |
| `carolina@justburger.cl` | (configurado en setup) | client | `/portal/justburger` |
