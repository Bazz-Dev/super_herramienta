'use client'

import type { CustomColumn, QuoteData, QuoteItem } from '@/lib/quotes/types'
import { formatMoney } from '@/lib/quotes/format'
import { AddButton, IconButton, NumberInput, TextInput } from './ui'

function newColumnId() {
  return `col_${Math.random().toString(36).slice(2, 8)}`
}

export function ItemsEditor({
  items,
  columns,
  currency,
  onItemsChange,
  onColumnsChange,
}: {
  items: QuoteItem[]
  columns: CustomColumn[]
  currency: QuoteData['currency']
  onItemsChange: (next: QuoteItem[]) => void
  onColumnsChange: (next: CustomColumn[]) => void
}) {
  function updateItem(i: number, patch: Partial<QuoteItem>) {
    onItemsChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }
  function updateCustom(i: number, colId: string, value: string) {
    onItemsChange(
      items.map((it, idx) => (idx === i ? { ...it, custom: { ...it.custom, [colId]: value } } : it)),
    )
  }

  function addColumn() {
    onColumnsChange([...columns, { id: newColumnId(), label: 'Nueva columna' }])
  }
  function renameColumn(id: string, label: string) {
    onColumnsChange(columns.map((c) => (c.id === id ? { ...c, label } : c)))
  }
  function removeColumn(id: string) {
    onColumnsChange(columns.filter((c) => c.id !== id))
  }

  function addRow() {
    onItemsChange([...items, { description: '', quantity: 1, unitPrice: 0, custom: {} }])
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Custom columns manager */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Columnas extra:</span>
        {columns.map((c) => (
          <span key={c.id} className="flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-1">
            <input
              value={c.label}
              onChange={(e) => renameColumn(c.id, e.target.value)}
              className="w-24 bg-transparent text-xs outline-none"
            />
            <button
              type="button"
              onClick={() => removeColumn(c.id)}
              className="text-gray-400 hover:text-red-500"
              aria-label="Quitar columna"
            >
              ✕
            </button>
          </span>
        ))}
        <AddButton onClick={addColumn}>+ Columna</AddButton>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
              <th className="px-2 py-1 font-medium">Descripción</th>
              {columns.map((c) => (
                <th key={c.id} className="px-2 py-1 font-medium">{c.label || '—'}</th>
              ))}
              <th className="px-2 py-1 text-right font-medium">Cant.</th>
              <th className="px-2 py-1 text-right font-medium">Unitario</th>
              <th className="px-2 py-1 text-right font-medium">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-t border-gray-100 align-top">
                <td className="px-2 py-1.5" style={{ minWidth: 180 }}>
                  <TextInput
                    value={item.description}
                    placeholder="Descripción"
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                  />
                  <TextInput
                    value={item.detail ?? ''}
                    placeholder="Detalle (opcional)"
                    className="mt-1 text-xs"
                    onChange={(e) => updateItem(i, { detail: e.target.value })}
                  />
                </td>
                {columns.map((c) => (
                  <td key={c.id} className="px-2 py-1.5" style={{ minWidth: 90 }}>
                    <TextInput
                      value={item.custom?.[c.id] ?? ''}
                      onChange={(e) => updateCustom(i, c.id, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5" style={{ width: 80 }}>
                  <NumberInput value={item.quantity} min={0} step="any" onValue={(n) => updateItem(i, { quantity: n })} />
                </td>
                <td className="px-2 py-1.5" style={{ width: 120 }}>
                  <NumberInput value={item.unitPrice} min={0} step="any" onValue={(n) => updateItem(i, { unitPrice: n })} />
                </td>
                <td className="px-2 py-1.5 text-right text-xs font-medium whitespace-nowrap" style={{ width: 110 }}>
                  {formatMoney(item.quantity * item.unitPrice, currency)}
                </td>
                <td className="px-1 py-1.5">
                  <IconButton onClick={() => onItemsChange(items.filter((_, idx) => idx !== i))} aria-label="Eliminar fila">
                    ✕
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <AddButton onClick={addRow}>+ Agregar ítem</AddButton>
      </div>
    </div>
  )
}
