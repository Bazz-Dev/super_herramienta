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

export const COLLECTION_LABELS: Record<string, string> = {
  sin_oc: 'Sin OC',
  pendiente_pago: 'Pendiente pago',
  pagado: 'Pagado',
}

// Tailwind classes for status chips.
export const COLLECTION_COLORS: Record<string, string> = {
  sin_oc: 'bg-gray-100 text-gray-600',
  pendiente_pago: 'bg-amber-100 text-amber-700',
  pagado: 'bg-green-100 text-green-700',
}

export const COST_CATEGORY_LABELS: Record<string, string> = {
  materiales: 'Materiales',
  mano_obra: 'Mano de obra',
  subcontrato: 'Subcontrato',
  transporte: 'Transporte',
  otros: 'Otros',
}
