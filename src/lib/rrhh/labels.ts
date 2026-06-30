export const LEAVE_TYPE_LABEL: Record<string, string> = {
  vacaciones:         'Vacaciones',
  permiso_sin_goce:   'Permiso sin goce',
  permiso_con_goce:   'Permiso con goce',
  licencia_medica:    'Licencia médica',
  otro:               'Otro',
}

export const LEAVE_STATUS_BADGE: Record<string, string> = {
  pendiente: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  aprobado:  'bg-green-50 text-green-700 border border-green-200',
  rechazado: 'bg-red-50 text-red-600 border border-red-200',
}

export const LEAVE_STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado:  'Aprobado',
  rechazado: 'Rechazado',
}

export const PAYROLL_STATUS_BADGE: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-600 border border-gray-200',
  emitido:  'bg-blue-50 text-blue-700 border border-blue-200',
  pagado:   'bg-green-50 text-green-700 border border-green-200',
}

export const PAYROLL_STATUS_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  emitido:  'Emitido',
  pagado:   'Pagado',
}

export const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function formatClp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}
