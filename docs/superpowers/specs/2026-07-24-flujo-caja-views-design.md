# Flujo de Caja — rediseño de vistas — diseño

> Sub-proyecto 3. Depende de los sub-proyectos 0 (componentes compartidos),
> 1 (schema, ya aplicado) y 2 (datos, ya migrados). El HTML de referencia
> (`flujo de caja produccion/INGEGAR_Control_IngegarONE_UI_Acordeon_2026 (1).html`)
> pasó por 13 capas de parches acumuladas (v1→v13); la vista que realmente
> importa es la **última que sobrescribe a las anteriores** — las capas v8-v12
> quedaron como código muerto reemplazado, no son el objetivo a clonar.

## La vista final del prototipo (lo que realmente hay que llevar a la app)

Nav final (3 ítems, no los 9 originales — todo lo demás se volvió filtros
dentro de estas 3 vistas):

1. **"Flujo de Caja"** (vista principal) — lista **acordeón agrupada por
   cliente → período** (día/semana/mes/año, seleccionable). Cada cliente es
   una sección con resumen (pendiente, vencidas) y dentro, cada trabajo es
   una card colapsada (fecha, sucursal, descripción, tags de flujo/tipo,
   botón de estado de pago) que se expande a edición rápida in-line
   (presupuesto, código, OC, factura, fecha factura, plazo, vencimiento,
   estado de pago, neto/IVA/total) sin salir de la lista. KPIs arriba
   (facturas vencidas, vencen en 7 días, ejecutadas sin OC, pagadas este
   mes) — **estos ya existen en `/flujo` hoy** (con período+delta,
   sub-proyecto ya shippeado antes de esta sesión), se mantienen intactos.
2. **"Clientes"** — registro simple (nombre, RUT, plazo de pago, contacto).
   **Ya existe** como `/recursos/clientes` con más funciones (portal, RUTs
   múltiples, logo) — no se duplica, se deja como está.
3. **"Reportes"** — filtros con presets (Todos/Vencidos/Sin OC/Sin
   facturar/Pendientes de pago/Pagados/Sin valor) + exportar Excel/PDF.

## Qué se construye realmente (evitando duplicar lo que ya existe)

- **`/flujo` (vista principal)**: se mantiene la fila de KPIs + PeriodFilter
  actual tal cual. **Se reemplaza la tabla plana de abajo** por el
  componente acordeón cliente→período del prototipo, adaptado al lenguaje
  visual Tailwind ya establecido en la app (no se clona el CSS del
  prototipo 1:1 — mismo layout/jerarquía de información, estética INGEGAR
  One). Usa `job.processFlow`/`commercialStage`/`operationalStage`/
  `documentationStage`/`financialStage` (sub-proyecto 1) para los chips de
  estado en vez de solo `collectionStatus`.
- **`/flujo/trabajos`**: la tabla plana existente pasa a ser la vista
  "todos los trabajos sin agrupar" — se mantiene para power-users/CSV, no
  se elimina. Gana los filtros nuevos (processFlow, cada stage) usando
  `SearchableCombobox` (sub-proyecto 0) para el selector de cliente en vez
  del `<select>` plano actual.
- **Reportes**: `/flujo` ya tiene exportación básica — se extiende con los
  presets del prototipo (Vencidos/Sin OC/Sin facturar/Pendientes/Pagados/
  Sin valor) como chips de filtro rápido, reutilizando `computeMetrics()`
  para los conteos en vez de recalcular en el cliente.
- **Detalle de trabajo** (`/flujo/trabajos/[id]`): gana los campos nuevos
  del sub-proyecto 1 (processFlow, las 4 stages, checklist de documentos
  OT/fotos/informe/enviado, notas de seguimiento) en el form de edición
  existente — no es una página nueva, se extiende la actual.

## Componentes nuevos

- `src/components/cashflow/job-accordion.tsx` — la lista cliente→período,
  server-rendered con islands de interactividad (expandir/colapsar,
  cambiar estado de pago) vía Server Actions, mismo patrón que
  `pipeline-board.tsx` (client component recibiendo datos server-fetched).
- `src/components/cashflow/job-status-chips.tsx` — badges para las 4 stages
  nuevas, mismo patrón que `labels.ts` (`BADGE`/colores por valor) ya usa
  para `collectionStatus`.
- `src/lib/cashflow/group-by-client-period.ts` — función pura que agrupa
  `Job[]` por cliente y luego por período (día/semana/mes/año), reutilizable
  entre la vista principal y reportes.

## Fuera de alcance de este sub-proyecto

- Vinculación manual Job↔Ticket y "qué tickets faltan" — sub-proyecto 4.
- Retrofit del combobox/preview modal en cotizador/tickets/documentos —
  sub-proyecto 5.
- Exportación .xlsx/.ics client-side tipo el prototipo — la app ya genera
  PDF server-side (Playwright) para todo; si se pide Excel real más
  adelante es un sub-proyecto aparte, no se improvisa acá.
