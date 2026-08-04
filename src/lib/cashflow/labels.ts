export const JOB_TYPE_LABELS: Record<string, string> = {
  requerimiento: 'Requerimiento',
  emergencia: 'Emergencia',
  preventivo: 'Preventivo',
  proyecto: 'Proyecto',
  otro: 'Otro',
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  ejecutado: 'Ejecutado',
  anulado: 'Anulado',
}

export const COST_CATEGORY_LABELS: Record<string, string> = {
  materiales: 'Materiales',
  mano_obra: 'Mano de obra',
  subcontrato: 'Subcontrato',
  transporte: 'Transporte',
  otros: 'Otros',
}
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  combustible: 'Combustible',
  estacionamiento: 'Estacionamiento',
  materiales: 'Materiales',
  viatico: 'Viático',
  herramienta: 'Herramienta',
  otro: 'Otro',
}

// --- Flujo de Caja v2: pistas de estado en paralelo (ver
// docs/superpowers/specs/2026-07-24-flujo-caja-job-schema-design.md) ---

export const PROCESS_FLOW_LABELS: Record<string, string> = {
  pre_quote: 'Cotización previa',
  post_execution: 'Emergencia',
}
export const PROCESS_FLOW_COLORS: Record<string, string> = {
  pre_quote: 'bg-blue-50 text-blue-700 border-blue-200',
  post_execution: 'bg-orange-50 text-orange-700 border-orange-200',
}

// Estado de la OC en sí (informe #11) — ver Job.purchaseOrderStatus.
export const PURCHASE_ORDER_STATUS_LABELS: Record<string, string> = {
  vigente: 'Vigente',
  anulada: 'Anulada',
}
export const PURCHASE_ORDER_STATUS_COLORS: Record<string, string> = {
  vigente: 'bg-green-50 text-green-700 border-green-200',
  anulada: 'bg-red-50 text-red-700 border-red-200',
}

export const COMMERCIAL_STAGE_LABELS: Record<string, string> = {
  intake: 'Solicitud',
  quote_draft: 'Presupuesto en preparación',
  quote_sent: 'Presupuesto enviado',
  valuation_pending: 'Por valorizar',
  approved: 'Aprobado',
  rejected: 'No aprobado',
}
export const COMMERCIAL_STAGE_COLORS: Record<string, string> = {
  intake: 'bg-gray-100 text-gray-600',
  quote_draft: 'bg-gray-100 text-gray-600',
  quote_sent: 'bg-blue-100 text-blue-700',
  valuation_pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export const OPERATIONAL_STAGE_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  scheduled: 'Programado',
  in_progress: 'En ejecución',
  executed: 'Ejecutado',
  client_review: 'Recepción conforme',
  closed: 'Cerrado',
}
export const OPERATIONAL_STAGE_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  executed: 'bg-green-100 text-green-700',
  client_review: 'bg-green-100 text-green-700',
  closed: 'bg-gray-200 text-gray-700',
}

export const DOCUMENTATION_STAGE_LABELS: Record<string, string> = {
  pending: 'Sin documentar',
  partial: 'Parcial',
  ready: 'Listo',
  sent: 'Enviado al cliente',
}
export const DOCUMENTATION_STAGE_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  partial: 'bg-amber-100 text-amber-700',
  ready: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
}

export const FINANCIAL_STAGE_LABELS: Record<string, string> = {
  no_po: 'Sin OC',
  po_requested: 'OC solicitada',
  po_received: 'Con OC',
  to_invoice: 'Por facturar',
  invoiced: 'Facturado',
  payment_pending: 'Pendiente de pago',
  overdue: 'Vencido',
  paid: 'Pagado',
}
export const FINANCIAL_STAGE_COLORS: Record<string, string> = {
  no_po: 'bg-gray-100 text-gray-600',
  po_requested: 'bg-amber-100 text-amber-700',
  po_received: 'bg-blue-100 text-blue-700',
  to_invoice: 'bg-blue-100 text-blue-700',
  invoiced: 'bg-amber-100 text-amber-700',
  payment_pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
}
