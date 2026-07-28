'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FilePreviewButton } from '@/components/ui/file-preview-modal'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/table'
import { buttonClass } from '@/components/ui/button'

type Row = {
  id: string
  source: 'technician' | 'company' | 'ticket'
  type: string
  typeLabel: string
  label: string | null
  fileUrl: string
  uploadedAt: Date
  expiryDate: Date | null
  ownerId: string
  ownerName: string
}
type IncompleteTechnician = { id: string; name: string; missing: string[] }
type Owner = { id: string; name: string }

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function rowKey(r: Row) {
  return `${r.source}:${r.id}`
}
function displayName(r: Row) {
  return r.label || r.typeLabel
}

export function DocumentacionView({
  rows, incompleteTechnicians, owners,
}: {
  rows: Row[]
  incompleteTechnicians: IncompleteTechnician[]
  owners: Owner[]
}) {
  const [q, setQ] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [onlyIncomplete, setOnlyIncomplete] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  const incompleteIds = useMemo(() => new Set(incompleteTechnicians.map((t) => t.id)), [incompleteTechnicians])

  const typeOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rows) seen.set(`${r.source}:${r.type}`, r.typeLabel)
    return [...seen.entries()]
  }, [rows])

  const filtered = useMemo(() => rows.filter((r) => {
    if (ownerFilter && r.ownerId !== ownerFilter) return false
    if (typeFilter && `${r.source}:${r.type}` !== typeFilter) return false
    if (onlyIncomplete && !incompleteIds.has(r.ownerId)) return false
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      if (!(displayName(r).toLowerCase().includes(s) || r.ownerName.toLowerCase().includes(s) || r.typeLabel.toLowerCase().includes(s))) return false
    }
    return true
  }), [rows, ownerFilter, typeFilter, onlyIncomplete, q, incompleteIds])

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(rowKey(r)))

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) filtered.forEach((r) => next.delete(rowKey(r)))
      else filtered.forEach((r) => next.add(rowKey(r)))
      return next
    })
  }

  async function downloadSelected() {
    const refs = [...selected].map((k) => {
      const [source, id] = k.split(':')
      return { type: source as 'technician' | 'company', id }
    })
    if (refs.length === 0) return
    setDownloading(true)
    try {
      const res = await fetch('/api/documents/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refs }),
      })
      if (!res.ok) { alert('No se pudo generar el ZIP.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Documentos.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      {incompleteTechnicians.length > 0 && (
        <div className="mb-5 rounded-xl border border-warn-100 bg-warn-50 p-4">
          <p className="mb-2 text-xs font-semibold text-warn-700">
            {incompleteTechnicians.length} técnico{incompleteTechnicians.length > 1 ? 's' : ''} con documentación incompleta
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {incompleteTechnicians.map((t) => (
              <li key={t.id}>
                <Link href={`/recursos/tecnicos/${t.id}`} className="font-medium text-warn-700 hover:underline">{t.name}</Link>
                <span className="text-gray-500"> — falta {t.missing.join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, técnico o tipo…"
          className="w-full max-w-xs rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
        />
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm">
          <option value="">Todos los dueños</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          {typeOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={onlyIncomplete} onChange={(e) => setOnlyIncomplete(e.target.checked)} className="h-4 w-4 accent-brand" />
          Solo documentación incompleta
        </label>
        <span className="ml-auto text-xs text-gray-400">{filtered.length} documento{filtered.length === 1 ? '' : 's'}</span>
      </div>

      <div className="mb-2 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={filtered.length === 0} className="h-4 w-4 accent-brand" />
          Seleccionar todo lo visible
        </label>
        <button
          type="button"
          disabled={selected.size === 0 || downloading}
          onClick={downloadSelected}
          className={buttonClass('secondary', 'sm')}
        >
          {downloading ? 'Generando ZIP…' : `Descargar ZIP${selected.size > 0 ? ` (${selected.size})` : ''}`}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Sin documentos" description="No hay documentos que coincidan con los filtros." />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th className="w-8" />
              <Th>Documento</Th>
              <Th>Tipo</Th>
              <Th>Dueño</Th>
              <Th>Fecha</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {filtered.map((r) => {
              const key = rowKey(r)
              return (
                <Tr key={key}>
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggleRow(key)}
                      aria-label={`Incluir ${displayName(r)} en el ZIP`}
                      className="h-4 w-4 cursor-pointer accent-brand"
                    />
                  </Td>
                  <Td className="font-medium text-ink">{displayName(r)}</Td>
                  <Td><Badge tone="neutral">{r.typeLabel}</Badge></Td>
                  <Td>
                    {r.source === 'company' && r.ownerName}
                    {r.source === 'technician' && <Link href={`/recursos/tecnicos/${r.ownerId}`} className="hover:underline">{r.ownerName}</Link>}
                    {r.source === 'ticket' && <Link href={`/tickets/${r.ownerId}`} className="hover:underline">{r.ownerName}</Link>}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-gray-500">{formatDate(r.uploadedAt)}</Td>
                  <Td>
                    <FilePreviewButton
                      fileUrl={r.fileUrl}
                      type={r.source}
                      name={displayName(r)}
                      meta={[
                        { label: 'Tipo', value: r.typeLabel },
                        { label: 'Dueño', value: r.ownerName },
                        { label: 'Subido', value: formatDate(r.uploadedAt) },
                        ...(r.expiryDate ? [{ label: 'Vence', value: formatDate(r.expiryDate) }] : []),
                      ]}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    />
                  </Td>
                </Tr>
              )
            })}
          </TBody>
        </Table>
      )}
    </div>
  )
}
