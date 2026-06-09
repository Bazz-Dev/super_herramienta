# INGEGAR Platform — Project Brief

## Stack
- Next.js 14 App Router (TypeScript)
- SQLite via Prisma ORM
- Tailwind CSS
- NextAuth.js (credentials)
- Playwright para PDF generation
- Deploy: Benzahosting subdomain ops.ingegarchile.cl

## Arquitectura multi-tenant ligera
- Tabla `tenants`: ingegar, justburger, loficoffee
- Cada recurso tiene tenant_id
- INGEGAR role "super" ve todo
- Clientes ven solo su tenant

## Módulos MVP (en orden de build)
1. Auth (login, roles: super / supervisor / client)
2. Cotizador (plantillas HTML + form dinámico + PDF export)
3. Recursos (técnicos, proyectos, asignaciones, calendario)
4. Pipeline (cotizaciones enviadas, estados, follow-up alerts)

## Módulos futuros
- Just Burger: ticketing de mantención (migrar desde GAS)
- Reportes por tenant
- Inventario

## Branding
- Color primario: #f5b100
- Color texto: #111111
- Font: Inter
- Logo: INGEGAR. (con punto)

## Convenciones
- IDs de cotización: ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]
- Rutas API: /api/v1/[módulo]/[acción]
- Todo en español en UI, código en inglés
