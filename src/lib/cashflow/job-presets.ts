// Predicados de estado calcados del comportamiento real (capa final v11-v13,
// no las capas v8-v12 reemplazadas) de flujo de caja produccion/
// INGEGAR_Control_IngegarONE_UI_Acordeon_2026 (1).html — ver renderDashboard
// (status-strip + reminder-bar) y v11PresetMatch/v11PresetCounts (Reportes).
// Dos sistemas de chips distintos en el prototipo, con reglas distintas —
// no se conflaron en uno solo.

// Una cuota real (informe #12) — su propia OC/factura/pago. Ver
// prisma/schema.prisma `JobInstallment`.
type Installment = {
  netAmount: number | null
  purchaseOrder: string | null
  purchaseOrderStatus?: string | null
  invoiceNumber: string | null
  invoiceDate: Date | null
  invoiceStatus?: string | null
  creditDays: number | null
  paymentDate: Date | null
  paymentAmount: number | null
}

type Job = {
  financialStage: string
  commercialStage: string
  operationalStage: string
  nonBillable: boolean
  netAmount: number | null
  purchaseOrder: string | null
  purchaseOrderStatus?: string | null
  invoiceNumber: string | null
  invoiceDate: Date | null
  invoiceStatus?: string | null
  paymentDate: Date | null
  paymentAmount?: number | null
  executionDate: Date | null
  creditDays: number | null
  technicianId?: string | null
  // Campos "clásicos" — únicos que los 207 trabajos importados llegaron a
  // poblar (financialStage/operationalStage quedaron en su default de
  // schema, 'no_po'/'pending', para el 100% del histórico: nunca hubo un
  // backfill al introducir el sistema de etapas v2). Los predicados abajo
  // los usan como respaldo — no se puede exigir v2 para leer datos reales
  // que solo existen en el esquema clásico.
  status?: string
  collectionStatus?: string
  // Opcional a propósito: la enorme mayoría de los trabajos no tiene cuotas
  // (pago único, los campos de arriba alcanzan). Solo los callers que
  // seleccionan `installments` en su query activan la lógica de cuotas de
  // abajo — todo el resto de la app sigue leyendo los campos planos exacto
  // como antes, sin ningún cambio de comportamiento.
  installments?: Installment[]
}

const DAY = 24 * 60 * 60 * 1000

function daysUntil(due: Date, now: Date): number {
  return Math.floor((due.getTime() - now.getTime()) / DAY)
}

export function installmentBalance(i: Installment): number {
  return (i.netAmount ?? 0) - (i.paymentAmount ?? 0)
}
export function isInstallmentPaid(i: Installment): boolean {
  return i.netAmount != null && installmentBalance(i) <= 0
}
export function installmentDueDate(i: Installment): Date | null {
  if (!i.invoiceDate) return null
  return new Date(i.invoiceDate.getTime() + (i.creditDays ?? 30) * DAY)
}
export function isInstallmentOverdue(i: Installment, now: Date): boolean {
  if (isInstallmentPaid(i) || !i.invoiceDate) return false
  const due = installmentDueDate(i)
  return !!due && daysUntil(due, now) < 0
}
// Resumen para mostrar "saldo total = suma de saldos" (informe #12,
// criterio de aceptación explícito) sin que cada pantalla reimplemente la
// suma.
export function jobInstallmentsSummary(installments: Installment[]) {
  const totalNet = installments.reduce((s, i) => s + (i.netAmount ?? 0), 0)
  const totalPaid = installments.reduce((s, i) => s + (i.paymentAmount ?? 0), 0)
  return {
    count: installments.length,
    totalNet,
    totalPaid,
    balance: totalNet - totalPaid,
    allPaid: installments.length > 0 && installments.every(isInstallmentPaid),
  }
}

export function isPaidJob(j: Job): boolean {
  if (j.installments?.length) return j.installments.every(isInstallmentPaid)
  // Cuando paymentAmount está presente (informe #13), es la señal más
  // precisa disponible — manda sobre paymentDate/financialStage, que solo
  // dicen "hubo un pago" sin decir cuánto. Sin esto, registrar una fecha de
  // pago parcial (sin marcar financialStage='paid') se leía como pago total
  // por el fallback clásico de abajo — bug real encontrado en verificación
  // en vivo de este mismo bloque, no solo hipotético.
  if (j.netAmount != null && j.paymentAmount != null) return j.paymentAmount >= j.netAmount
  // Histórico (paymentAmount nunca seteado) sigue leyendo exactamente igual
  // que antes de que este campo existiera.
  return j.financialStage === 'paid' || j.paymentDate != null || j.collectionStatus === 'pagado'
}
// Pago registrado pero incompleto (informe #13) — distinto de "sin pago" y
// de "pagado". Un trabajo ya pagado nunca cuenta como parcial (se revisa
// isPaidJob primero, mismo orden que isOverdueV2 ya usaba con isPaidJob).
export function isPartiallyPaidJob(j: Job): boolean {
  if (isPaidJob(j)) return false
  if (j.installments?.length) return jobInstallmentsSummary(j.installments).totalPaid > 0
  return (j.paymentAmount ?? 0) > 0
}
// Una OC "anulada" (informe #11) ya no cuenta como OC vigente — pero el
// histórico sin `purchaseOrderStatus` (null, nunca se le asignó un estado)
// se sigue tratando exactamente como antes de que este campo existiera:
// nunca se infiere "anulada" ni "vigente" a la fuerza sobre datos viejos.
export function hasPurchaseOrder(j: Job): boolean {
  if (j.installments?.length) return j.installments.some((i) => !!i.purchaseOrder?.trim() && i.purchaseOrderStatus !== 'anulada')
  return !!j.purchaseOrder?.trim() && j.purchaseOrderStatus !== 'anulada'
}
// Una factura "anulada" (informe #13, mismo criterio que hasPurchaseOrder
// con OC en el informe #11) ya no cuenta como factura vigente — histórico
// sin `invoiceStatus` (null) se sigue tratando exactamente como antes.
export function hasInvoiceInfo(j: Job): boolean {
  if (j.installments?.length) return j.installments.some((i) => (!!i.invoiceNumber?.trim() || i.invoiceDate != null) && i.invoiceStatus !== 'anulada')
  return (!!j.invoiceNumber?.trim() || j.invoiceDate != null) && j.invoiceStatus !== 'anulada'
}
export function isExecutedJob(j: Job): boolean {
  return ['executed', 'client_review', 'closed'].includes(j.operationalStage) || j.executionDate != null || j.status === 'ejecutado'
}
export function isRejectedJob(j: Job): boolean {
  return j.commercialStage === 'rejected' || j.status === 'anulado'
}
// "Por agendar" — nadie puede ejecutar el trabajo todavía porque no tiene
// técnico asignado y tampoco se ejecutó ya (un trabajo ya ejecutado sin
// técnico registrado es un dato histórico incompleto, no algo "por agendar").
export function isPendingSchedule(j: Job): boolean {
  return !j.technicianId && !isExecutedJob(j)
}
// ensureDue: factura + plazo de crédito (30 días por defecto si no hay dato — igual que el prototipo).
export function jobDueDateV2(j: Job): Date | null {
  if (!j.invoiceDate) return null
  return new Date(j.invoiceDate.getTime() + (j.creditDays ?? 30) * DAY)
}
export function isOverdueV2(j: Job, now: Date): boolean {
  if (j.installments?.length) return !j.nonBillable && j.installments.some((i) => isInstallmentOverdue(i, now))
  if (isPaidJob(j) || j.nonBillable || !hasInvoiceInfo(j)) return false
  const due = jobDueDateV2(j)
  return !!due && daysUntil(due, now) < 0
}
export function isDueSoon(j: Job, now: Date): boolean {
  if (j.installments?.length) {
    if (j.nonBillable) return false
    return j.installments.some((i) => {
      if (isInstallmentPaid(i)) return false
      const due = installmentDueDate(i)
      if (!due) return false
      const d = daysUntil(due, now)
      return d >= 0 && d <= 7
    })
  }
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

// Estados visuales de documentos (OC/Factura/OT/Informe) en la edición
// rápida — ver Cambio 4 de la especificación de UX de trabajos. Falta = sin
// número y sin archivo. Registrado = número cargado pero sin archivo
// adjunto. Adjunto = archivo subido directo en el campo (OC/Factura, dueños
// del scalar en Job). Vinculado = el documento existe pero se gestiona en
// otro módulo (OT y Informe viven en el ticket de origen, no en Job).
export type DocState = 'falta' | 'registrado' | 'adjunto' | 'vinculado'

export function ownedDocState(numberValue: string | null | undefined, fileUrl: string | null | undefined): DocState {
  if (fileUrl) return 'adjunto'
  if (numberValue) return 'registrado'
  return 'falta'
}

export function linkedDocState(fileUrl: string | null | undefined): DocState {
  return fileUrl ? 'vinculado' : 'falta'
}

export const DOC_STATE_LABELS: Record<DocState, string> = {
  falta: 'Falta',
  registrado: 'Registrado',
  adjunto: 'Adjunto',
  vinculado: 'Vinculado',
}

export const DOC_STATE_DOT: Record<DocState, string> = {
  falta: 'bg-gray-300',
  registrado: 'bg-amber-400',
  adjunto: 'bg-green-500',
  vinculado: 'bg-blue-500',
}
