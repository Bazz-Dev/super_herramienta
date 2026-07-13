import type { ProposalStatus } from '@/generated/prisma/enums'

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  borrador:  'Borrador',
  enviada:   'Enviada',
  vista:     'Vista',
  aceptada:  'Aceptada',
  rechazada: 'Rechazada',
  perdida:   'Perdida',
}

export const PROPOSAL_STATUS_COLORS: Record<ProposalStatus, { bg: string; text: string; border: string }> = {
  borrador:  { bg: '#f1f5f9', text: '#475569',  border: '#cbd5e1' },
  enviada:   { bg: '#eff6ff', text: '#1d4ed8',  border: '#93c5fd' },
  vista:     { bg: '#f5f3ff', text: '#7c3aed',  border: '#c4b5fd' },
  aceptada:  { bg: '#f0fdf4', text: '#15803d',  border: '#86efac' },
  rechazada: { bg: '#fef2f2', text: '#b91c1c',  border: '#fca5a5' },
  perdida:   { bg: '#f9fafb', text: '#6b7280',  border: '#d1d5db' },
}

export const PROPOSAL_STATUS_ORDER: ProposalStatus[] = [
  'borrador', 'enviada', 'vista', 'aceptada', 'rechazada', 'perdida',
]

export function formatCLP(amount: number): string {
  return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}
