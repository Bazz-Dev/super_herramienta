// Deriva status/collectionStatus (los campos "clásicos" de Job) a partir de
// las pistas de estado nuevas — ver docs/superpowers/specs/2026-07-24-flujo-caja-job-schema-design.md.
// Se llama en cada punto de escritura de operationalStage/financialStage para
// que computeMetrics()/dashboard/flujo (que siguen leyendo los campos
// clásicos) nunca queden desincronizados.

import type { OperationalStage, FinancialStage, JobStatus, CollectionStatus } from '@/generated/prisma/enums'

export function deriveJobStatus(operationalStage: OperationalStage, nonBillable: boolean): JobStatus {
  if (nonBillable) return 'anulado'
  switch (operationalStage) {
    case 'executed':
    case 'client_review':
    case 'closed':
      return 'ejecutado'
    case 'scheduled':
    case 'in_progress':
      return 'en_proceso'
    default:
      return 'pendiente'
  }
}

export function deriveCollectionStatus(financialStage: FinancialStage): CollectionStatus {
  switch (financialStage) {
    case 'paid':
      return 'pagado'
    case 'to_invoice':
    case 'invoiced':
    case 'payment_pending':
    case 'overdue':
      return 'pendiente_pago'
    default:
      return 'sin_oc'
  }
}
