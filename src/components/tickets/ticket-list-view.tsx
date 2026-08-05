'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  STATUS_LABEL, STATUS_DOT,
  URGENCY_LABEL,
  type TicketStatusId, type TicketUrgencyId,
} from '@/lib/tickets/labels'
import { now } from '@/lib/now'
import { FilterBar, FilterSearch, FilterSelect, FilterPill, FilterClear } from '@/components/ui/filter-bar'
import { Button } from '@/components/ui/button'
import { TrashIcon } from '@/components/quotes/icons'
import { Modal } from '@/components/resources/modal'
import { deleteTicket } from '@/app/(app)/tickets/actions'
import { DocStatusIcon } from '@/components/cashflow/doc-status-icon'
import { DocumentQuickPreview } from '@/components/quotes/document-quick-preview'

// Urgency dot colors — hardcoded, no CSS classes
const URG_DOT: Record<string, string> = {
  emergencia: '#ef4444',
  urgencia:   '#f97316',
  no_urgente: '#d1d5db',
  preventivo: '#38bdf8',
}

const STATUS_COLS = [
  { v: 'pendiente_aprobacion', label: 'Pend. aprob.' },
  { v: 'nuevo',                label: 'Nuevo' },
  { v: 'en_revision',          label: 'En Revisión' },
  { v: 'en_ejecucion',         label: 'En Ejecución' },
  { v: 'esperando_aprobacion', label: 'Esp. Aprob.' },
]

function age(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'hoy'
  if (days === 1) return '1d'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}m`
  return `${Math.floor(days / 365)}a`
}

interface TicketDoc { id: string; title: string }

export interface ListTicket {
  id: string
  ticketCode: string
  title: string
  description: string | null
  status: string
  urgency: string
  createdAt: string
  estimatedDate: string | null
  client: { id: string; name: string }
  branch: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
  _count: { items: number; documents: number }
  otFileUrl: string | null
  informe: TicketDoc | null
  propuesta: TicketDoc | null
}

export interface ClosedTicket {
  id: string
  ticketCode: string
  title: string
  description: string | null
  status: string
  closedDate: string | null
  client: { name: string }
  branch: { name: string } | null
  assignedTo: { name: string } | null
  _count: { documents: number }
  otFileUrl: string | null
  informe: TicketDoc | null
  propuesta: TicketDoc | null
}

// Íconos OT/IT/PT (pedido explícito del dueño): gris + clic confirma y manda
// a crear el documento; de color + clic abre vista previa in-place — nunca
// navega para previsualizar. OT reusa DocStatusIcon tal cual (mismo patrón
// que conciliacion/page.tsx: FilePreviewButton para el archivo real). IT/PT
// son documentos JSON, no archivos — reusan DocumentQuickPreview (mismo
// componente que Propuestas/Informes) con un trigger tipo ícono en vez del
// link de texto por defecto.
const docBadgeBase = 'interactive inline-flex h-7 w-7 items-center justify-center rounded-md border text-[10px] font-bold transition-colors'
const docBadgeActive = `${docBadgeBase} border-brand/30 bg-brand/10 text-brand-600 hover:bg-brand/20`
const docBadgeMissing = `${docBadgeBase} border-gray-200 bg-gray-50 text-gray-300 hover:border-gray-300 hover:text-gray-400`

function MissingDocBadge({ label, title, href }: { label: string; title: string; href: string }) {
  return (
    <a
      href={href}
      title={`${title}: falta — clic para agregar`}
      className={docBadgeMissing}
      onClick={(e) => {
        if (!confirm(`Este ticket todavía no tiene ${title.toLowerCase()}. ¿Ir a crearlo?`)) e.preventDefault()
      }}
    >
      {label}
    </a>
  )
}

function TicketDocBadges({ ticketId, otFileUrl, informe, propuesta }: {
  ticketId: string
  otFileUrl: string | null
  informe: TicketDoc | null
  propuesta: TicketDoc | null
}) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <DocStatusIcon
        ticketId={ticketId} label="Orden de trabajo" icon="OT"
        files={otFileUrl ? [{ fileUrl: otFileUrl, name: 'Orden de trabajo' }] : []}
      />
      {informe ? (
        <DocumentQuickPreview
          docId={informe.id} title={informe.title} documentType="informe"
          editHref={`/informe?docId=${informe.id}`} trigger="IT" triggerClassName={docBadgeActive}
        />
      ) : (
        <MissingDocBadge label="IT" title="Informe técnico" href={`/informe?ticketId=${ticketId}`} />
      )}
      {propuesta ? (
        <DocumentQuickPreview
          docId={propuesta.id} title={propuesta.title} documentType="propuesta"
          editHref={`/cotizador?docId=${propuesta.id}`} trigger="PT" triggerClassName={docBadgeActive}
        />
      ) : (
        <MissingDocBadge label="PT" title="Propuesta técnica" href={`/cotizador?new=1&ticketId=${ticketId}`} />
      )}
    </div>
  )
}

interface Props {
  tickets: ListTicket[]
  clients: { id: string; name: string }[]
  users: { id: string; name: string }[]
  closedTickets?: ClosedTicket[]
  /** Solo super/supervisor — mismo gate que ya aplica el server action deleteTicket(). */
  canDelete?: boolean
}

export function TicketListView({ tickets, clients, users, closedTickets = [], canDelete = false }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string; title: string } | null>(null)
  const [isDeleting, startDelete] = useTransition()

  function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    startDelete(async () => {
      await deleteTicket(id)
      setDeleteTarget(null)
    })
  }
  const [q, setQ]           = useState('')
  const [status, setStatus] = useState('')
  const [clientId, setCli]  = useState('')
  const [userId, setUser]   = useState('')
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [tab, setTab]       = useState<'activos' | 'cerrados'>('activos')
  const [qClosed, setQClosed]           = useState('')
  const [clientClosed, setClientClosed] = useState('')
  const [statusClosed, setStatusClosed] = useState('')
  type SortKey = 'code' | 'title' | 'branch' | 'client' | 'status' | 'assignedTo' | 'date'
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let arr = tickets
    if (q) {
      const lq = q.toLowerCase()
      arr = arr.filter(t =>
        t.ticketCode.toLowerCase().includes(lq) ||
        t.title.toLowerCase().includes(lq) ||
        (t.branch?.name ?? '').toLowerCase().includes(lq),
      )
    }
    if (status)   arr = arr.filter(t => t.status === status)
    if (clientId) arr = arr.filter(t => t.client.id === clientId)
    if (userId)   arr = arr.filter(t => t.assignedTo?.id === userId)
    if (unassignedOnly) arr = arr.filter(t => !t.assignedTo)
    return arr
  }, [tickets, q, status, clientId, userId, unassignedOnly])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (t: ListTicket): string | number => {
      switch (sortKey) {
        case 'code':       return t.ticketCode
        case 'title':      return t.title
        case 'branch':     return t.branch?.name ?? '￿' // sin sucursal → al final
        case 'client':     return t.client.name
        case 'status':     return STATUS_LABEL[t.status as TicketStatusId] ?? t.status
        case 'assignedTo': return t.assignedTo?.name ?? '￿' // sin asignar → al final
        case 'date':       return new Date(t.createdAt).getTime()
      }
    }
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [filtered, sortKey, sortDir])

  // Cerrados no tenía ningún filtro (pedido explícito del dueño: "los
  // tickets cerrados también se deben poder filtrar") — client sin `id` acá
  // (ClosedTicket solo trae `client.name`), así que el filtro compara por
  // nombre en vez de id, único caso distinto del filtro de Activos.
  const filteredClosed = useMemo(() => {
    let arr = closedTickets
    if (qClosed) {
      const lq = qClosed.toLowerCase()
      arr = arr.filter(t =>
        t.ticketCode.toLowerCase().includes(lq) ||
        t.title.toLowerCase().includes(lq) ||
        (t.branch?.name ?? '').toLowerCase().includes(lq),
      )
    }
    if (clientClosed) arr = arr.filter(t => t.client.name === clientClosed)
    if (statusClosed) arr = arr.filter(t => t.status === statusClosed)
    return arr
  }, [closedTickets, qClosed, clientClosed, statusClosed])

  const byStatusClosed = useMemo(() => {
    const m: Record<string, number> = {}
    closedTickets.forEach(t => { m[t.status] = (m[t.status] ?? 0) + 1 })
    return m
  }, [closedTickets])

  const unassignedCount = useMemo(() => tickets.filter(t => !t.assignedTo).length, [tickets])

  const byStatus = useMemo(() => {
    const m: Record<string, number> = {}
    tickets.forEach(t => { m[t.status] = (m[t.status] ?? 0) + 1 })
    return m
  }, [tickets])

  const [nowMs] = useState<number>(now())
  const hasFilters = q || status || clientId || userId || unassignedOnly
  const clearAll = () => { setQ(''); setStatus(''); setCli(''); setUser(''); setUnassignedOnly(false) }
  const hasFiltersClosed = qClosed || clientClosed || statusClosed
  const clearAllClosed = () => { setQClosed(''); setClientClosed(''); setStatusClosed('') }
  const closedClients = useMemo(() => [...new Set(closedTickets.map(t => t.client.name))].sort(), [closedTickets])
  const CLOSED_STATUS_COLS = [
    { v: 'resuelto',   label: 'Resuelto' },
    { v: 'cancelado',  label: 'Cancelado' },
    { v: 'fusionado',  label: 'Fusionado' },
  ]

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200">
        {(['activos', 'cerrados'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`interactive min-h-11 px-5 py-2.5 text-sm font-semibold transition-colors ${
              tab === t
                ? 'border-b-2 border-brand text-ink'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'activos'
              ? `Activos (${tickets.length})`
              : `Cerrados (${closedTickets.length})`}
          </button>
        ))}
      </div>

      {tab === 'activos' && (
        <div className="space-y-3">
          {/* ── Filter bar ── */}
          <div className="space-y-2.5">
            <FilterBar>
              <FilterSearch
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar ID, título, sucursal…"
              />
              <FilterSelect value={clientId} onChange={e => setCli(e.target.value)}>
                <option value="">Todos los clientes</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FilterSelect>
              <FilterSelect value={userId} onChange={e => setUser(e.target.value)}>
                <option value="">Todos los técnicos</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </FilterSelect>
              {hasFilters && <FilterClear onClick={clearAll} />}
            </FilterBar>

            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5">
              <FilterPill active={!status} onClick={() => setStatus('')}>
                Todos <span className="ml-1 opacity-60">{tickets.length}</span>
              </FilterPill>
              {STATUS_COLS.map(col => (
                <FilterPill key={col.v} active={status === col.v} onClick={() => setStatus(status === col.v ? '' : col.v)}>
                  {col.label}
                  {byStatus[col.v] ? <span className="ml-1 opacity-60">{byStatus[col.v]}</span> : null}
                </FilterPill>
              ))}
              {unassignedCount > 0 && (
                <FilterPill active={unassignedOnly} onClick={() => setUnassignedOnly(v => !v)} tone="warn">
                  ⚠ Sin asignar <span className="ml-1 opacity-70">{unassignedCount}</span>
                </FilterPill>
              )}
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs font-medium text-gray-500">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            {hasFilters && <span className="ml-2 text-gray-300">· {tickets.length} total</span>}
          </p>

          {/* Table / Cards */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
              <p className="text-sm text-gray-400">Sin tickets para los filtros seleccionados.</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {sorted.map(ticket => {
                  const st = ticket.status as TicketStatusId
                  return (
                    <a key={ticket.id} href={`/tickets/${ticket.id}`}
                      className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm active:scale-[0.98] transition-transform">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm text-gray-800 line-clamp-1 flex-1">{ticket.title}</p>
                        <span
                          className="shrink-0 mt-0.5 h-2.5 w-2.5 rounded-full"
                          style={{ background: URG_DOT[ticket.urgency] ?? '#ccc' }}
                          title={URGENCY_LABEL[ticket.urgency as TicketUrgencyId]}
                        />
                      </div>
                      {ticket.description && (
                        <p className="text-xs text-gray-400 line-clamp-1 mb-1.5">{ticket.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[st] ?? 'bg-gray-300'}`} />
                          {STATUS_LABEL[st] ?? ticket.status}
                        </span>
                        <span>{ticket.client.name}</span>
                        {ticket.branch && <span>{ticket.branch.name}</span>}
                        {ticket.assignedTo
                          ? <span>{ticket.assignedTo.name.split(' ')[0]}</span>
                          : <span className="font-semibold text-amber-600">Sin asignar</span>
                        }
                        <span className="ml-auto font-mono text-[10px] text-gray-400">{age(ticket.createdAt)}</span>
                      </div>
                    </a>
                  )
                })}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400"></th>
                        {([
                          ['code', 'ID'], ['title', 'Título'], ['branch', 'Sucursal'], ['client', 'Cliente'],
                          ['status', 'Estado'], ['assignedTo', 'Técnico'],
                        ] as [SortKey, string][]).map(([key, label]) => (
                          <th key={key}
                            onClick={() => toggleSort(key)}
                            className="cursor-pointer select-none px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap transition hover:text-gray-600"
                          >
                            {label}{sortKey === key && <span className="ml-1 text-brand">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Docs</th>
                        <th
                          onClick={() => toggleSort('date')}
                          className="cursor-pointer select-none px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap transition hover:text-gray-600"
                        >
                          Fecha{sortKey === 'date' && <span className="ml-1 text-brand">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                        </th>
                        {canDelete && <th className="px-3 py-2.5" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.map(ticket => {
                        const st = ticket.status as TicketStatusId
                        const urg = ticket.urgency as TicketUrgencyId
                        const overdue = ticket.estimatedDate &&
                          new Date(ticket.estimatedDate).getTime() < nowMs &&
                          !['resuelto', 'cancelado', 'fusionado'].includes(ticket.status)
                        return (
                          <tr
                            key={ticket.id}
                            onClick={() => { window.location.href = `/tickets/${ticket.id}` }}
                            className="cursor-pointer transition-colors hover:bg-gray-50"
                          >
                            {/* Urgency dot */}
                            <td className="w-8 px-3 py-3">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ background: URG_DOT[ticket.urgency] ?? '#ccc' }}
                                title={URGENCY_LABEL[urg]}
                              />
                            </td>

                            {/* Code */}
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="font-mono text-[10px] text-gray-400">{ticket.ticketCode}</span>
                            </td>

                            {/* Title + description */}
                            <td className="max-w-72 px-3 py-3">
                              <p className="truncate font-medium text-gray-800">{ticket.title}</p>
                              {ticket.description && (
                                <p className="truncate text-[11px] text-gray-400 mt-0.5">{ticket.description}</p>
                              )}
                            </td>

                            {/* Branch */}
                            <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">
                              {ticket.branch?.name ?? '—'}
                            </td>

                            {/* Client */}
                            <td className="whitespace-nowrap px-3 py-3">
                              <span className="rounded-md bg-gray-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                {ticket.client.name}
                              </span>
                            </td>

                            {/* Status — dot + label */}
                            <td className="whitespace-nowrap px-3 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[st] ?? 'bg-gray-300'}`} />
                                {STATUS_LABEL[st] ?? ticket.status}
                              </span>
                            </td>

                            {/* Assignee */}
                            <td className="whitespace-nowrap px-3 py-3">
                              {ticket.assignedTo ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[9px] font-bold text-gray-600">
                                    {ticket.assignedTo.name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="text-xs text-gray-600">{ticket.assignedTo.name.split(' ')[0]}</span>
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-amber-600">⚠ Sin asignar</span>
                              )}
                            </td>

                            {/* OT/IT/PT + items */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                <TicketDocBadges ticketId={ticket.id} otFileUrl={ticket.otFileUrl} informe={ticket.informe} propuesta={ticket.propuesta} />
                                {ticket._count.items > 0 && (
                                  <span className="text-[10px] font-semibold text-gray-400">☑ {ticket._count.items}</span>
                                )}
                              </div>
                            </td>

                            {/* Date */}
                            <td className="whitespace-nowrap px-3 py-3" title={`Creado: ${new Date(ticket.createdAt).toLocaleString('es-CL')}`}>
                              <div className="text-[11px] font-medium text-gray-500">{age(ticket.createdAt)}</div>
                              <div className="text-[10px] text-gray-400">{new Date(ticket.createdAt).toLocaleDateString('es-CL')}</div>
                              {overdue && <div className="text-[10px] font-semibold text-red-500">vencido</div>}
                            </td>

                            {canDelete && (
                              <td className="whitespace-nowrap px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                {/* Ícono solo, gris por defecto — eliminar es una acción rara y
                                    destructiva, no debería competir visualmente con abrir el
                                    ticket en cada fila de una lista densa. Sigue pasando por el
                                    mismo modal de confirmación de siempre. */}
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget({ id: ticket.id, code: ticket.ticketCode, title: ticket.title })}
                                  aria-label={`Eliminar ${ticket.ticketCode}`}
                                  className="interactive inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-danger-50 hover:text-danger-700"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'cerrados' && (
        <div className="space-y-3">
          {closedTickets.length > 0 && (
            <div className="space-y-2.5">
              <FilterBar>
                <FilterSearch
                  value={qClosed}
                  onChange={e => setQClosed(e.target.value)}
                  placeholder="Buscar ID, título, sucursal…"
                />
                <FilterSelect value={clientClosed} onChange={e => setClientClosed(e.target.value)}>
                  <option value="">Todos los clientes</option>
                  {closedClients.map(name => <option key={name} value={name}>{name}</option>)}
                </FilterSelect>
                {hasFiltersClosed && <FilterClear onClick={clearAllClosed} />}
              </FilterBar>
              <div className="flex flex-wrap gap-1.5">
                <FilterPill active={!statusClosed} onClick={() => setStatusClosed('')}>
                  Todos <span className="ml-1 opacity-60">{closedTickets.length}</span>
                </FilterPill>
                {CLOSED_STATUS_COLS.map(col => (
                  <FilterPill key={col.v} active={statusClosed === col.v} onClick={() => setStatusClosed(statusClosed === col.v ? '' : col.v)}>
                    {col.label}
                    {byStatusClosed[col.v] ? <span className="ml-1 opacity-60">{byStatusClosed[col.v]}</span> : null}
                  </FilterPill>
                ))}
              </div>
            </div>
          )}

          {closedTickets.length > 0 && (
            <p className="text-xs font-medium text-gray-500">
              {filteredClosed.length} resultado{filteredClosed.length !== 1 ? 's' : ''}
              {hasFiltersClosed && <span className="ml-2 text-gray-300">· {closedTickets.length} total</span>}
            </p>
          )}

          {closedTickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
              <p className="text-sm text-gray-400">No hay tickets cerrados.</p>
            </div>
          ) : filteredClosed.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
              <p className="text-sm text-gray-400">Sin tickets para los filtros seleccionados.</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {filteredClosed.map(t => (
                  <a key={t.id} href={`/tickets/${t.id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm active:scale-[0.98] transition-transform">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="font-semibold text-sm text-gray-700 line-clamp-2 flex-1">{t.title}</p>
                      <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${t.status === 'resuelto' ? 'text-green-700' : 'text-gray-500'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status as TicketStatusId] ?? 'bg-gray-300'}`} />
                        {STATUS_LABEL[t.status as TicketStatusId] ?? t.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span>{t.client.name}</span>
                      {t.branch && <span>{t.branch.name}</span>}
                      {t.assignedTo && <span>{t.assignedTo.name.split(' ')[0]}</span>}
                      {t.closedDate && (
                        <span className="ml-auto text-[10px] text-gray-400">
                          {new Date(t.closedDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
                    <tr>
                      {['Código', 'Título', 'Cliente', 'Sucursal', 'Estado', 'Técnico', 'Docs', 'Cierre'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left whitespace-nowrap">{h}</th>
                      ))}
                      {canDelete && <th className="px-3 py-2.5" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredClosed.map(t => (
                      <tr key={t.id} className="transition hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <a href={`/tickets/${t.id}`} className="font-mono text-xs text-gray-400 hover:text-brand">
                            {t.ticketCode}
                          </a>
                        </td>
                        <td className="max-w-72 px-4 py-2.5">
                          <a href={`/tickets/${t.id}`} className="line-clamp-1 text-gray-700 hover:text-brand">{t.title}</a>
                          {t.description && <p className="truncate text-[11px] text-gray-400 mt-0.5">{t.description}</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{t.client.name}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{t.branch?.name ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status as TicketStatusId] ?? 'bg-gray-400'}`} />
                            {STATUS_LABEL[t.status as TicketStatusId] ?? t.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{t.assignedTo?.name ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <TicketDocBadges ticketId={t.id} otFileUrl={t.otFileUrl} informe={t.informe} propuesta={t.propuesta} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-400">
                          {t.closedDate ? new Date(t.closedDate).toLocaleDateString('es-CL') : '—'}
                        </td>
                        {canDelete && (
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ id: t.id, code: t.ticketCode, title: t.title })}
                              aria-label={`Eliminar ${t.ticketCode}`}
                              className="interactive inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-danger-50 hover:text-danger-700"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar ticket">
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              <span className="font-mono text-xs text-gray-400">{deleteTarget.code}</span> — {deleteTarget.title}
              <br />¿Eliminar este ticket? No aparecerá más en el listado.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" onClick={confirmDelete} disabled={isDeleting} aria-busy={isDeleting}>
                {isDeleting ? 'Eliminando…' : 'Eliminar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
