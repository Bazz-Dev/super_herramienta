# Correlativo global de presupuestos + ID de ticket con modalidad + nombres de archivo — diseño

> **Reemplaza la versión anterior de este mismo spec** (misma sesión, mismo
> día). La primera versión diseñaba solo un candado para `quoteId` +
> referencias calculadas OT/FAC/OC. El dueño trajo después un documento de
> definición de su socio (Sebastián Garrido —
> `INGEGAR UPGRADE/INGEGAR ONE — Propuestas Comerciales.html`) con una
> especificación más completa para el módulo Propuestas Comerciales. Se
> contrastaron ambos documento a documento contra el código real, se
> resolvieron las contradicciones con el dueño (ver "Decisiones" abajo), y
> este documento consolida el resultado. Nada de la versión anterior se había
> empezado a implementar — no hay migración a revertir.

## Qué se auditó antes de diseñar (verificado, no asumido)

Heredado de la v1 de este spec, sigue vigente:
- `Ticket.ticketCode`/`Job.code` ya son inmutables por construcción (unique +
  retry sobre P2002). `ClientDocument.quoteId` es el único dato mutable real
  hoy (input libre en `quote-editor.tsx`).
- No existe `factura_id`/`ot_id` como referencia interna — `invoiceNumber`/
  `purchaseOrder` son texto libre; el folio de factura real lo emite el SII,
  no INGEGAR ONE (confirmado en comentario de código existente).

Nuevo, auditado para esta revisión:
- **`DocumentQuickPreview`** (`src/components/quotes/document-quick-preview.tsx`)
  ya tiene Editar, Ver en grande, Descargar, Cerrar, funcionando en
  producción — le falta **Eliminar**. Ya soporta un `trigger` custom (prop
  existente), así que un botón "📄 DOC" no requiere tocar el componente.
- Listado actual de `/cotizador` (`page.tsx`): columnas `Propuesta | Cliente
  | Ticket | PP/ED | Estado | Monto | Creada | Por` — sin checkbox, sin
  Sucursal, sin selección múltiple, sin acciones masivas. `quoteId` se
  muestra ya como texto secundario bajo el título (patrón a reusar para
  Monto/Creado por en el nuevo layout, no perderlos).
- **`Ticket.processFlow`** (`pre_quote`/`post_execution`, ya implementado —
  informe #2) tiene el comentario textual *"Modalidad comercial: PP
  (pre_quote) exige propuesta aprobada antes de ejecutar; ED
  (post_execution) ejecuta primero y valoriza después"* — es el mismo
  concepto que la "modalidad comercial CP/EM" del documento de Sebastián,
  confirmado con el dueño. Hoy es **nullable** (142 tickets históricos sin
  valor, decisión que hoy se toma después de crear el ticket, no al crear).
- No existe ninguna tabla de configuración/settings genérica en el schema —
  una tabla nueva mínima para el ancla del correlativo está justificada.
- `src/lib/zip.ts` (`buildZipFromR2Keys`) usa `archiver` (ya instalado) pero
  asume R2 — las propuestas viven en `dataJson` (`fileKey === 'inline'`, ver
  `.claude/rules/data.md`), no en R2, así que necesita una función hermana,
  no la misma función.
- `src/lib/audit.ts` (`logAudit()`) ya existe y se usa en otras acciones
  administrativas (ej. `sucursales/actions.ts`) — reusable para el historial
  de cambios del correlativo en vez de inventar un mecanismo de auditoría
  nuevo.

## Decisiones de alcance (resueltas con el dueño, contrastando ambos documentos)

1. **Formato de N° de presupuesto**: se adopta el de Sebastián — correlativo
   **plano y global de empresa** (`20000, 20001, 20002...`), no por
   cliente/fecha. Reemplaza `ING-COT-YYMMDD-CLIENTE-SEQ` (formato de hoy,
   documentado en `CLAUDE.md` — **hay que actualizar esa línea** al
   implementar). El input libre + "Generar automáticamente" que se shippeó
   hoy mismo (G65) se revierte: el campo pasa a **siempre** solo-lectura, el
   número se asigna al guardar.
2. **Referencias FAC/OC/OT**: se descarta el mecanismo de sufijo calculado
   (`{ticketCode}-FAC-N`) de la v1 de este spec. Se adopta el de Sebastián:
   **tokens separados en el nombre de archivo** (`FACTURA_1350_{ticketCode}.pdf`),
   nunca fusionados en un string de referencia nuevo. Más simple, cero
   funciones nuevas en `reference.ts`.
3. **ID de ticket**: se rediseña su estructura (`{fecha}-{cliente}-{sucursal}-
   {CP|EM}{seq}`), reusando `Ticket.processFlow` como el eje de modalidad —
   que pasa de opcional a **obligatorio al crear** un ticket nuevo (impacto
   real en `new-ticket-form.tsx` y en el flujo del portal, ver Arquitectura).
   Tickets históricos: intocados, mismo criterio de siempre.
4. **Correlativo de presupuestos**: gobernanza global con panel admin +
   auditoría completa (quién/cuándo/qué), en vez del modelo "cada documento
   se regenera a sí mismo" de G65.
5. **Nada que renombrar en producción** — se mantiene de la v1: ningún valor
   ya guardado cambia. Los tickets/propuestas antiguos simplemente no tienen
   el formato nuevo; conviven ambos formatos en la base para siempre (mismo
   criterio ya aplicado a `ticketCode`/`Job.code` en general).

## Arquitectura

### 1. Correlativo global de presupuestos

Tabla nueva mínima (nada existente cubre "piso configurable con auditoría"):

```prisma
model QuoteSequenceConfig {
  id          String   @id @default(cuid())
  tenantId    String   @unique
  nextNumber  Int
  updatedAt   DateTime @updatedAt
  updatedById String

  @@map("quote_sequence_config")
}
```

- `getNextQuoteSeq()` (`src/app/(app)/cotizador/actions.ts`) cambia de
  `MAX(quoteId numérico existente) + 1` a
  `max(MAX(quoteId numérico existente) + 1, config.nextNumber)` — reusa el
  cálculo de hoy tal cual, solo le agrega el piso configurado. Una vez que
  documentos reales empiecen a usar números, el watermark real toma el
  control solo — `config.nextNumber` es puramente el ancla de arranque.
- Nuevo Server Action `updateQuoteSequenceConfig(nextNumber)`, gate
  `super`-only. Rechaza si `nextNumber <= max(watermark actual,
  config.nextNumber actual)` con el mensaje de error ya redactado por
  Sebastián. Si acepta: actualiza la fila y llama `logAudit()` — historial
  completo de cambios, no solo el último (display del "última modificación"
  lee `updatedAt`/`updatedById` de la fila directamente, sin necesidad de
  consultar el log para el caso común).
- `quote-editor.tsx`: el campo `N° Cotización` pasa a **siempre**
  solo-lectura (se elimina el input libre y el botón "Generar
  automáticamente" de G65 — revierte ese pedazo). El número se asigna al
  guardar (POST de creación en `/api/client-documents`), nunca antes.
- Nuevo panel "🔑 Configuración de presupuestos" (botón visible solo
  `super`) en `/cotizador`: muestra último usado / próximo configurado /
  campo para nuevo próximo número / última modificación (fecha+usuario) —
  mockup ya provisto por Sebastián, reusa `Modal` existente.

### 2. ID de ticket con modalidad comercial

```
{YYMMDD}-{CLIENTE}-{SUCURSAL}-{CP|EM}{seq}
```

- Mismo patrón de dos pasos que `generateJobCode()` (`src/lib/cashflow/generate-code.ts`):
  prefijo (`YYMMDD-CLIENTE-SUCURSAL-CP` o `...-EM`) + `MAX(existente con ese
  prefijo) + 1`, envuelto en retry sobre P2002 real (mismo criterio Turso/
  libSQL ya documentado en `docs/ARQUITECTURA.md` guardrail 4). CP y EM
  cuentan aparte porque son prefijos distintos — no hace falta lógica nueva
  de "dos secuencias", es la misma mecánica de prefijo con un valor más.
- `processFlow` (`pre_quote`→`CP`, `post_execution`→`EM`) pasa de opcional a
  **obligatorio al crear un ticket nuevo** — impacto real, no cosmético:
  - `new-ticket-form.tsx` (interno): nuevo selector obligatorio.
  - Portal (`portal/[slug]/tickets/actions.ts`, `new-ticket-form.tsx` del
    portal): el cliente elige, en lenguaje que entienda ("¿Necesitas
    cotización antes de que vayamos, o es una emergencia?") en vez de la
    jerga interna pre_quote/post_execution.
  - Tickets históricos con `processFlow = null`: se quedan así, su
    `ticketCode` (formato viejo) no cambia — mismo guardrail de siempre.
- `ticket-code.ts` se reescribe siguiendo el modelo de `generate-code.ts`
  (prefijo + secuencia calculada) en vez del esquema actual
  (urgencia-derivada + sufijo `-2`/`-3` en colisión).

### 3. Nombres de archivo por tokens

`{TIPO}_{NUMERO}_{ticketCode}.{ext}`, nunca un sufijo fusionado:
- `PRESUPUESTO_{quoteId}_{ticketCode}.pdf`
- `FACTURA_{invoiceNumber}_{ticketCode}.pdf`
- `OC_{purchaseOrder}_{ticketCode}.{ext}`
- `INFORME_TECNICO_{ticketCode}.pdf` (sin número — el informe no tiene uno)

Documento sin ticket vinculado: se omite el segmento `{ticketCode}`. Aplica
en descarga individual (`DocumentQuickPreview.download()`,
`download-pdf-button.tsx`) y masiva. Reusa el sanitizado de nombre que ya
existe en `document-quick-preview.tsx`.

### 4. Listado de Propuestas — selección y acciones masivas

- Columnas: `Selector | Documento | N° presupuesto | Cliente | Sucursal |
  Fecha | Ticket asociado | Estado` (orden de Sebastián). Monto/Creado por
  pasan a texto secundario bajo la celda correspondiente — mismo patrón que
  ya usa `quoteId` hoy — para no perder esa información.
- Checkbox por fila + "seleccionar todas" (estado en el cliente, sin
  persistencia) + barra de acciones que aparece con ≥1 seleccionada
  (Descargar / Imprimir / Eliminar / Limpiar), mismo patrón visual que
  `FilterBar`.
- `DocumentQuickPreview` gana botón **Eliminar** — confirmación vía `Modal`
  existente (nunca `window.confirm`, regla ya escrita en `frontend.md`),
  mensaje indica que el número no se reutiliza.
- Eliminación masiva: mismo `Modal` de confirmación, mensaje con conteo
  ("Vas a eliminar N propuestas...").
- Descarga masiva: función nueva hermana de `buildZipFromR2Keys` en
  `zip.ts` (mismo `archiver`, ya instalado) que arma el ZIP desde PDFs
  generados en memoria (cada uno vía el mismo endpoint que ya usa
  `DocumentQuickPreview.download()`), no desde R2 — las propuestas viven en
  `dataJson`.
- Impresión masiva: PDF consolidado reusando el mismo generador (concatenar
  los buffers generados, sin nueva dependencia).
- Filtros: se conservan los que ya existen (`ClientFilter`,
  `QuoteNumberFilter`, `TicketSearchFilter`, `DateRangeFilter`,
  `FilterPill` de estado) — falta Sucursal, se agrega siguiendo el mismo
  patrón (`BranchFilter` nuevo, mismo shape que los demás).

## Testing

- Unit: `getNextQuoteSeq()` con/sin config, watermark real > config y
  viceversa; `updateQuoteSequenceConfig` rechaza retroceder, acepta avanzar,
  llama `logAudit()`.
- Unit: generación de `ticketCode` nuevo formato — CP/EM con secuencias
  independientes, colisión resuelta por retry real (no adivinado).
- Unit: nombres de archivo por tipo, con y sin ticket vinculado.
- Integration/visual: selección múltiple en `/cotizador` (seleccionar,
  limpiar, barra aparece/desaparece), Eliminar individual y masivo piden
  confirmación real, descarga masiva produce un ZIP con los PDFs correctos.
- Verificar que un ticket nuevo sin `processFlow` seleccionado no se puede
  crear (ni interno ni portal) — mensaje de error claro.

## Explícitamente fuera de alcance

- Fusionar los tres generadores de ID en uno universal — sigue sin sentido,
  nada de lo de arriba lo requiere.
- Cualquier cambio al número de factura/OC real (SII, cliente) — sigue
  100% manual.
- Backfill o renombrado de registros de producción — nada de este diseño
  sobreescribe un valor ya guardado; ambos formatos (viejo/nuevo) conviven.
- Actualizar `CLAUDE.md`/`ARQUITECTURA.md` con la convención de ID nueva —
  se hace en el mismo commit que el cambio de código, no aparte (regla ya
  establecida del proyecto: docs y código no divergen).
