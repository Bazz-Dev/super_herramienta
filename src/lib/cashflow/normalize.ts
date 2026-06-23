// Pure helpers to homologate the Excel cash-flow data into the DB model.

export function parseMoneyCLP(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Math.round(v)
  // "$15.200,00" → strip currency + thousands dots, drop decimal part.
  const s = String(v).trim().replace(/[^\d,.-]/g, '')
  if (!s) return null
  const noThousands = s.replace(/\./g, '')
  const intPart = noThousands.split(',')[0]
  const n = Number(intPart)
  return Number.isFinite(n) ? n : null
}

export function parseCreditDays(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Math.round(v)
  const m = String(v).match(/(\d+)\s*d/i) // "30 días"
  return m ? Number(m[1]) : null
}

export function normalizeType(
  v: unknown,
): 'requerimiento' | 'emergencia' | 'preventivo' | 'proyecto' | 'otro' {
  const s = String(v ?? '').trim().toLowerCase()
  if (s.includes('emerg')) return 'emergencia'
  if (s.includes('prevent')) return 'preventivo' // incl. "Término preventivo"
  if (s.includes('requer')) return 'requerimiento'
  if (s.includes('proyecto')) return 'proyecto'
  return 'otro'
}

export function normalizeCollectionStatus(
  v: unknown,
): 'sin_oc' | 'pendiente_pago' | 'pagado' {
  const s = String(v ?? '').trim().toUpperCase()
  if (s === 'PAGADO') return 'pagado'
  if (s.startsWith('PENDIENTE')) return 'pendiente_pago'
  return 'sin_oc' // "SIN OC" or empty
}

// Lowercased raw → canonical branch name. All redundant variants merged.
export const BRANCH_ALIASES: Record<string, string> = {
  'huechurana': 'Huechuraba',
  'rotonda': 'Rotonda Atenas',
  'viña': 'Viña del Mar',
  'viña del mar': 'Viña del Mar',
  'quilin': 'Quilín',
  'quilín': 'Quilín',
  'dk la florida': 'La Florida',
  'dk lo barnechea': 'Lo Barnechea',
  'dk lo barnechea ': 'Lo Barnechea',
}

export function normalizeBranchName(v: unknown): string | null {
  if (v == null) return null
  const collapsed = String(v).trim().replace(/\s+/g, ' ')
  if (!collapsed) return null
  const key = collapsed.toLowerCase()
  if (BRANCH_ALIASES[key]) return BRANCH_ALIASES[key]
  // Title-case fallback (handles "ISIDORA", "isidora ", "Manuel Montt").
  return collapsed
    .toLowerCase()
    .replace(/\b([a-záéíóúñ])/g, (c) => c.toUpperCase())
}
