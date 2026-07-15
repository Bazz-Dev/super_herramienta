export type TicketStatusId = 'pendiente_aprobacion' | 'nuevo' | 'en_revision' | 'en_ejecucion' | 'esperando_aprobacion' | 'resuelto' | 'cancelado' | 'fusionado'
export type TicketUrgencyId = 'emergencia' | 'urgencia' | 'no_urgente' | 'preventivo'

export const STATUS_LABEL: Record<TicketStatusId, string> = {
  pendiente_aprobacion: 'Pendiente aprobación',
  nuevo: 'Nuevo',
  en_revision: 'En Revisión',
  en_ejecucion: 'En Ejecución',
  esperando_aprobacion: 'Esperando Aprobación',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
  fusionado: 'Fusionado',
}

export const STATUS_COLOR: Record<TicketStatusId, string> = {
  pendiente_aprobacion: 'bg-yellow-100 text-yellow-800',
  nuevo: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-amber-100 text-amber-800',
  en_ejecucion: 'bg-orange-100 text-orange-800',
  esperando_aprobacion: 'bg-purple-100 text-purple-800',
  resuelto: 'bg-green-100 text-green-800',
  cancelado: 'bg-gray-100 text-gray-500',
  fusionado: 'bg-gray-100 text-gray-400',
}

export const STATUS_DOT: Record<TicketStatusId, string> = {
  pendiente_aprobacion: 'bg-yellow-500',
  nuevo: 'bg-blue-500',
  en_revision: 'bg-amber-500',
  en_ejecucion: 'bg-orange-500',
  esperando_aprobacion: 'bg-purple-500',
  resuelto: 'bg-green-500',
  cancelado: 'bg-gray-400',
  fusionado: 'bg-gray-300',
}

export const URGENCY_LABEL: Record<TicketUrgencyId, string> = {
  emergencia: 'Emergencia',
  urgencia: 'Urgencia',
  no_urgente: 'No urgente',
  preventivo: 'Preventivo',
}

export const URGENCY_COLOR: Record<TicketUrgencyId, string> = {
  emergencia: 'bg-red-100 text-red-800',
  urgencia: 'bg-orange-100 text-orange-800',
  no_urgente: 'bg-gray-100 text-gray-600',
  preventivo: 'bg-blue-100 text-blue-700',
}

export const KANBAN_COLUMNS: { status: TicketStatusId; label: string; color: string }[] = [
  { status: 'nuevo',         label: 'Nuevo',         color: 'border-t-blue-500' },
  { status: 'en_revision',   label: 'En Revisión',   color: 'border-t-amber-500' },
  { status: 'en_ejecucion',  label: 'En Ejecución',  color: 'border-t-orange-500' },
  { status: 'resuelto',      label: 'Resuelto',      color: 'border-t-green-500' },
]

export const ALL_STATUSES = Object.keys(STATUS_LABEL) as TicketStatusId[]
export const ALL_URGENCIES = Object.keys(URGENCY_LABEL) as TicketUrgencyId[]

// Lower = shown first in list views
export const URGENCY_PRIORITY: Record<TicketUrgencyId, number> = {
  emergencia: 0,
  urgencia:   1,
  no_urgente: 2,
  preventivo: 3,
}

export const STATUS_PRIORITY: Record<TicketStatusId, number> = {
  pendiente_aprobacion: 0,
  nuevo:                1,
  en_revision:          2,
  en_ejecucion:         3,
  esperando_aprobacion: 4,
  resuelto:             5,
  cancelado:            6,
  fusionado:            7,
}

// Portal CSS badge classes (used with the portal design system in layout.tsx)
export const PORTAL_STATUS_BADGE: Record<string, string> = {
  pendiente_aprobacion: 'badge badge-espera',
  nuevo: 'badge badge-nuevo',
  en_revision: 'badge badge-revision',
  en_ejecucion: 'badge badge-ejecucion',
  esperando_aprobacion: 'badge badge-espera',
  resuelto: 'badge badge-resuelto',
  cancelado: 'badge badge-cancelado',
  fusionado: 'badge badge-cancelado',
}

export const PORTAL_URGENCY_BADGE: Record<string, string> = {
  emergencia: 'badge badge-em',
  urgencia: 'badge badge-ur',
  no_urgente: 'badge badge-rq',
  preventivo: 'badge badge-pr',
}

export const PORTAL_URGENCY_SHORT: Record<string, string> = {
  emergencia: 'Emergencia',
  urgencia: 'Urgente',
  no_urgente: 'Normal',
  preventivo: 'Preventivo',
}

export const PORTAL_STATUS_SHORT: Record<string, string> = {
  pendiente_aprobacion: 'Pend. aprobación',
  nuevo: 'Nuevo',
  en_revision: 'En revisión',
  en_ejecucion: 'En ejecución',
  esperando_aprobacion: 'Esp. aprobación',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
  fusionado: 'Fusionado',
}

export const PROGRESS_STEPS: string[] = ['nuevo', 'en_revision', 'en_ejecucion', 'resuelto']
export const PROGRESS_STEPS_LABEL: string[] = ['Nuevo', 'En revisión', 'En ejecución', 'Resuelto']
