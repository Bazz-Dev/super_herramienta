export const ASSET_STATUS = ['available', 'in_use', 'maintenance', 'retired'] as const
export type AssetStatusId = (typeof ASSET_STATUS)[number]

export const ASSET_STATUS_LABELS: Record<AssetStatusId, string> = {
  available: 'Disponible',
  in_use: 'En uso',
  maintenance: 'Mantención',
  retired: 'De baja',
}

export const ASSET_STATUS_BADGE: Record<AssetStatusId, string> = {
  available: 'bg-green-100 text-green-700',
  in_use: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-amber-100 text-amber-700',
  retired: 'bg-gray-100 text-gray-500',
}

export const ASSIGNMENT_STATUS = ['scheduled', 'in_progress', 'done', 'cancelled'] as const
export type AssignmentStatusId = (typeof ASSIGNMENT_STATUS)[number]

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatusId, string> = {
  scheduled: 'Programada',
  in_progress: 'En curso',
  done: 'Completada',
  cancelled: 'Cancelada',
}

// Calendar pill / badge colors per status.
export const ASSIGNMENT_STATUS_COLOR: Record<AssignmentStatusId, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-800 border-amber-200',
  done: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200 line-through',
}
