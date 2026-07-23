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

// --- Vehículos ---
export const VEHICLE_STATUS = ['active', 'maintenance', 'retired'] as const
export type VehicleStatusId = (typeof VEHICLE_STATUS)[number]

export const VEHICLE_STATUS_LABELS: Record<VehicleStatusId, string> = {
  active: 'Operativa',
  maintenance: 'En mantención',
  retired: 'De baja',
}

export const VEHICLE_STATUS_BADGE: Record<VehicleStatusId, string> = {
  active: 'bg-green-100 text-green-700',
  maintenance: 'bg-amber-100 text-amber-700',
  retired: 'bg-gray-100 text-gray-500',
}

// --- Rol de un integrante en una asignación ---
export const ASSIGNEE_ROLE = ['tecnico', 'ayudante'] as const
export type AssigneeRoleId = (typeof ASSIGNEE_ROLE)[number]

export const ASSIGNEE_ROLE_LABELS: Record<AssigneeRoleId, string> = {
  tecnico: 'Técnico',
  ayudante: 'Ayudante',
}

export const ASSIGNEE_ROLE_BADGE: Record<AssigneeRoleId, string> = {
  tecnico: 'bg-brand/15 text-brand-600',
  ayudante: 'bg-gray-100 text-gray-600',
}

// --- Tipo de contrato de técnico ---
export const CONTRACT_TYPE = ['indefinido', 'plazo_fijo', 'ayudante', 'no_renovado', 'despedido'] as const
export type ContractTypeId = (typeof CONTRACT_TYPE)[number]

/** States that represent active employment */
export const CONTRACT_TYPE_ACTIVE: ContractTypeId[] = ['indefinido', 'plazo_fijo', 'ayudante']
/** States that represent terminated employment */
export const CONTRACT_TYPE_TERMINATED: ContractTypeId[] = ['no_renovado', 'despedido']

export const CONTRACT_TYPE_LABELS: Record<ContractTypeId, string> = {
  indefinido:  'Contrato indefinido',
  plazo_fijo:  'Plazo fijo',
  ayudante:    'Ayudante / eventual',
  no_renovado: 'No renovado',
  despedido:   'Despedido',
}

export const CONTRACT_TYPE_CARD: Record<ContractTypeId, string> = {
  indefinido:  'border-blue-200 bg-blue-50',
  plazo_fijo:  'border-amber-200 bg-amber-50',
  ayudante:    'border-purple-200 bg-purple-50',
  no_renovado: 'border-gray-200 bg-gray-50',
  despedido:   'border-red-200 bg-red-50',
}

export const CONTRACT_TYPE_BADGE: Record<ContractTypeId, string> = {
  indefinido:  'bg-blue-100 text-blue-700',
  plazo_fijo:  'bg-amber-100 text-amber-700',
  ayudante:    'bg-purple-100 text-purple-700',
  no_renovado: 'bg-gray-100 text-gray-500',
  despedido:   'bg-red-100 text-red-700',
}

export const CONTRACT_TYPE_DOT: Record<ContractTypeId, string> = {
  indefinido:  'bg-blue-500',
  plazo_fijo:  'bg-amber-500',
  ayudante:    'bg-purple-500',
  no_renovado: 'bg-gray-400',
  despedido:   'bg-red-500',
}

// --- Tipo de documento de técnico ---
export const DOC_TYPE = ['contrato', 'carnet', 'epp', 'altura', 'antecedentes', 'licencia', 'otro'] as const
export type DocTypeId = (typeof DOC_TYPE)[number]

export const DOC_TYPE_LABELS: Record<DocTypeId, string> = {
  contrato: 'Contrato de trabajo',
  carnet: 'Carnet de identidad',
  epp: 'Certificado EPP',
  altura: 'Examen altura geográfica',
  antecedentes: 'Certificado de antecedentes',
  licencia: 'Licencia de conducir',
  otro: 'Otro documento',
}

// Documentos que la empresa exige tener siempre al día por técnico — base
// para acreditarlo ante plataformas de proveedores/clientes. "carnet" exige
// las 2 caras (Frontal/Reverso vía el campo `label` libre, sin duplicar el
// enum) — el resto solo necesita al menos un documento subido de ese tipo.
export const MANDATORY_DOC_TYPES: DocTypeId[] = ['contrato', 'carnet', 'altura']

export function mandatoryDocChecklist(docs: { type: string; label: string | null }[]) {
  return MANDATORY_DOC_TYPES.map((type) => {
    if (type === 'carnet') {
      const carnetDocs = docs.filter((d) => d.type === 'carnet')
      const hasFrontal = carnetDocs.some((d) => d.label?.toLowerCase().includes('frontal'))
      const hasReverso = carnetDocs.some((d) => d.label?.toLowerCase().includes('reverso'))
      return { type, label: DOC_TYPE_LABELS[type], complete: hasFrontal && hasReverso, detail: `${hasFrontal ? '✓' : '✗'} Frontal · ${hasReverso ? '✓' : '✗'} Reverso` }
    }
    return { type, label: DOC_TYPE_LABELS[type], complete: docs.some((d) => d.type === type), detail: null }
  })
}

// --- Tipo de documento de empresa (reglamento, mutualidad, etc.) ---
export const COMPANY_DOC_TYPE = ['reglamento', 'mutualidad', 'procedimiento', 'otro'] as const
export type CompanyDocTypeId = (typeof COMPANY_DOC_TYPE)[number]

export const COMPANY_DOC_TYPE_LABELS: Record<CompanyDocTypeId, string> = {
  reglamento: 'Reglamento interno',
  mutualidad: 'Mutualidad',
  procedimiento: 'Procedimiento interno',
  otro: 'Otro documento',
}

// --- Color del evento en el calendario según el permiso de sucursal.
// Verde = permiso solicitado/concedido · Amarillo = pendiente. Cancelada gana en gris.
export function permissionEventColor(permissionRequested: boolean, status: AssignmentStatusId): string {
  if (status === 'cancelled') return 'bg-gray-100 text-gray-500 border-gray-200 line-through'
  return permissionRequested
    ? 'bg-green-100 text-green-800 border-green-300'
    : 'bg-amber-100 text-amber-900 border-amber-300'
}
