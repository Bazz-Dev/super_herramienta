'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'
import { renderQuoteHTML } from '@/lib/quotes/template'
import { renderReportHTML } from '@/lib/reports/template'
import { addToPipeline } from '@/lib/pipeline/actions'
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS } from '@/lib/pipeline/labels'
import type { ProposalStatus } from '@/generated/prisma/enums'

interface Doc {
  id: string
  title: string
  type: string
  createdAt: string
  createdBy: { name: string } | null
  proposalStatus: ProposalStatus | null
  proposalAmount: number | null
}

interface ClientFolder {
  id: string
  name: string
  docs: Doc[]
}

// ─── Type config ─────────────────────────────────────────────────────────────

const TYPE_CFG: Record<string, { label: string; bg: string; icon: string; badge: string }> = {
  propuesta: {
    label: 'Propuesta',
    bg: 'bg-blue-50',
    icon: '#3b82f6',
    badge: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  informe: {
    label: 'Informe',
    bg: 'bg-amber-50',
    icon: '#f59e0b',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  otro: {
    label: 'Otro',
    bg: 'bg-gray-50',
    icon: '#9ca3af',
    badge: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
}

function cfg(type: string) {
  return TYPE_CFG[type] ?? TYPE_CFG.otro
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relDate(iso: string) {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const d = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(iso)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function safeFilename(title: string) {
  return title.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().replace(/\s+/g, '-') || 'documento'
}

// ─── Doc type icon ─────────────────────────────────────────────────────────────

function DocIcon({ type, size = 32 }: { type: string; size?: number }) {
  const color = cfg(type).icon
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="4" y="2" width="18" height="24" rx="2" fill={color} opacity="0.15" />
      <path d="M4 4a2 2 0 012-2h12l6 6v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      <path d="M18 2v6h6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <path d="M9 13h14M9 17h10M9 21h7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function FolderIcon({ size = 18, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={filled ? '#f5b100' : 'none'} stroke={filled ? '#d4900e' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6a1 1 0 011-1h4.5l2 2H16a1 1 0 011 1v7a1 1 0 01-1 1H4a1 1 0 01-1-1V6z"/>
    </svg>
  )
}

// ─── Download PDF button ──────────────────────────────────────────────────────

type DlState = 'idle' | 'fetching' | 'generating' | 'error'

function DownloadPdfButton({ docId, docType, title }: { docId: string; docType: string; title: string }) {
  const [state, setState] = useState<DlState>('idle')
  const [errMsg, setErrMsg] = useState('')

  async function download(e: React.MouseEvent) {
    e.stopPropagation()
    if (state !== 'idle') return
    setState('fetching')
    setErrMsg('')
    try {
      // Step 1: load stored JSON
      const res = await fetch(`/api/client-documents?id=${docId}`)
      if (!res.ok) throw new Error(`Error ${res.status} al cargar documento`)
      const response = await res.json()
      // API returns both { doc: { dataJson }, dataJson } — try both shapes
      const rawJson: string | null = response.dataJson ?? response.doc?.dataJson ?? null
      if (!rawJson) throw new Error('Este documento no tiene datos guardados')

      const data = JSON.parse(rawJson)

      // Step 2: generate PDF — send data directly (same shape as the generator)
      setState('generating')
      const apiPath = docType === 'propuesta' ? '/api/quotes/generate' : '/api/reports/generate'
      const pdfRes = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),  // ← send data directly, NOT { data }
      })
      if (!pdfRes.ok) {
        const errBody = await pdfRes.json().catch(() => ({}))
        throw new Error(errBody.detail ?? errBody.error ?? `Error ${pdfRes.status} generando PDF`)
      }

      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeFilename(title)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setState('idle')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[DownloadPdf]', err)
      setErrMsg(msg)
      setState('error')
      setTimeout(() => setState('idle'), 4_000)
    }
  }

  if (state === 'error') {
    return (
      <button
        onClick={e => { e.stopPropagation(); setState('idle') }}
        className="flex min-h-9 items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
        title={errMsg}
      >
        ✕ Error
      </button>
    )
  }

  return (
    <button
      onClick={download}
      disabled={state !== 'idle'}
      className="flex min-h-9 items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
      title="Descargar como PDF"
    >
      {state === 'fetching' || state === 'generating' ? (
        <><Spinner size={12} /><span className="text-gray-400">{state === 'fetching' ? 'Cargando…' : 'Generando…'}</span></>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 1v7M3 6l3 3 3-3M1 9.5v1a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-1"/>
          </svg>
          PDF
        </>
      )}
    </button>
  )
}

// ─── Document card ────────────────────────────────────────────────────────────

function DocCard({
  doc,
  onPreview,
  onDeleted,
}: {
  doc: Doc
  onPreview: (id: string, title: string, type: string) => void
  onDeleted: (id: string) => void
}) {
  const [hovering, setHovering] = useState(false)
  const [delPending, startDel] = useTransition()
  const [pipelinePending, startPipeline] = useTransition()
  const router = useRouter()
  const c = cfg(doc.type)

  function doDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return
    startDel(async () => {
      await fetch(`/api/client-documents?id=${doc.id}`, { method: 'DELETE' })
      onDeleted(doc.id)
    })
  }

  function doAddPipeline(e: React.MouseEvent) {
    e.stopPropagation()
    startPipeline(async () => {
      await addToPipeline(doc.id)
      router.refresh()
    })
  }

  const editorHref = `/${doc.type === 'propuesta' ? 'cotizador' : 'informe'}?docId=${doc.id}`
  const pStatus = doc.proposalStatus
  const pColors = pStatus ? PROPOSAL_STATUS_COLORS[pStatus] : null

  return (
    <div
      className="group relative flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => onPreview(doc.id, doc.title, doc.type)}
    >
      {/* Card header — colored by type */}
      <div className={`flex items-center justify-center py-7 ${c.bg}`}>
        <DocIcon type={doc.type} size={40} />
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-1.5 p-3.5">
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">{doc.title}</p>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.badge}`}>
            {c.label}
          </span>
          <span className="truncate text-[11px] text-gray-400">{relDate(doc.createdAt)}</span>
        </div>
        {/* Pipeline status badge */}
        {pStatus && pColors && (
          <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '10px', background: pColors.bg, color: pColors.text, border: `1px solid ${pColors.border}`, display: 'inline-block', width: 'fit-content' }}>
            Pipeline: {PROPOSAL_STATUS_LABELS[pStatus]}
          </span>
        )}
        {doc.createdBy && (
          <p className="text-[11px] text-gray-400 truncate">{doc.createdBy.name}</p>
        )}
      </div>

      {/* Hover action overlay */}
      {hovering && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/60 p-3"
          onClick={e => e.stopPropagation()}
        >
          <a
            href={editorHref}
            onClick={e => e.stopPropagation()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 1.5l2.5 2.5-6 6H2v-2.5l6-6z"/>
            </svg>
            Editar
          </a>
          <button
            onClick={e => { e.stopPropagation(); onPreview(doc.id, doc.title, doc.type) }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            Vista previa
          </button>
          {/* Add to pipeline (propuestas only) */}
          {doc.type === 'propuesta' && !pStatus && (
            <button
              onClick={doAddPipeline}
              disabled={pipelinePending}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {pipelinePending ? <Spinner size={11} /> : '+ Agregar al pipeline'}
            </button>
          )}
          {doc.type === 'propuesta' && pStatus && (
            <a href="/pipeline" onClick={e => e.stopPropagation()}
              className="flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors"
              style={{ background: PROPOSAL_STATUS_COLORS[pStatus].text }}>
              Ver en pipeline →
            </a>
          )}
          <div className="flex w-full gap-2">
            <div className="flex-1">
              <DownloadPdfButton docId={doc.id} docType={doc.type} title={doc.title} />
            </div>
            <button
              onClick={doDelete}
              disabled={delPending}
              className="flex min-h-9 items-center justify-center rounded-lg border border-transparent px-2.5 py-1.5 text-xs text-gray-400 bg-white/80 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
              title="Eliminar"
            >
              {delPending ? <Spinner size={11} /> : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M1.5 3h9M4 3V2h4v1M5 5v4M7 5v4M2 3l.75 7h6.5L10 3"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function DocumentsView({ clientFolders: initial }: { clientFolders: ClientFolder[] }) {
  const [folders, setFolders] = useState(initial)
  const [activeClientId, setActiveClientId] = useState<string | null>(
    initial.length === 1 ? initial[0].id : (initial[0]?.id ?? null)
  )
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [preview, setPreview] = useState<{ html: string; title: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [preview])

  const handlePreview = useCallback(async (docId: string, docTitle: string, docType: string) => {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/client-documents?id=${docId}`)
      if (!res.ok) return
      const response = await res.json()
      const rawJson: string | null = response.dataJson ?? response.doc?.dataJson ?? null
      if (!rawJson) return
      const json = JSON.parse(rawJson)
      const html = docType === 'informe' ? renderReportHTML(json) : renderQuoteHTML(json)
      setPreview({ html, title: docTitle })
    } catch {
      // preview is optional, fail silently
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  function removeDoc(docId: string) {
    setFolders(prev =>
      prev.map(f => ({ ...f, docs: f.docs.filter(d => d.id !== docId) }))
          .filter(f => f.docs.length > 0)
    )
    // If active folder is now empty, select first remaining
    setFolders(prev => {
      const still = prev.find(f => f.id === activeClientId)
      if (!still) setActiveClientId(prev[0]?.id ?? null)
      return prev
    })
  }

  const activeFolder = folders.find(f => f.id === activeClientId)
  const visibleDocs = (activeFolder?.docs ?? []).filter(d => {
    if (filterType !== 'all' && d.type !== filterType) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (folders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-20 text-center">
        <FolderIcon size={48} />
        <p className="mt-4 text-sm font-semibold text-gray-400">Sin documentos guardados</p>
        <p className="mt-1 text-xs text-gray-400">
          Usa <span className="font-semibold">Guardar en cliente</span> en el Cotizador o Informe Técnico
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-0 rounded-2xl border border-gray-200 overflow-hidden min-h-[520px] bg-white">

      {/* ── Left sidebar: client list ── */}
      <aside className={`
        flex-shrink-0 w-56 border-r border-gray-100 bg-gray-50 flex flex-col
        max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-xl max-md:w-64
        ${sidebarOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}
        transition-transform duration-200
      `}>
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Clientes</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => { setActiveClientId(folder.id); setSidebarOpen(false); setFilterType('all'); setSearch('') }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                activeClientId === folder.id
                  ? 'bg-brand/10 text-ink font-semibold'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FolderIcon size={16} filled={activeClientId === folder.id} />
              <span className="flex-1 truncate">{folder.name}</span>
              <span className={`text-[11px] font-semibold rounded-full px-1.5 py-0.5 ${
                activeClientId === folder.id ? 'bg-brand text-ink' : 'bg-gray-200 text-gray-500'
              }`}>
                {folder.docs.length}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            <FolderIcon size={15} filled={!!activeFolder} />
            {activeFolder?.name ?? 'Clientes'}
          </button>

          {/* Breadcrumb (desktop) */}
          <div className="hidden md:flex items-center gap-1.5 text-sm">
            <span className="text-gray-400">Documentos</span>
            {activeFolder && (
              <>
                <span className="text-gray-300">/</span>
                <span className="font-semibold text-gray-700">{activeFolder.name}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-40 rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand transition-colors"
          />

          {/* Type filter */}
          <div className="flex gap-1">
            {(['all', 'propuesta', 'informe'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filterType === t ? 'bg-brand text-ink' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t === 'all' ? 'Todos' : TYPE_CFG[t].label + 's'}
              </button>
            ))}
          </div>
        </div>

        {/* Document grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {!activeFolder ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Selecciona un cliente para ver sus documentos
            </div>
          ) : visibleDocs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              {search || filterType !== 'all' ? 'Sin resultados para este filtro' : 'Sin documentos para este cliente'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visibleDocs.map(doc => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onPreview={handlePreview}
                  onDeleted={removeDoc}
                />
              ))}
            </div>
          )}

          {previewLoading && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
              <Spinner size={32} />
            </div>
          )}
        </div>
      </div>

      {/* ── Preview overlay ── */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/70"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 py-3"
            onClick={e => e.stopPropagation()}
          >
            <span className="max-w-[60vw] truncate text-sm font-semibold text-gray-800">{preview.title}</span>
            <button
              onClick={() => setPreview(null)}
              className="ml-4 flex min-h-9 min-w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Cerrar vista previa"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M3 3l10 10M13 3L3 13"/>
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden" onClick={e => e.stopPropagation()}>
            <iframe
              srcDoc={preview.html}
              className="h-full w-full border-0 bg-white"
              title={preview.title}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  )
}
