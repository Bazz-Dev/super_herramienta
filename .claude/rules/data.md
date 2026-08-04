# Datos — Prisma, Turso, multi-tenant

## Prisma 7

- El generador emite el cliente en `src/generated/prisma/` (gitignored, se regenera con
  `prisma generate`). Importar el cliente **solo** desde `src/lib/prisma.ts` (singleton con adapter).
- La URL de conexión vive en `prisma.config.ts` (Prisma 7 la sacó de `schema.prisma`).
- `src/lib/db-adapter.ts` elige `better-sqlite3` (local, `DATABASE_URL=file:`) vs `@libsql/client`
  (Turso/prod, `DATABASE_URL=libsql://`) automáticamente según la URL activa.
- Tras cambiar el schema, reiniciar el dev server — el cliente se cachea en `globalThis` y hot-reload
  no lo recarga.

## Multi-tenant ligero

- Tabla `Tenant` (slug único); cada recurso de negocio lleva `tenantId`.
- Roles: `super | supervisor | client | tecnico`. `super` ve todo (`tenantScope` devuelve `{}`); el
  resto se filtra por su `tenantId`.
- **Regla sin excepciones**: todo query que devuelva datos de negocio debe incluir
  `{ ...tenantScope(actor) }` en el `where`. Helper en `src/lib/tenant.ts`.
- Un solo tenant real hoy: `ingegar`. Just Burger/Decathlon/Happyland son `Client` con portal
  (`portalSlug`), no tenants propios — viven bajo el tenant `ingegar`.
- Portal (`role=client`): ve solo sus propios tickets vía `getClientTickets(clientId)`, nunca
  cross-tenant ni cross-cliente.
- **Usuario de sucursal** (`User.branchId` set, `isClientAdmin=false`): además scopeado a su propia
  sucursal. `getClientTickets(clientId, branchId?)` acepta un segundo parámetro para esto — **los tres
  callers** (`/portal/[slug]/tickets`, `/dashboard`, `/reportes`) deben calcular el mismo
  `branchFilter = (!isStaff && !isClientAdmin && userBranchId) ? userBranchId : null` y pasarlo. Trampa
  real ya mordida: dashboard y reportes se agregaron sin este filtro y exponían las 27 sucursales de
  Just Burger a un usuario de una sola sucursal (cerrado, ver GAP_REGISTER G45) — cualquier vista nueva
  que liste tickets de un cliente en el portal necesita el mismo criterio, no solo la lista principal.
  Sus tickets nuevos nacen en `pendiente_aprobacion` (no `nuevo`) hasta que un admin del cliente
  (`isClientAdmin=true`) los aprueba vía `approvePortalTicket`.

## Dos sistemas de estado en `Job` (Flujo de Caja)

Ver `docs/ARQUITECTURA.md` § "Job — dos sistemas de estado en paralelo" para el detalle completo y la
trampa real ya mordida (v2 nunca se backfilleó para el histórico importado — cualquier predicado
nuevo sobre `Job` necesita el mismo fallback a campos clásicos que ya tiene `job-presets.ts`).

## Relaciones sin FK declarada — verificar antes de usar `include`

Algunos campos que *parecen* relaciones son en realidad scalars sueltos sin `@relation` en el schema
(p.ej. `Job.technicianId`, `Ticket.assignedToId` apunta a `User`, no a `Technician` — para llegar del
uno al otro hay que pasar por `User.technicianId`; `Ticket.parentTicketId`, usado por la fusión de
tickets del portal cliente). Antes de escribir `include: { X: true }`, confirmar en `schema.prisma` que
la relación existe; si no, resolver con una segunda query.

## OT vs. Carpetas de clientes — no son lo mismo, no se fusionan

`Ticket.otFileUrl` (orden de trabajo firmada, escaneada en terreno) y `ClientDocument`
(propuestas/informes, dueño = `Client`) son documentos con dueño y ciclo de vida distintos —
no hay duplicidad de archivo entre ellos hoy. Si se necesita verlos juntos (como en
`/documentacion`), se leen desde su fuente real cada uno, nunca se copia un archivo a la otra tabla.
No crear una tabla intermedia OT↔Client↔Ticket sin una necesidad real de muchos-a-muchos o metadata
por relación — ninguna de las dos existe hoy; `Job.originTicketId` ya permite que un ticket cubra
varios trabajos sin tabla nueva.

Esta regla sigue vigente incluso bajo la dirección de "Ticket como raíz de agregación" acordada
2026-08-02 (`docs/ARQUITECTURA.md` § Ontología del dominio → Modelo objetivo): "expediente único"
ahí significa vista unificada por referencia (extender el patrón de `/documentacion`), nunca fusionar
`ClientDocument`/`TicketDocument`/`Ticket.otFileUrl` en una tabla nueva.

## Turso / producción

Ver `.claude/rules/production-safety.md` para el flujo de escritura seguro. `TURSO_AUTH_TOKEN` +
`DATABASE_URL=libsql://...` en Vercel; nunca en `.env` local.

## R2 (Cloudflare) — almacenamiento de archivos

- Documentos reales (técnico, empresa, tickets, OT) van a R2, nunca a filesystem local (serverless).
- `src/lib/r2.ts`: `uploadToR2`/`deleteFromR2`/`getObjectBuffer` (baja bytes completos, usado para
  armar ZIPs). Lectura siempre vía `/api/files` con signed URL (1h), nunca URL pública directa.
- `fileKey === "inline"` en `ClientDocument` = datos en `dataJson` (DB), no R2 — propuestas/informes
  generados desde el editor no necesitan R2 en absoluto.
- Google Drive fue evaluado y **descartado** como storage — la plataforma usa R2 exclusivamente. Si
  se encuentra código o documentación mencionando Drive para almacenamiento de tickets/documentos,
  está describiendo una decisión ya revertida, no el estado actual.
