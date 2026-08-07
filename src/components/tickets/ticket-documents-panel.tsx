import { FilePreviewButton } from '@/components/ui/file-preview-modal'
import { DocumentQuickPreview } from '@/components/quotes/document-quick-preview'
import Link from 'next/link'

type TicketDoc = { id: string; name: string; fileUrl: string; mimeType: string | null; uploadedAt: Date; uploadedBy: { name: string; role: string } | null }
type DocLink = { id: string; title: string; createdAt: string; reference: string; quoteId?: string | null }
type JobInstallmentDoc = { id: string; sequence: number; purchaseOrder: string | null; invoiceNumber: string | null }
type JobDocSummary = {
  id: string; description: string
  purchaseOrder: string | null; purchaseOrderFileUrl: string | null
  invoiceNumber: string | null; invoiceFileUrl: string | null
  // Cuotas (informe #12) — si el trabajo tiene, sus OC/factura reemplazan a
  // las del campo plano de arriba (que quedan vacías en ese caso).
  installments?: JobInstallmentDoc[]
}
type ExpenseReceipt = { id: string; description: string | null; receiptUrl: string | null; technician: { name: string } }

const ORIGIN_LABEL: Record<string, string> = { client: 'Cliente', tecnico: 'Técnico', super: 'Administrador', supervisor: 'Administrador' }
function originOf(role?: string | null) {
  return role ? (ORIGIN_LABEL[role] ?? role) : '—'
}

/**
 * Vista unificada de todo lo documental del trabajo, agrupado por categoría
 * y con origen visible — informe #4 del plan de ordenamiento. Extiende el
 * mismo patrón de solo-lectura que ya usa /documentacion (lee de sus fuentes
 * reales en paralelo, sin fusionar tablas ni copiar archivos). Cada archivo
 * se sigue editando donde vive: fotos/otros acá mismo (arriba, en Adjuntos),
 * propuestas/informes en sus editores, OC/factura en el trabajo de Flujo.
 */
export function TicketDocumentsPanel({
  documents, otFileUrl, otNumber, propuestas, informes, jobs, expenses, ticketCode,
}: {
  documents: TicketDoc[]
  otFileUrl: string | null
  otNumber: string | null
  propuestas: DocLink[]
  informes: DocLink[]
  jobs: JobDocSummary[]
  expenses: ExpenseReceipt[]
  /** Ticket.ticketCode — todos los documentos de este panel pertenecen a un único ticket. */
  ticketCode: string
}) {
  const photos = documents.filter(d => d.mimeType?.startsWith('image/'))
  const videos = documents.filter(d => d.mimeType?.startsWith('video/'))
  const others = documents.filter(d => !d.mimeType?.startsWith('image/') && !d.mimeType?.startsWith('video/'))
  const receipts = expenses.filter(e => e.receiptUrl)

  // Cuotas (informe #12): si el trabajo tiene, cada una es su propia entrada
  // de OC/Factura (con "Cuota N" para distinguirlas, sin archivo propio
  // todavía — ver nota en el schema) — si no, se usa el campo plano de
  // siempre (con su archivo, si lo tiene). Nunca ambos a la vez para el
  // mismo trabajo.
  type OcEntry = { key: string; name: string; jobId: string; fileUrl: string | null }
  const ocEntries: OcEntry[] = jobs.flatMap(j =>
    j.installments?.length
      ? j.installments.filter(i => i.purchaseOrder).map(i => ({ key: i.id, name: `${i.purchaseOrder} (cuota ${i.sequence})`, jobId: j.id, fileUrl: null }))
      : j.purchaseOrder ? [{ key: j.id, name: j.purchaseOrder, jobId: j.id, fileUrl: j.purchaseOrderFileUrl }] : [],
  )
  const invoiceEntries: OcEntry[] = jobs.flatMap(j =>
    j.installments?.length
      ? j.installments.filter(i => i.invoiceNumber).map(i => ({ key: i.id, name: `${i.invoiceNumber} (cuota ${i.sequence})`, jobId: j.id, fileUrl: null }))
      : j.invoiceNumber ? [{ key: j.id, name: j.invoiceNumber, jobId: j.id, fileUrl: j.invoiceFileUrl }] : [],
  )

  const hasAnything = photos.length + videos.length + others.length + propuestas.length + informes.length
    + receipts.length + ocEntries.length + invoiceEntries.length > 0 || !!otFileUrl
  if (!hasAnything) return null

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ink">Documentos del trabajo</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {otFileUrl && (
          <DocGroup title="OT">
            <FileRow name={otNumber ? `OT ${otNumber}` : 'Orden de trabajo'} fileUrl={otFileUrl} />
          </DocGroup>
        )}
        {photos.length > 0 && (
          <DocGroup title={`Fotografías (${photos.length})`}>
            {photos.map(d => <FileRow key={d.id} name={d.name} fileUrl={d.fileUrl} mimeType={d.mimeType} origin={originOf(d.uploadedBy?.role)} />)}
          </DocGroup>
        )}
        {videos.length > 0 && (
          <DocGroup title={`Videos (${videos.length})`}>
            {videos.map(d => <FileRow key={d.id} name={d.name} fileUrl={d.fileUrl} mimeType={d.mimeType} origin={originOf(d.uploadedBy?.role)} />)}
          </DocGroup>
        )}
        {others.length > 0 && (
          <DocGroup title={`Otros (${others.length})`}>
            {others.map(d => <FileRow key={d.id} name={d.name} fileUrl={d.fileUrl} mimeType={d.mimeType} origin={originOf(d.uploadedBy?.role)} />)}
          </DocGroup>
        )}
        {propuestas.length > 0 && (
          <DocGroup title={`Propuestas (${propuestas.length})`}>
            {propuestas.map(d => (
              <PreviewRow key={d.id} name={`${d.reference} · ${d.title}`} docId={d.id} title={`${d.reference} · ${d.title}`} documentType="propuesta" editHref={`/cotizador?docId=${d.id}`} ticketCode={ticketCode} number={d.quoteId} />
            ))}
          </DocGroup>
        )}
        {informes.length > 0 && (
          <DocGroup title={`Informes (${informes.length})`}>
            {informes.map(d => (
              <PreviewRow key={d.id} name={`${d.reference} · ${d.title}`} docId={d.id} title={`${d.reference} · ${d.title}`} documentType="informe" editHref={`/informe?docId=${d.id}`} ticketCode={ticketCode} />
            ))}
          </DocGroup>
        )}
        {ocEntries.length > 0 && (
          <DocGroup title={`OC (${ocEntries.length})`}>
            {ocEntries.map(e => (
              e.fileUrl
                ? <FileRow key={e.key} name={e.name} fileUrl={e.fileUrl} />
                : <LinkRow key={e.key} name={e.name} href={`/flujo/trabajos/${e.jobId}?section=cuotas`} />
            ))}
          </DocGroup>
        )}
        {invoiceEntries.length > 0 && (
          <DocGroup title={`Facturas (${invoiceEntries.length})`}>
            {invoiceEntries.map(e => (
              e.fileUrl
                ? <FileRow key={e.key} name={e.name} fileUrl={e.fileUrl} />
                : <LinkRow key={e.key} name={e.name} href={`/flujo/trabajos/${e.jobId}?section=cuotas`} />
            ))}
          </DocGroup>
        )}
        {receipts.length > 0 && (
          <DocGroup title={`Boletas y compras (${receipts.length})`}>
            {receipts.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-gray-600">{e.description || 'Comprobante'} · {e.technician.name}</span>
                {/* receiptUrl puede ser data: URI o R2 key legado — mismo patrón que expense-list.tsx (href directo, sin proxy) */}
                <a href={e.receiptUrl!} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-brand hover:underline">Ver</a>
              </div>
            ))}
          </DocGroup>
        )}
      </div>
    </section>
  )
}

function DocGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function FileRow({ name, fileUrl, mimeType, origin }: { name: string; fileUrl: string; mimeType?: string | null; origin?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="truncate text-gray-600">{name}{origin && <span className="ml-1.5 text-gray-400">· {origin}</span>}</span>
      <FilePreviewButton fileUrl={fileUrl} type="ticket" name={name} mimeType={mimeType} className="shrink-0 text-xs font-semibold text-brand hover:underline" />
    </div>
  )
}

function LinkRow({ name, href }: { name: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="truncate text-gray-600">{name}</span>
      <Link href={href} className="shrink-0 font-semibold text-brand hover:underline">Ver →</Link>
    </div>
  )
}

// Propuestas/informes son documentos JSON (no archivos), así que en vez de
// navegar afuera (bug real reportado: "algunos se abren en pantalla
// completa") reusan DocumentQuickPreview — mismo patrón ya establecido en
// /informe, /cotizador y la lista de Tickets (badges OT/IT/PT).
function PreviewRow({ name, docId, title, documentType, editHref, ticketCode, number }: {
  name: string; docId: string; title: string; documentType: 'propuesta' | 'informe'; editHref: string
  ticketCode: string; number?: string | null
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="truncate text-gray-600">{name}</span>
      <DocumentQuickPreview
        docId={docId} title={title} documentType={documentType} editHref={editHref}
        trigger="Ver →" triggerClassName="shrink-0 font-semibold text-brand hover:underline"
        ticketCode={ticketCode} number={number}
      />
    </div>
  )
}
