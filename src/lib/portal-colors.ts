// Shared color constants for portal pages.
// Portal uses inline styles exclusively (CSS vars are overridden by Tailwind v4 dark mode).
// These values are intentionally hardcoded — do NOT replace with CSS vars.

export const URGENCY_COLORS: Record<string, string> = {
  emergencia: '#ef4444',
  urgencia:   '#f59e0b',
  no_urgente: '#22c55e',
  preventivo: '#3b82f6',
}

export const TICKET_STATUS_COLORS: Record<string, string> = {
  nuevo:                '#3b82f6',
  en_revision:          '#f59e0b',
  en_ejecucion:         '#f97316',
  esperando_aprobacion: '#8b5cf6',
  resuelto:             '#22c55e',
  cancelado:            '#9ca3af',
  fusionado:            '#6b7280',
}

// Semantic aliases for consistent reuse
export const C = {
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',
  info:    '#3b82f6',
  muted:   '#9ca3af',
} as const
