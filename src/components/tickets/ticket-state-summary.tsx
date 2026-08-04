import {
  operationalState, documentalState, comercialState, financialState,
  OPERATIONAL_LABEL, DOCUMENTAL_LABEL, COMERCIAL_LABEL, FINANCIAL_LABEL,
  OPERATIONAL_COLOR, DOCUMENTAL_COLOR, COMERCIAL_COLOR, FINANCIAL_COLOR,
} from '@/lib/tickets/ticket-state-summary'

type JobLike = Parameters<typeof financialState>[0]

// "La palabra cerrado puede mezclar trabajo terminado, informe terminado,
// factura emitida y dinero recibido" — informe #3. Reemplaza esa única
// palabra por los 4 estados reales de un vistazo.
export function TicketStateSummary({
  ticket, docs, job, propuesta,
}: {
  ticket: { status: string; assignedToId: string | null; processFlow: string | null }
  docs: { hasOT: boolean; hasPhotos: boolean; hasInforme: boolean }
  job: JobLike | null
  propuesta: { proposalStatus: string | null } | null
}) {
  const op = operationalState(ticket)
  const doc = documentalState(docs)
  const com = comercialState(job, propuesta, ticket)
  const fin = financialState(job)

  const items = [
    { label: 'Operativo', value: OPERATIONAL_LABEL[op], color: OPERATIONAL_COLOR[op] },
    { label: 'Documental', value: DOCUMENTAL_LABEL[doc], color: DOCUMENTAL_COLOR[doc] },
    { label: 'Comercial', value: COMERCIAL_LABEL[com], color: COMERCIAL_COLOR[com] },
    { label: 'Financiero', value: FINANCIAL_LABEL[fin], color: FINANCIAL_COLOR[fin] },
  ]

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{it.label}</p>
          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${it.color}`}>
            {it.value}
          </span>
        </div>
      ))}
    </div>
  )
}
