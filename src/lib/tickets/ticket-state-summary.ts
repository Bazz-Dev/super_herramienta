import { isPaidJob, isOverdueV2, isPartiallyPaidJob, hasPurchaseOrder, hasInvoiceInfo } from '@/lib/cashflow/job-presets'

// Resumen de 4 estados (informe #3 del plan de ordenamiento) — deliberadamente
// CALCULADO, no un campo nuevo en Ticket. Job ya tiene el sistema de 5 etapas
// completo (commercialStage/financialStage/etc.) desde antes; duplicarlo en
// Ticket como columnas propias repetiría exactamente el problema que ya
// mordió este proyecto una vez (Job — dos sistemas de estado en paralelo,
// ver docs/ARQUITECTURA.md § Taxonomía) y además exigiría backfill de los
// tickets históricos. Derivar desde el Ticket + el Job vinculado (si existe)
// es la misma info sin un segundo lugar donde pueda desincronizarse.

export type OperationalState = 'pendiente' | 'asignado' | 'en_ejecucion' | 'terminado' | 'cancelado'
export type DocumentalState = 'incompleto' | 'en_revision' | 'completo'
export type ComercialState = 'sin_propuesta' | 'pendiente_valorizacion' | 'enviada' | 'observada' | 'aprobada'
export type FinancialState = 'sin_trabajo' | 'sin_oc' | 'pendiente_facturar' | 'facturada' | 'parcial' | 'vencida' | 'pagada'

export const OPERATIONAL_LABEL: Record<OperationalState, string> = {
  pendiente: 'Pendiente', asignado: 'Asignado', en_ejecucion: 'En ejecución', terminado: 'Terminado', cancelado: 'Cancelado',
}
export const DOCUMENTAL_LABEL: Record<DocumentalState, string> = {
  incompleto: 'Incompleto', en_revision: 'En revisión', completo: 'Completo',
}
export const COMERCIAL_LABEL: Record<ComercialState, string> = {
  sin_propuesta: 'Sin propuesta', pendiente_valorizacion: 'Pendiente de valorizar',
  enviada: 'Enviada', observada: 'Observada', aprobada: 'Aprobada',
}
export const FINANCIAL_LABEL: Record<FinancialState, string> = {
  sin_trabajo: 'Sin trabajo', sin_oc: 'Sin OC', pendiente_facturar: 'Pendiente de facturar',
  facturada: 'Facturada', parcial: 'Pago parcial', vencida: 'Vencida', pagada: 'Pagada',
}

// Mismo criterio de color que STATUS_COLOR (labels.ts): gris = todavía sin
// avanzar, ámbar = en curso, verde = resuelto bien, rojo = requiere atención.
export const OPERATIONAL_COLOR: Record<OperationalState, string> = {
  pendiente: 'bg-gray-100 text-gray-600', asignado: 'bg-blue-100 text-blue-800',
  en_ejecucion: 'bg-amber-100 text-amber-800', terminado: 'bg-green-100 text-green-800', cancelado: 'bg-gray-100 text-gray-400',
}
export const DOCUMENTAL_COLOR: Record<DocumentalState, string> = {
  incompleto: 'bg-gray-100 text-gray-600', en_revision: 'bg-amber-100 text-amber-800', completo: 'bg-green-100 text-green-800',
}
export const COMERCIAL_COLOR: Record<ComercialState, string> = {
  sin_propuesta: 'bg-gray-100 text-gray-600', pendiente_valorizacion: 'bg-amber-100 text-amber-800',
  enviada: 'bg-blue-100 text-blue-800', observada: 'bg-red-100 text-red-700', aprobada: 'bg-green-100 text-green-800',
}
export const FINANCIAL_COLOR: Record<FinancialState, string> = {
  sin_trabajo: 'bg-gray-100 text-gray-600', sin_oc: 'bg-gray-100 text-gray-600', pendiente_facturar: 'bg-amber-100 text-amber-800',
  facturada: 'bg-blue-100 text-blue-800', parcial: 'bg-orange-100 text-orange-800', vencida: 'bg-red-100 text-red-700', pagada: 'bg-green-100 text-green-800',
}

export function operationalState(ticket: { status: string; assignedToId: string | null }): OperationalState {
  switch (ticket.status) {
    case 'nuevo': case 'pendiente_aprobacion': return 'pendiente'
    case 'en_revision': return ticket.assignedToId ? 'asignado' : 'pendiente'
    case 'en_ejecucion': case 'esperando_aprobacion': return 'en_ejecucion'
    case 'resuelto': return 'terminado'
    default: return 'cancelado' // cancelado, fusionado
  }
}

export function documentalState(t: { hasOT: boolean; hasPhotos: boolean; hasInforme: boolean }): DocumentalState {
  const have = [t.hasOT, t.hasPhotos, t.hasInforme].filter(Boolean).length
  if (have === 3) return 'completo'
  if (have === 0) return 'incompleto'
  return 'en_revision'
}

// Exportado (informe #25) para que cualquier lector de "estado financiero de
// un Job" (chips, exports) use el mismo tipo — en vez de redeclarar la misma
// intersección de parámetros en cada archivo.
export type JobLike = Parameters<typeof isPaidJob>[0] & Parameters<typeof hasPurchaseOrder>[0] & Parameters<typeof hasInvoiceInfo>[0] & Parameters<typeof isPartiallyPaidJob>[0] & {
  commercialStage: string
}

// `ticket` es opcional (compatibilidad hacia atrás): sin él, el cálculo es
// exactamente el de antes. Con él, distingue el caso real de ED (informe #2,
// Ejecución Directa) — "sin_propuesta" describe correctamente a un ticket que
// todavía no arrancó, pero es engañoso para uno que YA se ejecutó/resolvió
// bajo esa modalidad: ahí lo que falta no es "una propuesta", es valorizar
// el trabajo ya hecho. PP (pre_quote) nunca cae acá — para PP no hay
// ejecución sin propuesta aprobada primero (ver canStartExecution).
export function comercialState(
  job: JobLike | null,
  propuesta: { proposalStatus: string | null } | null,
  ticket?: { processFlow: string | null; status: string },
): ComercialState {
  if (job) {
    switch (job.commercialStage) {
      case 'approved': return 'aprobada'
      case 'rejected': return 'observada'
      case 'quote_sent': case 'valuation_pending': return 'enviada'
      default: return 'sin_propuesta'
    }
  }
  switch (propuesta?.proposalStatus) {
    case 'aceptada': return 'aprobada'
    case 'rechazada': return 'observada'
    case 'enviada': case 'vista': return 'enviada'
    default:
      if (ticket?.processFlow === 'post_execution' && ['en_ejecucion', 'esperando_aprobacion', 'resuelto'].includes(ticket.status)) {
        return 'pendiente_valorizacion'
      }
      return 'sin_propuesta'
  }
}

// Gate de ejecución para modalidad PP (Presupuesto Previo, informe #2): un
// ticket pre_quote no puede pasar a en_ejecucion sin propuesta/trabajo
// aprobado. Tipo deliberadamente más angosto que JobLike — esta pregunta
// puntual ("¿está aprobado?") solo necesita commercialStage, no todo el resto
// de campos financieros que comercialState() sí necesita para sus otros
// casos.
export function isProposalApproved(
  job: { commercialStage: string } | null,
  propuesta: { proposalStatus: string | null } | null,
): boolean {
  if (job) return job.commercialStage === 'approved'
  return propuesta?.proposalStatus === 'aceptada'
}

// ED (post_execution) y tickets históricos sin modalidad definida (null)
// nunca se bloquean — el bloqueo es una regla nueva, no se aplica retroactivo
// a datos que no expresaron esta decisión.
export function canStartExecution(processFlow: string | null, approved: boolean): boolean {
  return processFlow !== 'pre_quote' || approved
}

// Un ticket puede tener más de un Job (sin constraint de unicidad en BD, solo
// aviso en UI) — mismo criterio ya usado en /tickets/[id] ("Trabajos en Flujo
// de Caja" lista todos): acá se resume con el más reciente, que es el que
// import { originJobs } ya trae ordenado por createdAt desc.
export function financialState(job: JobLike | null): FinancialState {
  if (!job) return 'sin_trabajo'
  if (isPaidJob(job)) return 'pagada'
  if (isOverdueV2(job, new Date())) return 'vencida'
  // Parcial antes que "facturada" (informe #13): un pago parcial ya avanzó
  // más que solo tener la factura — vencida sigue ganando arriba, mismo
  // criterio que isOverdueV2 ya usa con cuotas parcialmente pagadas.
  if (isPartiallyPaidJob(job)) return 'parcial'
  if (hasInvoiceInfo(job)) return 'facturada'
  if (hasPurchaseOrder(job)) return 'pendiente_facturar'
  return 'sin_oc'
}
