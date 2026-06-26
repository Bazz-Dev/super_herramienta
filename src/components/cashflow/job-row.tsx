'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CollectionChip } from './collection-chip'
import { JOB_TYPE_LABELS, COST_CATEGORY_LABELS } from '@/lib/cashflow/labels'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'

type Cost = { id: string; category: string; amount: number; supplier: string | null; documentRef: string | null }
type Job = {
  id: string
  description: string | null
  type: string
  executionDate: Date | null
  netAmount: number | null
  collectionStatus: string
  branch: { name: string } | null
  client: { id: string; name: string }
  costs: Cost[]
}

export function JobRow({ job, showClient }: { job: Job; showClient: boolean }) {
  const [open, setOpen] = useState(false)
  const hasCosts = job.costs.length > 0
  const totalCosts = job.costs.reduce((s, c) => s + c.amount, 0)
  const margin = (job.netAmount ?? 0) - totalCosts

  return (
    <>
      <tr
        className={`border-b border-gray-100 transition-colors last:border-0 ${
          open ? 'bg-amber-50/30' : 'hover:bg-gray-50/60'
        }`}
      >
        <td className="px-4 py-2.5 text-gray-500">
          {job.executionDate ? toDateInput(job.executionDate) : '—'}
        </td>
        {showClient && (
          <td className="px-4 py-2.5 text-gray-600">{job.client.name}</td>
        )}
        <td className="px-4 py-2.5 text-gray-600">{job.branch?.name ?? '—'}</td>
        <td className="px-4 py-2.5 font-medium text-ink">
          <Link
            href={`/flujo/trabajos/${job.id}`}
            className="hover:text-brand-600 hover:underline"
          >
            {job.description}
          </Link>
        </td>
        <td className="px-4 py-2.5 text-gray-600">
          {JOB_TYPE_LABELS[job.type] ?? job.type}
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
          {clp(job.netAmount)}
        </td>
        <td className="px-4 py-2.5">
          <CollectionChip status={job.collectionStatus} />
        </td>
        <td className="px-2 py-2.5">
          <button
            onClick={() => setOpen((v) => !v)}
            className={`rounded p-1 text-gray-400 transition-colors ${
              hasCosts ? 'hover:text-brand' : 'opacity-30 cursor-default'
            }`}
            title={hasCosts ? 'Ver costos' : 'Sin costos registrados'}
            disabled={!hasCosts}
          >
            <svg
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </td>
      </tr>

      {open && hasCosts && (
        <tr className="border-b border-gray-100 bg-amber-50/20">
          <td colSpan={showClient ? 8 : 7} className="px-4 py-3">
            <div className="rounded-lg border border-amber-100 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Costos registrados
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="pb-1 pr-4 font-medium">Categoría</th>
                    <th className="pb-1 pr-4 font-medium">Proveedor</th>
                    <th className="pb-1 pr-4 font-medium">Ref. doc.</th>
                    <th className="pb-1 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {job.costs.map((c) => (
                    <tr key={c.id} className="border-t border-gray-50">
                      <td className="py-1 pr-4 text-gray-600">
                        {COST_CATEGORY_LABELS[c.category] ?? c.category}
                      </td>
                      <td className="py-1 pr-4 text-gray-500">{c.supplier ?? '—'}</td>
                      <td className="py-1 pr-4 text-gray-500">{c.documentRef ?? '—'}</td>
                      <td className="py-1 text-right tabular-nums text-gray-700">{clp(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="pt-1.5 text-xs font-semibold text-gray-500">
                      Total costos · Margen
                    </td>
                    <td className="pt-1.5 text-right font-semibold tabular-nums">
                      <span className="text-gray-700">{clp(totalCosts)}</span>
                      <span className={`ml-2 ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ({clp(margin)})
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
