# Combobox buscable + modal de vista previa — diseño

> Sub-proyecto 0 de la reescritura de Flujo de Caja. Base reutilizable para
> los selectores (cliente/sucursal/ticket/etc.) y las vistas previas de
> archivo del resto del proyecto — y, por decisión del dueño, se retroalimenta
> también al resto de la app donde ya existen selects planos o vistas previas
> que navegan fuera de la página (cotizador, tickets, documentos).
>
> Regla explícita del dueño: **implementar esto solo donde suma** — no es un
> mandato de reemplazar cada `<select>` de la app a ciegas, sino de resolver
> los puntos reales de fricción (selectores enormes sin buscador, previews
> que sacan al usuario de la página) con un componente consistente.

## Problema

Hoy los selectores de la app son `<select>` nativos con todas las opciones
listadas sin buscador ni orden útil — usable con 5 clientes, doloroso con
tickets (cientos) o listas que van a crecer con Flujo de Caja. Las vistas
previas de archivo (OT, documentos, informes) hoy navegan a una URL firmada
en pestaña nueva o hacen `window.open()`, sacando al usuario del flujo de
trabajo.

## Diseño

### `SearchableCombobox` (`src/components/ui/searchable-combobox.tsx`)

Client component. Input de texto que al enfocarse muestra un dropdown con
las opciones (buscando por texto conforme se escribe), **navegable con
teclado** (↑/↓/Enter/Esc, `role="combobox"`/`listbox`/`option` para
accesibilidad). Selección visible como chip/valor en el input; `name` +
`defaultValue` para funcionar dentro de un `<form>` normal (server actions),
igual que un `<select>` — es un reemplazo directo, no un widget aparte con
su propio estado ajeno al formulario.

Dos modos de carga de opciones, mismo componente:

- **`options: Option[]`** (precargado) — para listas acotadas (clientes,
  sucursales de un cliente). Filtra y ordena en memoria, sin red. Vacío el
  input, muestra las N más recientes según el criterio de recencia que traiga
  cada `Option` (`recentAt?: Date`); todas si no se especifica.
- **`search: (query: string) => Promise<Option[]>`** (Server Action) — para
  listas grandes o crecientes (tickets). Debounce ~150ms, cancela la
  búsqueda anterior si llega una nueva tecla antes de resolver. Con el
  input vacío, `search('')` debe devolver los N más recientes (la Server
  Action decide qué es "reciente" para ese dominio — última actualización
  del ticket, no su creación, confirmado con el dueño).

`Option = { value: string; label: string; sublabel?: string; recentAt?: Date }`
— `sublabel` para la línea secundaria (ej. sucursal bajo el nombre de
cliente, estado bajo el código de ticket).

No agrega dependencias — Tailwind + React puro, mismo patrón que el resto
del proyecto.

### `FilePreviewModal` (`src/components/ui/file-preview-modal.tsx`)

Client component. Se dispara desde un `<button>` (nunca un `<a href>`), abre
un modal centrado (mismo lenguaje visual que los modales ya existentes en
`doc-section.tsx`/`company-doc-section.tsx`): PDF en `<iframe>`, imagen en
`<img>`, con botón cerrar y click-fuera-para-cerrar. Recibe la key de R2 (no
la URL firmada directamente — el propio componente pide la URL firmada a
`/api/files` en el momento de abrir, así la URL nunca queda vieja/cacheada
en el HTML) + el tipo (`'pdf' | 'image'`, o lo infiere de la extensión de la
key).

Si el archivo no es PDF ni imagen (Word/Excel adjuntos a tickets, por
ejemplo) el modal muestra un estado "Vista previa no disponible para este
tipo de archivo" con un link de descarga directo — no todo es previsualizable
inline y no vale la pena forzarlo.

## Dónde se usa primero

Sub-proyectos 1-4 de Flujo de Caja lo consumen de entrada (selector de
cliente/sucursal en las vistas nuevas, selector de ticket al vincular un
`Job`). El retrofit del resto de la app (cotizador, tickets, documentos) es
el sub-proyecto 5, evaluado archivo por archivo — se reemplaza donde el
`<select>` actual es realmente grande o la preview realmente navega fuera,
no como barrido mecánico.

## Fuera de alcance

- Multi-select (ningún selector actual de la app lo necesita).
- Carga infinita/paginada dentro del dropdown — con tope de N resultados
  (a definir en el plan, probablemente 20) alcanza para el volumen real de
  datos de INGEGAR.
- Un design system / librería de componentes formal — esto son dos
  componentes puntuales, no una refundación de la UI.
