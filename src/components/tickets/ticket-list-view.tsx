'use client'

import { useState, useMemo } from 'react'
import {
  STATUS_LABEL, STATUS_DOT,
  URGENCY_LABEL,
  type TicketStatusId, type TicketUrgencyId,
} from '@/lib/tickets/labels'

// Urgency dot colors — hardcoded, no CSS classes
const URG_DOT: Record<string, string> = {
  emergencia: '#ef4444',
  urgencia:   '#f97316',
  no_urgente: '#d1d5db',
  preventivo: '#38bdf8',
}

const STATUS_COLS = [
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
}

interface Props {
  tickets: ListTicket[]
  clients: { id: string; name: string }[]
  users: { id: string; name: string }[]
  closedTickets?: ClosedTicket[]
}

export function TicketListView({ tickets, clients, users, closedTickets = [] }: Props) {
  const [q, setQ]           = useState('')
  const [status, setStatus] = useState('')
  const [clientId, setCli]  = useState('')
  const [userId, setUser]   = useState('')
  const [tab, setTab]       = useState<'activos' | 'cerrados'>('activos')

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
    return arr
  }, [tickets, q, status, clientId, userId])

  const byStatus = useMemo(() => {
    const m: Record<string, number> = {}
    tickets.forEach(t => { m[t.status] = (m[t.status] ?? 0) + 1 })
    return m
  }, [tickets])

  const [nowMs] = useState<number>(Date.now())
  const hasFilters = q || status || clientId || userId
  const clearAll = () => { setQ(''); setStatus(''); setCli(''); setUser('') }

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
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-45 max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar ID, título, sucursal…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 bg-white"
                />
              </div>

              <select value={clientId} onChange={e => setCli(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/40">
                <option value="">Todos los clientes</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select value={userId} onChange={e => setUser(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/40">
                <option value="">Todos los técnicos</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>

              {hasFilters && (
                <button onClick={clearAll}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-50">
                  × Limpiar
                </button>
              )}
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setStatus('')}
                className={`rounded-full px-3 py-2.5 min-h-11 text-xs font-semibold transition ${!status ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Todos <span className="ml-1 opacity-60">{tickets.length}</span>
              </button>
              {STATUS_COLS.map(col => (
                <button key={col.v} onClick={() => setStatus(status === col.v ? '' : col.v)}
                  className={`rounded-full px-3 py-2.5 min-h-11 text-xs font-semibold transition ${status === col.v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {col.label}
                  {byStatus[col.v] ? <span className="ml-1 opacity-60">{byStatus[col.v]}</span> : null}
                </button>
              ))}
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
                {filtered.map(ticket => {
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
                        {['', 'ID', 'Título', 'Sucursal', 'Cliente', 'Estado', 'Técnico', 'Docs', 'Fecha'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map(ticket => {
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

                            {/* Docs + items */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                {ticket._count.documents > 0 && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">
                                    <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M14 9.5V5a3 3 0 0 0-6 0v7a1.5 1.5 0 0 0 3 0V5.5a.5.5 0 0 0-1 0V12"/>
                                    </svg>
                                    {ticket._count.documents}
                                  </span>
                                )}
                                {ticket._count.items > 0 && (
                                  <span className="text-[10px] font-semibold text-gray-400">☑ {ticket._count.items}</span>
                                )}
                                {ticket._count.documents === 0 && ticket._count.items === 0 && (
                                  <span className="text-[10px] text-gray-300">—</span>
                                )}
                              </div>
                            </td>

                            {/* Date */}
                            <td className="whitespace-nowrap px-3 py-3">
                              <div className="text-[11px] text-gray-400">{age(ticket.createdAt)}</div>
                              {overdue && <div className="text-[10px] font-semibold text-red-500">vencido</div>}
                            </td>
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
        <div className="space-y-2">
          {closedTickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
              <p className="text-sm text-gray-400">No hay tickets cerrados.</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {closedTickets.map(t => (
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {closedTickets.map(t => (
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
                        <td className="px-4 py-2.5 text-center">
                          {t._count.documents > 0 ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">
                              📎 {t._count.documents}
                            </span>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-400">
                          {t.closedDate ? new Date(t.closedDate).toLocaleDateString('es-CL') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
