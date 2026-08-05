'use client'

import { expenseClassification, EXPENSE_CLASSIFICATION_LABELS } from '@/lib/expenses/expense-presets'

const CATEGORY_LABELS: Record<string, string> = {
  combustible: 'Combustible',
  estacionamiento: 'Estacionamiento',
  materiales: 'Materiales',
  viatico: 'Viático',
  herramienta: 'Herramienta',
  otro: 'Otro',
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
}

interface ExpenseRow {
  id: string
  date: Date | string
  amount: number
  category: string
  status: string
  description: string | null
  supplier: string | null
  ticketId: string | null
  jobId: string | null
  isGeneral: boolean | null
  technician: { name: string }
  ticket: { ticketCode: string; title: string; client: { name: string } | null } | null
}

// CSV, no PDF — "generar informes de gastos" pedido por el dueño, cubierto
// con lo que ya sabe abrir cualquier planilla (Excel/Sheets) sin construir
// una plantilla de PDF nueva solo para esto. Genera el archivo client-side
// a partir de las filas YA filtradas que la página le pasa — nunca pide de
// nuevo al servidor, exporta exactamente lo que se está viendo.
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function toCsv(expenses: ExpenseRow[]): string {
  const header = ['Fecha', 'Técnico', 'Categoría', 'Monto CLP', 'Ticket', 'Cliente', 'Clasificación', 'Estado', 'Proveedor', 'Descripción']
  const rows = expenses.map((e) => {
    const cls = expenseClassification(e)
    return [
      new Date(e.date).toISOString().slice(0, 10),
      e.technician.name,
      CATEGORY_LABELS[e.category] ?? e.category,
      String(e.amount),
      e.ticket?.ticketCode ?? '',
      e.ticket?.client?.name ?? '',
      EXPENSE_CLASSIFICATION_LABELS[cls] ?? cls,
      STATUS_LABELS[e.status] ?? e.status,
      e.supplier ?? '',
      e.description ?? '',
    ].map(csvEscape).join(',')
  })
  return [header.join(','), ...rows].join('\n')
}

export function ExportExpensesButton({ expenses }: { expenses: ExpenseRow[] }) {
  function download() {
    // BOM al inicio — Excel en Windows (el uso real acá) interpreta UTF-8 sin
    // esto como Latin-1 y rompe los acentos/símbolo de tilde en "Técnico".
    const csv = '﻿' + toCsv(expenses)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gastos-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={expenses.length === 0}
      className="interactive inline-flex min-h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v9M4.5 7.5L8 11l3.5-3.5"/><path d="M2.5 13h11"/></svg>
      Exportar CSV
    </button>
  )
}
