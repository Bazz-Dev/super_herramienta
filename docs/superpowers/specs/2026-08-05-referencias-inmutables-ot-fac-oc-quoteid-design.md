# Referencias inmutables (OT/FAC/OC) + candado de `quoteId` — diseño

> Retoma el ítem D deferido de la sesión del 2026-08-05 ("los id no deberían
> ser transferibles, modificables o negociables, ej factura_id, ot_id...").
> Alcance acotado en brainstorming con el dueño — ver memoria
> `project_universal_immutable_ids`. **No** es la reescritura universal de
> generadores de ID que el pedido original sugería; es cerrar una brecha real
> y puntual entre lo ya documentado como dirección acordada
> (`docs/ARQUITECTURA.md` § Modelo objetivo — Ticket como raíz) y lo
> efectivamente implementado.

## Qué se auditó antes de diseñar (no se asume, se verificó)

- `Ticket.ticketCode` (`src/lib/tickets/ticket-code.ts`) y `Job.code`
  (`src/lib/cashflow/generate-code.ts`) **ya son inmutables por
  construcción**: generados por el sistema, constraint `@unique` real en DB,
  colisión resuelta reintentando sobre P2002 (patrón correcto para
  Turso/libSQL MVCC, no un lock de aplicación). Ningún formulario permite
  editarlos después de creados. No requieren cambio.
- `ClientDocument.quoteId` (columna real desde G65, esta misma sesión) **sí es
  mutable hoy**: `<input>` de texto libre en `quote-editor.tsx`, editable en
  cualquier momento, incluso reabriendo una propuesta ya guardada. Este es el
  único bug real de mutabilidad encontrado.
- **No existe `factura_id` ni `ot_id` como referencia interna hoy.**
  `Job.invoiceNumber`/`Job.purchaseOrder` (y sus equivalentes en
  `JobInstallment`) son campos de texto libre — y el número de factura *real*
  en Chile lo emite el SII (folio DTE), no lo genera ni debe generar INGEGAR
  ONE (ya hay un comentario en el código confirmándolo: "factura N° SII
  manual"). `Ticket.otFileUrl` es solo un archivo, sin código de referencia.
- El "informe #12" (`docs/ARQUITECTURA.md`) menciona `[FAC-N] por cuota` como
  si ya existiera — verificado en `ticket-documents-panel.tsx`: lo que se
  muestra hoy es `${invoiceNumber} (cuota ${sequence})`, el número manual +
  el índice crudo, no una referencia generada. Aspiracional, no implementado.

## Decisión de alcance (confirmada con el dueño)

1. **`factura_id`/`ot_id` = referencia interna de INGEGAR, convive con el
   dato real** (folio SII, archivo de OT) — nunca lo reemplaza ni lo
   controla. Descartado explícitamente: que el sistema genere/bloquee el
   número de factura real (no calza con cómo funciona la facturación
   electrónica en Chile).
2. **Registros históricos**: no se les fuerza una referencia automáticamente
   (mismo criterio ya escrito para Ticket/Job — "no forzar relaciones
   históricas"). Con un matiz pedido explícitamente por el dueño: un
   mecanismo para que **`super`** pueda asignar la referencia a un registro
   histórico puntual que hoy no tiene una, vía una acción explícita, una sola
   vez (después de asignada, queda congelada igual que cualquier otra).
3. **Sin nuevas columnas para OT/FAC/OC** — ver Arquitectura. La única
   entidad con un dato real y mutable que corregir es `quoteId`.
4. **Nada que renombrar en producción.** Ningún valor ya guardado
   (`quoteId`, `invoiceNumber`, `purchaseOrder`, `ticketCode`) cambia. Las
   referencias OT/FAC/OC nuevas se calculan al leer, no se escriben nunca —
   no hay backfill posible ni necesario.

## Arquitectura

Dos mecanismos independientes, ninguno requiere migración de schema:

### 1. Referencias calculadas (OT, FAC, FAC-N, OC, OC-N)

Nuevas funciones puras en `src/lib/tickets/reference.ts`, mismo patrón que
`withProposalReference`/`withReportReference` (que ya generan `PPTO-N`/`IT`
sin persistir nada — comentario existente: *"Esto es puramente visual —
nunca se guarda, nunca reemplaza [el ID real]"*):

```ts
// OT: a lo sumo una por ticket (Ticket.otFileUrl es un campo único, no
// una lista) — no necesita numeración, solo presencia/ausencia.
export function otReference(ticketCode: string, hasOT: boolean): string | null {
  return hasOT ? `${ticketCode}-OT` : null
}

// Factura/OC: un Job sin cuotas tiene a lo sumo una; un Job con cuotas
// tiene una por JobInstallment, numerada por su `sequence` ya existente
// (no se inventa un contador nuevo).
export function invoiceReference(ticketCode: string, hasInvoice: boolean, sequence?: number): string | null {
  if (!hasInvoice) return null
  return sequence != null ? `${ticketCode}-FAC-${sequence}` : `${ticketCode}-FAC`
}
export function purchaseOrderReference(ticketCode: string, hasPO: boolean, sequence?: number): string | null {
  if (!hasPO) return null
  return sequence != null ? `${ticketCode}-OC-${sequence}` : `${ticketCode}-OC`
}
```

Un `Job`/`ClientDocument` sin `originTicketId`/`ticketId` (histórico sin
ticket vinculado) no tiene `ticketCode` de origen → las funciones devuelven
`null` — mismo guardrail que ya rige para `Job.legacyNoTicket`, ninguna
excepción nueva que mantener.

**Dónde se consumen** (junto al dato real, nunca en su lugar):
- `ticket-controls.tsx`, `ticket-documents-panel.tsx` — referencia de OT.
- `job-accordion.tsx`, `installment-list.tsx`, `ticket-documents-panel.tsx`
  — referencia de FAC/OC, junto al `invoiceNumber`/`purchaseOrder` real.
- Anexo de OT en el informe técnico (`src/lib/reports/template.ts`,
  `renderOTAnnex()`) — agrega el código junto al título ya corregido esta
  sesión ("Orden de trabajo en terreno").

### 2. Candado de `quoteId`, en dos capas

Hoy solo hay una capa (UI) y ni siquiera bloquea nada:

- **UI** (`quote-editor.tsx`): el campo `N° Cotización` se vuelve
  solo-lectura (el botón "Generar automáticamente" se oculta) en cuanto
  `existingDocId` está presente — es decir, en cuanto el documento ya fue
  guardado al menos una vez. Mientras se está creando (sin guardar aún),
  sigue 100% editable/regenerable como hoy — así se mantiene "elegir el
  primer número a mano" (pedido explícito de esta misma sesión, G65).
- **Servidor** (`PATCH /api/client-documents`): hoy sincroniza `quoteId`
  desde `dataJson` en cada PATCH (fix de G65, esta sesión) — ese es el hueco
  real: un PATCH directo a la API (sin pasar por la UI bloqueada) todavía
  podría sobreescribirlo. Cambia a: el PATCH solo escribe `quoteId` si el
  valor **actual en DB** es `null`. Si ya tiene valor, esa parte del payload
  se ignora — el resto del documento (`dataJson`, título, etc.) se guarda
  normal, sin error, sin bloquear el resto del guardado.
- **Escape hatch** (nuevo, `super`-only): Server Action `assignQuoteId(docId,
  quoteId)` en `src/app/(app)/cotizador/actions.ts`. Verifica
  `requireActor(['super'])` y que el `quoteId` actual en DB sea `null` antes
  de escribir — devuelve error explícito si cualquiera de las dos
  condiciones falla (no confía solo en que la UI oculte el botón). En
  `quote-editor.tsx`, un botón "Asignar N°" aparece únicamente cuando
  `data.quoteId` viene vacío **y** el actor es `super` (rol ya disponible en
  sesión, mismo patrón que otros gates de rol en la app).

## Manejo de errores

- PATCH con `quoteId` ya establecido → no lanza error, ignora silenciosamente
  ese campo del payload (evita que un guardado normal de edición de contenido
  falle por un intento incidental de sobreescritura).
- `assignQuoteId` con rol distinto de `super`, o con `quoteId` ya no-nulo →
  error explícito, mensaje claro, nunca falla en silencio (es una escritura
  deliberada de un solo uso, no una sincronización de fondo).
- Referencias calculadas (`otReference`/`invoiceReference`/
  `purchaseOrderReference`): sin estado de error posible — son funciones
  puras sobre datos que ya están cargados, `null` es la única salida "vacía".

## Testing

- Unit tests nuevos para las 3 funciones de `reference.ts`: con/sin ticket
  vinculado, con/sin cuotas, numeración correcta por `sequence`.
- Unit/integration test de que `PATCH /api/client-documents` no sobreescribe
  un `quoteId` ya no-nulo (payload con `quoteId` distinto → valor en DB no
  cambia, resto del documento sí se actualiza).
- Unit test de `assignQuoteId`: rechaza actor no-`super`; rechaza cuando
  `quoteId` ya tiene valor; éxito solo cuando ambas condiciones se cumplen.
- Verificación visual (Playwright/navegador, `.claude/rules/testing.md`): el
  campo `N° Cotización` se ve solo-lectura al editar una propuesta existente;
  el botón "Asignar N°" solo aparece para `super` y solo si está vacío.

## Explícitamente fuera de alcance

- Fusionar los tres generadores de ID (`ticket-code.ts`, `quote-id.ts`,
  `generate-code.ts`) en uno universal — descartado por escrito en
  `docs/ARQUITECTURA.md` § Modelo objetivo, guardrail 3, y confirmado de
  nuevo con el dueño en el brainstorming de este spec.
- Cualquier cambio al número de factura real (SII) o su flujo — sigue siendo
  100% manual, como debe ser.
- Backfill masivo o renombrado de registros de producción — no aplica bajo
  este diseño (nada se sobreescribe, todo lo nuevo se calcula al leer).
- Columnas reales/filtrables para OT/FAC/OC en listados (Conciliación,
  Flujo) — el filtro por ticket (`TicketSearchFilter`, ya existe) ya cubre
  encontrar la referencia de un ticket puntual; agregar columnas dedicadas
  queda para si aparece una necesidad real de filtrar por FAC/OC de forma
  independiente del ticket.
