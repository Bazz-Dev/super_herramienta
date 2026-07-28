import type { ProposalStatus } from '@/generated/prisma/enums'
import type { BadgeTone } from '@/components/ui/badge'

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

// Tailwind-classed equivalent of PROPOSAL_STATUS_COLORS, for consumers using
// the <Badge> primitive (design-system foundation pass) instead of raw
// style={{background: hex}} — kept PROPOSAL_STATUS_COLORS above untouched
// since documents-view.tsx reads its exact {bg,text,border} hex shape.
// "vista" has no ok/warn/danger/info equivalent (it's not an outcome, it's a
// pipeline stage) — categorical purple via className, same rule as any other
// non-semantic status color in the app (kanban columns, contract types).
export const PROPOSAL_STATUS_BADGE: Record<ProposalStatus, { tone?: BadgeTone; className?: string }> = {
  borrador:  { tone: 'neutral' },
  enviada:   { tone: 'info' },
  vista:     { className: 'bg-purple-100 text-purple-700' },
  aceptada:  { tone: 'ok' },
  rechazada: { tone: 'danger' },
  perdida:   { tone: 'neutral' },
}

// Card accent (top stripe) per status, for the <Card accent> prop — same
// semantic mapping as PROPOSAL_STATUS_BADGE. "vista"/"perdida"/"borrador"
// have no accent (Card's 5 tones don't include a neutral/purple option;
// forcing one would misrepresent the status, so those render with no stripe).
export const PROPOSAL_STATUS_ACCENT: Partial<Record<ProposalStatus, 'ok' | 'warn' | 'danger' | 'info'>> = {
  enviada:   'info',
  aceptada:  'ok',
  rechazada: 'danger',
}

export function formatCLP(amount: number): string {
  return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}
