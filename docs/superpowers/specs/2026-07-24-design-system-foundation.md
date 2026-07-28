# Sistema de diseño — fundación — diseño

> Fase 1 de la iniciativa de refinamiento UX/UI global de INGEGAR One. El
> dueño explícitamente eligió "fundación primero": definir tokens y
> componentes primitivos compartidos antes de tocar pantalla por pantalla,
> para que el resultado final sea un sistema único y no N pantallas
> refinadas cada una con su propio criterio.
>
> Alcance de esta fase: **no** es una reescritura de toda la plataforma.
> Es la base (tokens + primitivos) más una demostración concreta en 1-2
> pantallas — el resto de los módulos se adoptan en fases siguientes.

## Auditoría — qué estaba realmente inconsistente

No todo estaba mal. La escala numérica (spacing, radios, sombras,
tipografía) ya había convergido orgánicamente a algo consistente en todo
el proyecto: `rounded-md` para inputs/controles chicos, `rounded-lg` para
pills de tabs/CTAs secundarios, `rounded-xl` para cards/modales,
`rounded-full` para pills/dots/avatares; `shadow-sm` en reposo →
`shadow-md` en hover para cards; `text-xs/sm/2xl` para meta/body/título de
página. Redefinir una segunda escala encima de una que ya es consistente
solo hubiera creado dos cosas que mantener sincronizadas — por eso
`globals.css` **no** declara una escala nueva de spacing/radio/sombra/tipo.

Los problemas reales encontrados:
- **Botón "primario" reimplementado 3 veces** con looks ligeramente
  distintos: `quotes/ui.tsx`'s `Button`, y variantes hechas a mano en
  `client-form.tsx`/`technician-form.tsx`/`new-ticket-form.tsx` para el
  mismo rol semántico ("+ Nuevo").
- **Colores semánticos (`ok`/`warn`/`danger`/`info`) ya existían en
  `globals.css` pero se usaban en ~5 archivos** — el resto de la app sigue
  usando `bg-green-100`/`text-green-700` etc. directo de Tailwind. Ambos
  leen exactamente igual hoy (los valores de los tokens SON el verde/ámbar/
  rojo/azul-500/700 de Tailwind), así que migrar es una limpieza de fondo,
  no un cambio visual — se hace oportunistamente al tocar un archivo, no
  como barrido propio.
- **`/pipeline` usaba `style={{}}` inline** en vez de Tailwind, la única
  pantalla interna (no-portal) que lo hacía — inconsistente con el resto
  de `(app)/`.
- **Bug real encontrado y corregido en el proceso**: `pipeline-board.tsx`
  aplicaba una clase `border-{color}` completa vía `className` encima del
  `border border-gray-200` que ya trae `Card` — colisión de clases
  Tailwind (cuál border-color gana no está garantizado). Se corrigió
  usando el prop `accent` de `Card` (franja superior), que es semánticamente
  lo que se buscaba, no una segunda clase de borde compitiendo con la
  primera.
- `Modal` solo tenía un tamaño fijo (`max-w-2xl`) — insuficiente para
  vistas previas de documentos/imágenes que quieren más espacio.

## Tokens (`src/app/globals.css`)

Se formalizó lo que ya existía pero no estaba documentado:
- **Brand**: `--color-brand` (#f5b100), `--color-brand-600`, `--color-ink`
  — el único color que significa "esta plataforma", no un resultado.
- **Semántico** (`ok`/`warn`/`danger`/`info`, cada uno con -50/-100/-500/-700):
  reservado para significado de RESULTADO (éxito/advertencia/error/
  informativo) — nunca para diferenciación puramente categórica (columna
  de kanban, tipo de contrato, nivel de urgencia de ticket), que debe
  seguir usando la paleta cruda de Tailwind directamente.
- **Superficie/neutro**: se documentó la convención ya-consistente de la
  escala `gray-*` de Tailwind (400=disabled/placeholder, 500=texto
  secundario, 600=texto/ícono interactivo terciario, 700=texto enfatizado,
  200/100=bordes, 50=fondo de sección sutil) — nunca estuvo escrito, solo
  usado por costumbre.

## Componentes primitivos (`src/components/ui/`)

- **`Button`** — variantes `primary/secondary/danger/ghost`, tamaños
  `sm/md`, soporta `href` (renderiza `<Link>` con el mismo look para CTAs
  que navegan en vez de hacer submit). Reemplaza las 3 implementaciones
  encontradas en la auditoría. Movido desde `quotes/ui.tsx` (que ahora
  re-exporta desde acá para no romper los 14 call-sites existentes).
- **`Badge`** / **`StatusDot`** — 6 tonos semánticos (`brand/ok/warn/danger/
  info/neutral`), variante con punto opcional.
- **`Card`** (ya existía) — confirmado como la base correcta, se le
  encontró y corrigió el bug de colisión de borde arriba.
- **`Table`/`THead`/`TBody`/`Tr`/`Th`/`Td`/`TableEmptyRow`** — nombra la
  convención que ya existía ad hoc en `ticket-list-view.tsx`/vistas de
  RR.HH. (chrome de card + scroll horizontal en viewport angosto, header
  gray-50, filas `divide-y`).
- **`EmptyState`**, **`LoadingMessage`** (mensajes dinámicos tipo
  "Preparando información…"), **`Skeleton`** — construidos, **aún sin
  adoptar en ninguna pantalla real** (ver "Pendiente" abajo).
- **`Tooltip`** — CSS-only (`group-hover`/`group-focus-within`), sin
  dependencia ni motor de posicionamiento dinámico; funciona con teclado
  (foco), no solo mouse.
- **`AutoFilledBadge`** — el ícono "i" con tooltip para campos que se
  llenaron solos (auto-generados/importados/calculados) en vez de
  tipeados por el usuario ahí mismo — pedido explícito del dueño tras ver
  Flujo de Caja. Ya integrado en `/flujo/trabajos/[id]` (código auto-
  generado, IVA auto-calculado, banner de "este registro viene de la
  importación histórica").

## Demostración: Pipeline comercial

`/pipeline` y `pipeline-board.tsx` se eligieron como pantalla de
demostración (no se tocó nada de `/flujo` — otro agente trabajaba ahí en
paralelo). Cambios: `style={{}}` inline → Tailwind consistente con el
resto de `(app)/`, header con back-link "← Dashboard" igual al patrón ya
usado en Recursos, tarjetas de propuesta migradas a `Card`/`Badge`/`Button`/
`EmptyState`, y el bug de colisión de borde corregido usando `Card`'s
`accent` prop con un nuevo mapeo `PROPOSAL_STATUS_ACCENT` (reemplaza
`PROPOSAL_STATUS_BORDER`, que solo tenía ese único call-site problemático).

## Pendiente — no presentado como más certero de lo que es

- `EmptyState`, `LoadingMessage`, `Skeleton` están construidos pero **sin
  ningún consumidor real todavía** — quedaron listos para la siguiente
  fase (adopción módulo por módulo), no verificados en pantalla real.
- La migración de colores hardcodeados → tokens semánticos en el resto de
  la app (~decenas de archivos) es trabajo pendiente, deliberadamente no
  hecho como barrido — se documentó como convención a seguir "de ahora en
  adelante al tocar un archivo", no como tarea de esta fase.
- El resto de la plataforma (Recursos, RR.HH., Tickets, Cotizador,
  Dashboard) no adoptó los primitivos nuevos todavía — eso es la fase
  siguiente, con el dueño revisando este documento y la demo de Pipeline
  antes de decidir escalarlo.
