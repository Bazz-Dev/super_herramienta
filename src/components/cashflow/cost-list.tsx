'use client'

import { useTransition } from 'react'
import { Field, TextInput, Select, Button } from '@/components/quotes/ui'
import { COST_CATEGORY_LABELS } from '@/lib/cashflow/labels'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'
import { addCost, deleteCost } from '@/app/(app)/flujo/actions'

type Cost = {
  id: string
  category: string
  description: string | null
  amount: number
  date: Date | null
  supplier: string | null
  documentRef: string | null
}

export function CostList({
  costs,
  jobId,
  netAmount,
}: {
  costs: Cost[]
  jobId: string
  netAmount: number | null
}) {
  const [pending, startTransition] = useTransition()

  const totalCosts = costs.reduce((s, c) => s + c.amount, 0)
  const margin = netAmount != null ? netAmount - totalCosts : null

  function handleDelete(costId: string) {
    if (window.confirm('¿Eliminar este costo?')) {
      startTransition(() => deleteCost(costId, jobId))
    }
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-base font-semibold text-ink">Costos del trabajo</h2>

      {/* Costs table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {costs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            Aún no hay costos registrados.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Categoría</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Proveedor</th>
                <th className="px-4 py-2.5 font-medium text-right">Monto</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 text-gray-700">
                    {COST_CATEGORY_LABELS[c.category] ?? c.category}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.description ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {c.date ? toDateInput(c.date) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{c.supplier ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-ink">
                    {clp(c.amount)}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(c.id)}
                      aria-label="Eliminar costo"
                      title="Eliminar costo"
                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-gray-300 text-gray-400 transition-colors duration-150 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Running margin */}
      <div className="mt-3 flex items-center justify-end gap-4 text-sm">
        <span className="text-gray-500">Total costos: <span className="tabular-nums font-medium text-ink">{clp(totalCosts)}</span></span>
        {margin != null && (
          <span className={`font-semibold tabular-nums ${margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            Margen: {clp(margin)}
          </span>
        )}
      </div>

      {/* Add cost inline form */}
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-600">Agregar costo</h3>
        <form action={addCost} className="flex flex-col gap-3">
          <input type="hidden" name="jobId" value={jobId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Categoría">
              <Select name="category" defaultValue="materiales">
                {Object.entries(COST_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Descripción">
              <TextInput name="description" placeholder="Detalle del costo" />
            </Field>
            <Field label="Monto (CLP) *">
              <TextInput name="amount" type="number" min={0} required placeholder="0" />
            </Field>
            <Field label="Fecha">
              <TextInput name="date" type="date" />
            </Field>
            <Field label="Proveedor">
              <TextInput name="supplier" placeholder="Nombre del proveedor" />
            </Field>
            <Field label="Ref. documento">
              <TextInput name="documentRef" placeholder="N° boleta, factura…" />
            </Field>
          </div>
          <div>
            <Button type="submit">+ Agregar costo</Button>
          </div>
        </form>
      </div>
    </section>
  )
}
