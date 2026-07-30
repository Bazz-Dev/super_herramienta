# Frontend — sistema de diseño y convenciones

## Identidad

- Primario `#f5b100` (`bg-brand`/`text-brand`), texto `#111111` (`text-ink`). Amarillo = acción
  primaria / selección activa / énfasis de marca — no decoración. Tokens en `src/app/globals.css` vía
  `@theme` (Tailwind v4, CSS-first). Fuente: Inter.
- INGEGAR One es software administrativo B2B: compacto, profesional, predecible. No es un sitio de
  marketing — nunca aplicar criterio de "riesgo estético"/identidad visual experimental aquí. Un color
  semántico (rojo/verde/amarillo) representa un estado real, nunca decoración.

## Primitivos compartidos (`src/components/ui/`)

`Button` (variants primary/secondary/danger/ghost; `buttonClass()` exportado para elementos no-`<button>`
como `<a download>`), `Badge`/`StatusDot`, `Table`, `Modal` (usa `createPortal` a `document.body` —
necesario, sin portal un Modal abierto dentro de una `<table>` rompe la hidratación), `EmptyState`,
`Tooltip`, `FilePreviewButton` (preview universal de documentos — ver abajo), `CollapsibleSection`
(`src/components/ui/collapsible-section.tsx` — título + resumen visible cuando está cerrada +
`defaultOpen`/`forceOpen`; usada donde una lista larga domina la vista, ej. sucursales/usuarios de
portal en la ficha de cliente cuando hay más de ~6 filas, costos/documentos/historial en la ficha de
trabajo de Flujo de Caja — no aplicar en cascada a listas cortas que no generan fricción real).

**Antes de escribir un nuevo botón/badge/modal/card a mano**: comprobar si ya existe el primitivo
equivalente. Reusar es la opción por defecto — no crear una segunda implementación de un patrón que
ya tiene componente compartido, aunque sea "solo para esta pantalla".

## Preview de documentos — un solo patrón

`FilePreviewButton` (`src/components/ui/file-preview-modal.tsx`) es el ÚNICO patrón de "Ver documento"
de toda la app: modal in-app con metadata + preview inline (PDF/imagen), nunca navega afuera como
acción primaria. "Descargar" es la acción primaria; "Abrir original ↗" queda secundaria. Cualquier
listado nuevo de documentos (técnico, empresa, tickets, Documentación y acreditación) lo reusa —
no se escribe un modal de preview nuevo por módulo.

## Filtros

Un solo patrón para "Desde/Hasta": `DateRangeFilter` (`src/components/cashflow/date-range-filter.tsx`)
— dos `<input type="date">` + atajos que solo rellenan esos mismos campos (nunca un mecanismo
paralelo tipo presets relativos + selector de mes/año coexistiendo). Para filtros contextuales
(cliente/sucursal/estado/responsable) usar los primitivos de `src/components/ui/filter-bar.tsx`
(`FilterBar`/`FilterSearch`/`FilterSelect`/`FilterPill`/`FilterClear`) — el layout es compartido, el
estado del filtro se queda en cada página.

## Jerarquía de acciones

Primaria / secundaria / terciaria (ghost) / destructiva (`variant="danger"`) nunca compiten
visualmente al mismo nivel. Una acción destructiva real (eliminar) SIEMPRE pasa por confirmación
(modal, no `window.confirm`) — nunca un toggle de un clic sobre datos reales o dinero.

## Portal cliente — regla crítica, sin excepciones

- El portal (`/portal/[slug]`) usa **siempre inline styles** en contenedores de shell y página —
  nunca `className` Tailwind para colores estructurales (bg/border/text). Las CSS vars del portal
  (`--acc`, `--bg`) pueden no resolver bajo dark mode de OS o ciertas extensiones.
- **Nunca** leer `bg`/`card`/`text` del campo `portalTheme` en DB — `resolvePortalTheme()` los ignora
  siempre; solo `primary` viene de la base, el resto es hardcoded claro (beige `#f4f3f1`/blanco).
- App interna: `className` Tailwind sin problemas, no aplica esta restricción.

## Mobile / touch targets

`min-h-11` (44px) en todo elemento interactivo — nunca `min-h-8` ni valores arbitrarios menores.
Verificado por `tests/e2e/mobile-audit.spec.ts` en todas las rutas (390×844, sin scroll horizontal).

## Implementar un componente compartido nuevo — solo donde suma

No es mandato reemplazar cada `<select>`/preview/modal existente a ciegas apenas se crea un
primitivo nuevo — se aplica donde resuelve fricción real (selector enorme sin buscador, preview que
saca al usuario de la página), no como barrido mecánico de toda la app en una sola sesión.
