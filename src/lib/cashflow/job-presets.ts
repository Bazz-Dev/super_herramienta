// Predicados de estado calcados del comportamiento real (capa final v11-v13,
// no las capas v8-v12 reemplazadas) de flujo de caja produccion/
// INGEGAR_Control_IngegarONE_UI_Acordeon_2026 (1).html — ver renderDashboard
// (status-strip + reminder-bar) y v11PresetMatch/v11PresetCounts (Reportes).
// Dos sistemas de chips distintos en el prototipo, con reglas distintas —
// no se conflaron en uno solo.

type Job = {
  financialStage: string
  commercialStage: string
  operationalStage: string
  nonBillable: boolean
  netAmount: number | null
  purchaseOrder: string | null
  invoiceNumber: string | null
  invoiceDate: Date | null
  paymentDate: Date | null
  executionDate: Date | null
  creditDays: number | null
  // Campos "clásicos" — únicos que los 207 trabajos importados llegaron a
  // poblar (financialStage/operationalStage quedaron en su default de
  // schema, 'no_po'/'pending', para el 100% del histórico: nunca hubo un
  // backfill al introducir el sistema de etapas v2). Los predicados abajo
  // los usan como respaldo — no se puede exigir v2 para leer datos reales
  // que solo existen en el esquema clásico.
  status?: string
  collectionStatus?: string
}

const DAY = 24 * 60 * 60 * 1000

export function isPaidJob(j: Job): boolean {
  return j.financialStage === 'paid' || j.paymentDate != null || j.collectionStatus === 'pagado'
}
export function hasPurchaseOrder(j: Job): boolean {
  return !!j.purchaseOrder?.trim()
}
export function hasInvoiceInfo(j: Job): boolean {
  return !!j.invoiceNumber?.trim() || j.invoiceDate != null
}
export function isExecutedJob(j: Job): boolean {
  return ['executed', 'client_review', 'closed'].includes(j.operationalStage) || j.executionDate != null || j.status === 'ejecutado'
}
export function isRejectedJob(j: Job): boolean {
  return j.commercialStage === 'rejected' || j.status === 'anulado'
}
// ensureDue: factura + plazo de crédito (30 días por defecto si no hay dato — igual que el prototipo).
export function jobDueDateV2(j: Job): Date | null {
  if (!j.invoiceDate) return null
  return new Date(j.invoiceDate.getTime() + (j.creditDays ?? 30) * DAY)
}
function daysUntil(due: Date, now: Date): number {
  return Math.floor((due.getTime() - now.getTime()) / DAY)
}
export function isOverdueV2(j: Job, now: Date): boolean {
  if (isPaidJob(j) || j.nonBillable || !hasInvoiceInfo(j)) return false
  const due = jobDueDateV2(j)
  return !!due && daysUntil(due, now) < 0
}
export function isDueSoon(j: Job, now: Date): boolean {
  if (isPaidJob(j) || j.nonBillable || !hasInvoiceInfo(j)) return false
  const due = jobDueDateV2(j)
  if (!due) return false
  const d = daysUntil(due, now)
  return d >= 0 && d <= 7
}

// --- Vista principal /flujo: status-strip (5) + reminder-bar (3 atajos) ---

export type MainStatus = 'all' | 'paid' | 'pending' | 'no_po' | 'rejected'

export function simpleStatus(j: Job): MainStatus | 'other' {
  if (isRejectedJob(j)) return 'rejected'
  if (isPaidJob(j)) return 'paid'
  if (hasPurchaseOrder(j)) return 'pending'
  if (isExecutedJob(j)) return 'no_po'
  return 'other'
}

export const MAIN_STATUS_CHIPS: { key: MainStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'paid', label: 'Pagadas' },
  { key: 'pending', label: 'Pendientes de pago' },
  { key: 'no_po', label: 'Ejecutadas sin OC' },
  { key: 'rejected', label: 'No aprobadas' },
]

export function matchesMainStatus(j: Job, status: MainStatus | 'overdue' | 'due_soon', now: Date): boolean {
  if (status === 'all') return true
  if (status === 'overdue') return isOverdueV2(j, now) // atajos de "Control de hoy", no chips propios
  if (status === 'due_soon') return isDueSoon(j, now)
  return simpleStatus(j) === status
}

export function mainStatusCounts(jobs: Job[]): Record<MainStatus, number> & { overdue: number; due7: number } {
  return {
    all: jobs.length,
    paid: jobs.filter((j) => simpleStatus(j) === 'paid').length,
    pending: jobs.filter((j) => simpleStatus(j) === 'pending').length,
    no_po: jobs.filter((j) => simpleStatus(j) === 'no_po').length,
    rejected: jobs.filter((j) => simpleStatus(j) === 'rejected').length,
    overdue: jobs.filter((j) => isOverdueV2(j, new Date())).length,
    due7: jobs.filter((j) => isDueSoon(j, new Date())).length,
  }
}

// --- Reportes (/flujo/trabajos): 7 presets, reglas propias distintas del status-strip ---

export type ReportPreset = 'all' | 'overdue' | 'no_po' | 'no_invoice' | 'pending_payment' | 'paid' | 'unvalued'

export function isNoPOJob(j: Job): boolean {
  return !isRejectedJob(j) && !j.nonBillable && isExecutedJob(j) && !hasPurchaseOrder(j)
}
export function isNoInvoiceJob(j: Job): boolean {
  return !isRejectedJob(j) && !j.nonBillable && hasPurchaseOrder(j) && !hasInvoiceInfo(j) &&
    (isExecutedJob(j) || j.operationalStage === 'closed' || j.financialStage === 'to_invoice')
}
export function isUnvaluedJob(j: Job): boolean {
  return !isRejectedJob(j) && !j.nonBillable && (j.netAmount ?? 0) <= 0
}
export function isPendingPaymentJob(j: Job): boolean {
  return !j.nonBillable && hasInvoiceInfo(j) && !isPaidJob(j)
}

export const REPORT_PRESETS: { key: ReportPreset; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'overdue', label: 'Vencidos' },
  { key: 'no_po', label: 'Sin OC' },
  { key: 'no_invoice', label: 'Sin facturar' },
  { key: 'pending_payment', label: 'Pendientes de pago' },
  { key: 'paid', label: 'Pagados' },
  { key: 'unvalued', label: 'Sin valor' },
]

export function matchesReportPreset(j: Job, preset: ReportPreset, now: Date): boolean {
  switch (preset) {
    case 'all': return true
    case 'overdue': return isOverdueV2(j, now)
    case 'no_po': return isNoPOJob(j)
    case 'no_invoice': return isNoInvoiceJob(j)
    case 'pending_payment': return isPendingPaymentJob(j)
    case 'paid': return isPaidJob(j)
    case 'unvalued': return isUnvaluedJob(j)
  }
}

export function reportPresetCounts(jobs: Job[]): Record<ReportPreset, number> {
  const now = new Date()
  return {
    all: jobs.length,
    overdue: jobs.filter((j) => matchesReportPreset(j, 'overdue', now)).length,
    no_po: jobs.filter((j) => matchesReportPreset(j, 'no_po', now)).length,
    no_invoice: jobs.filter((j) => matchesReportPreset(j, 'no_invoice', now)).length,
    pending_payment: jobs.filter((j) => matchesReportPreset(j, 'pending_payment', now)).length,
    paid: jobs.filter((j) => matchesReportPreset(j, 'paid', now)).length,
    unvalued: jobs.filter((j) => matchesReportPreset(j, 'unvalued', now)).length,
  }
}
