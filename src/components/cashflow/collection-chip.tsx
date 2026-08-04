import { financialState, FINANCIAL_LABEL, FINANCIAL_COLOR, type JobLike } from '@/lib/tickets/ticket-state-summary'

// Antes leía Job.collectionStatus directo — ese campo clásico puede quedar
// desincronizado de la OC/factura/pago reales (ver metrics.ts, informe #25).
// financialState() es el mismo cálculo canónico que ya usa la ficha del
// ticket, así que el chip nunca puede contradecir el resto de la app para el
// mismo trabajo.
export function CollectionChip({ job }: { job: JobLike }) {
  const state = financialState(job)
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${FINANCIAL_COLOR[state]}`}>
      {FINANCIAL_LABEL[state]}
    </span>
  )
}
