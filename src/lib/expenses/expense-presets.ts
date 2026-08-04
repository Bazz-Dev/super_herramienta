// Predicados puros del dominio Gastos (informe #14) — mismo patrón que
// src/lib/cashflow/job-presets.ts: nada de acceso a DB acá, solo reglas de
// negocio testeables sin mockear Prisma.

type ExpenseLike = { ticketId: string | null; isGeneral: boolean | null }

export type ExpenseClassification = 'directo' | 'general' | 'sin_clasificar'

// "Directo" siempre gana si hay ticketId — es un hecho, no una opinión. Sin
// ticket, la clasificación depende de una decisión humana explícita
// (isGeneral): true = revisado y confirmado como gasto general de la
// empresa, null = todavía sin revisar (incluye el 100% del histórico
// anterior a este campo — nunca se infiere "general" a la fuerza).
export function expenseClassification(e: ExpenseLike): ExpenseClassification {
  if (e.ticketId) return 'directo'
  if (e.isGeneral === true) return 'general'
  return 'sin_clasificar'
}

export const EXPENSE_CLASSIFICATION_LABELS: Record<ExpenseClassification, string> = {
  directo: 'Directo',
  general: 'General',
  sin_clasificar: 'Sin clasificar',
}

export const EXPENSE_CLASSIFICATION_COLORS: Record<ExpenseClassification, string> = {
  directo: 'bg-blue-100 text-blue-800',
  general: 'bg-gray-100 text-gray-600',
  sin_clasificar: 'bg-amber-100 text-amber-800',
}

// Solo gastos aprobados o ya pagados cuentan como costo confirmado (informe
// #14) — uno "pendiente" es una solicitud, no un costo real todavía; uno
// "rechazado" nunca lo fue. Mismo criterio que la ficha de ticket ya usa
// para su total ("... aprobado").
export function isConfirmedExpense(e: { status: string }): boolean {
  return e.status === 'aprobado' || e.status === 'pagado'
}

export function directExpenseTotal(expenses: { amount: number; status: string }[]): number {
  return expenses.filter(isConfirmedExpense).reduce((s, e) => s + e.amount, 0)
}
