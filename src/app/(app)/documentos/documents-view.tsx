'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'

interface Doc {
  id: string
  title: string
  type: string
  createdAt: string
  createdBy: { name: string } | null
}

interface ClientFolder {
  id: string
  name: string
  docs: Doc[]
}

const TYPE_BADGE: Record<string, string> = {
  propuesta: 'bg-blue-50 text-blue-700 border border-blue-200',
  informe:   'bg-amber-50 text-amber-700 border border-amber-200',
  otro:      'bg-gray-100 text-gray-600 border border-gray-200',
}
const TYPE_LABEL: Record<string, string> = {
  propuesta: 'Propuesta',
  informe:   'Informe',
  otro:      'Otro',
}

function relDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DownloadPdfButton({ docId, docType, title }: { docId: string; docType: string; title: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  async function download() {
    setState('loading')
    try {
      const res = await fetch(`/api/client-documents?id=${docId}`)
      if (!res.ok) throw new Error('No se pudo cargar el documento')
      const { doc } = await res.json()
      if (!doc.dataJson) throw new Error('Sin datos guardados')

      const data = JSON.parse(doc.dataJson)
      const apiPath = docType === 'propuesta' ? '/api/quotes/generate' : '/api/reports/generate'
      const pdfRes = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })
      if (!pdfRes.ok) throw new Error('Error al generar PDF')

      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setState('idle')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  return (
    <button
      onClick={download}
      disabled={state === 'loading'}
      className="interactive flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
      title="Descargar como PDF"
    >
      {state === 'loading' ? (
        <><Spinner size={12} /><span className="text-gray-400">Generando…</span></>
      ) : state === 'error' ? (
        <span className="text-red-500">Error</span>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 1v7M3 6l3 3 3-3M1 9.5v1a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-1"/>
          </svg>
          PDF
        </>
      )}
    </button>
  )
}

function DeleteDocButton({ docId, onDeleted }: { docId: string; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()

  function doDelete() {
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      await fetch(`/api/client-documents?id=${docId}`, { method: 'DELETE' })
      onDeleted()
    })
  }

  return (
    <button
      onClick={doDelete}
      disabled={isPending}
      className="flex min-h-11 items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs font-semibold text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
      title="Eliminar"
    >
      {isPending ? <Spinner size={11} /> : (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 3h8M4 3V2h3v1M4.5 5v3M6.5 5v3M2 3l.75 6.5h6.5L10 3"/>
        </svg>
      )}
    </button>
  )
}

export function DocumentsView({ clientFolders: initial }: { clientFolders: ClientFolder[] }) {
  const [folders, setFolders] = useState(initial)
  const [openFolder, setOpenFolder] = useState<string | null>(
    initial.length === 1 ? initial[0].id : null
  )
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const router = useRouter()

  function removeDoc(docId: string) {
    setFolders(prev =>
      prev.map(f => ({ ...f, docs: f.docs.filter(d => d.id !== docId) }))
         .filter(f => f.docs.length > 0)
    )
  }

  const filteredFolders = folders
    .map(f => ({
      ...f,
      docs: f.docs.filter(d => {
        if (filterType !== 'all' && d.type !== filterType) return false
        if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !f.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      }),
    }))
    .filter(f => f.docs.length > 0)

  if (folders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
        <svg className="mx-auto mb-4 text-gray-300" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8h13l4 4h13a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V10a2 2 0 012-2z"/>
        </svg>
        <p className="text-sm font-medium text-gray-400">Sin documentos guardados</p>
        <p className="mt-1 text-xs text-gray-400">
          Usa el botón <span className="font-semibold">Guardar en cliente</span> en el Cotizador o Informe Técnico
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar documento o cliente…"
          className="flex-1 min-w-[200px] rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <div className="flex gap-1">
          {['all', 'propuesta', 'informe'].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`interactive rounded-lg px-3 py-2.5 min-h-11 text-xs font-semibold transition-colors ${filterType === t ? 'bg-brand text-ink' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {t === 'all' ? 'Todos' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {filteredFolders.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">Sin resultados para esta búsqueda.</p>
      )}

      <div className="flex flex-col gap-3">
        {filteredFolders.map(folder => (
          <div key={folder.id} className="rounded-xl border border-gray-200 overflow-hidden">
            {/* Folder header */}
            <button
              onClick={() => setOpenFolder(v => v === folder.id ? null : folder.id)}
              className="interactive flex w-full items-center justify-between px-5 py-3.5 min-h-11 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="#f5b100" stroke="#d4900e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4a1 1 0 011-1h4l2 2h4a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V4z"/>
                </svg>
                <span className="font-semibold text-sm text-gray-800">{folder.name}</span>
                <span className="text-xs text-gray-400">{folder.docs.length} doc{folder.docs.length !== 1 ? 's' : ''}</span>
              </div>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                className={`transition-transform text-gray-400 ${openFolder === folder.id ? 'rotate-180' : ''}`}
              >
                <path d="M3 5l4 4 4-4"/>
              </svg>
            </button>

            {/* Document list */}
            {openFolder === folder.id && (
              <div className="divide-y divide-gray-100">
                {folder.docs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 2H4a1 1 0 00-1 1v8a1 1 0 001 1h6a1 1 0 001-1V5L8 2z"/>
                        <path d="M8 2v3h3M4.5 8h5M4.5 10.5h3"/>
                      </svg>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {relDate(doc.createdAt)}
                          {doc.createdBy && <span> · {doc.createdBy.name}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[doc.type] ?? TYPE_BADGE.otro}`}>
                        {TYPE_LABEL[doc.type] ?? doc.type}
                      </span>
                      {/* Edit in editor */}
                      <a
                        href={`/${doc.type === 'propuesta' ? 'cotizador' : 'informe'}?docId=${doc.id}`}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Editar online"
                      >
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7.5 1.5l2 2-5 5H2.5v-2l5-5z"/>
                        </svg>
                        Editar
                      </a>
                      {/* Download PDF on-demand */}
                      <DownloadPdfButton docId={doc.id} docType={doc.type} title={doc.title} />
                      {/* Delete */}
                      <DeleteDocButton docId={doc.id} onDeleted={() => removeDoc(doc.id)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
