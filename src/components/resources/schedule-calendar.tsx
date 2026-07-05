'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import type { FormState } from '@/app/(app)/cronograma/actions'
import type { AssignmentOptions } from '@/lib/resources/assignments'
import {
  ASSIGNEE_ROLE_BADGE,
  ASSIGNEE_ROLE_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  permissionEventColor,
  type AssigneeRoleId,
  type AssignmentStatusId,
} from '@/lib/resources/labels'
import { dayKey, formatDateTime, toDatetimeLocal } from '@/lib/resources/dates'
import { IconButton } from '@/components/quotes/ui'
import { AssignmentForm } from './assignment-form'
import { Modal } from './modal'

export type CalendarAssignee = { id: string; name: string; role: AssigneeRoleId }

export type CalendarEvent = {
  id: string
  title: string
  start: string // ISO
  end: string // ISO
  status: AssignmentStatusId
  permissionRequested: boolean
  client?: string | null
  meetingUrl?: string | null
  description?: string | null
  ticketCode?: string | null
  ticketId?: string | null
  assignees: CalendarAssignee[]
}

type View = 'month' | 'week' | 'day'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const HOUR_START = 7
const HOUR_END = 21
const HOUR_PX = 48

function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function startOfWeek(date: Date): Date {
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -mondayIndex(date))
}

function formatEventTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function agendaDayLabel(isoDate: string): string {
  const d = new Date(isoDate)
  const todayKey = dayKey(new Date())
  const k = dayKey(d)
  if (k === todayKey) return 'Hoy'
  if (k === dayKey(addDays(new Date(), 1))) return 'Mañana'
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })
}

/** Returns a solid hex color for the agenda left-border accent. */
function agendaBorderColor(permissionRequested: boolean, status: AssignmentStatusId): string {
  if (status === 'cancelled') return '#d1d5db' // gray-300
  return permissionRequested ? '#86efac' : '#fcd34d' // green-300 : amber-300
}

export function ScheduleCalendar({
  events,
  options,
  createAction,
  deleteAction,
  unscheduledTickets: _unscheduledTickets,
}: {
  events: CalendarEvent[]
  options: AssignmentOptions
  createAction: (prev: FormState, formData: FormData) => Promise<FormState>
  deleteAction: (id: string) => Promise<void>
  unscheduledTickets?: { id: string; ticketCode: string; title: string; urgency: string; client: { name: string } }[]
}) {
  const today = new Date()
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [createInitial, setCreateInitial] = useState<{ start: string; end: string } | null>(null)
  const [detail, setDetail] = useState<CalendarEvent | null>(null)
  const [techFilter, setTechFilter] = useState('') // '' = todos
  const [isDeleting, startDelete] = useTransition()

  const filtered = useMemo(
    () => (techFilter ? events.filter((e) => e.assignees.some((a) => a.id === techFilter)) : events),
    [events, techFilter],
  )

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of filtered) {
      const k = dayKey(new Date(e.start))
      const arr = map.get(k) ?? []
      arr.push(e)
      map.set(k, arr)
    }
    return map
  }, [filtered])

  // Agenda: upcoming events for the next 60 days, grouped by day, for mobile list view
  const agendaGroups = useMemo(() => {
    const now = new Date()
    const limit = addDays(now, 60)
    const upcoming = filtered
      .filter((e) => new Date(e.start) >= now && new Date(e.start) <= limit)
      .sort((a, b) => a.start.localeCompare(b.start))
    const grouped = new Map<string, CalendarEvent[]>()
    for (const e of upcoming) {
      const k = dayKey(new Date(e.start))
      grouped.set(k, [...(grouped.get(k) ?? []), e])
    }
    return Array.from(grouped.entries()).map(([k, evts]) => ({ key: k, label: agendaDayLabel(evts[0].start), events: evts }))
  }, [filtered])

  function openCreateAt(date: Date) {
    const start = new Date(date)
    const end = new Date(date)
    end.setHours(end.getHours() + 1)
    setCreateInitial({ start: toDatetimeLocal(start), end: toDatetimeLocal(end) })
  }

  function shift(delta: number) {
    if (view === 'month') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))
    else setCursor(addDays(cursor, delta * (view === 'week' ? 7 : 1)))
  }

  const title =
    view === 'month'
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : view === 'day'
        ? cursor.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' })
        : (() => {
            const s = startOfWeek(cursor)
            const e = addDays(s, 6)
            return `${s.getDate()} ${MONTHS[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`
          })()

  function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar esta asignación?')) return
    startDelete(async () => {
      await deleteAction(id)
      setDetail(null)
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold capitalize text-ink">{title}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="mr-1 cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
            aria-label="Filtrar por técnico"
          >
            <option value="">Todos los técnicos</option>
            {options.technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="mr-1 flex rounded-md border border-gray-300 p-0.5 text-xs">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`cursor-pointer rounded px-2 py-1 font-medium transition-colors ${view === v ? 'bg-brand text-ink' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}
            className="cursor-pointer rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Hoy
          </button>
          <IconButton label="Anterior" onClick={() => shift(-1)}>‹</IconButton>
          <IconButton label="Siguiente" onClick={() => shift(1)}>›</IconButton>
        </div>
      </div>

      {/* Mobile agenda list — visible only on < md; calendar renders below (hidden md:block) */}
      <div className="md:hidden">
        {agendaGroups.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">Sin asignaciones próximas</p>
            <button
              type="button"
              onClick={() => openCreateAt(new Date())}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-ink hover:opacity-90 transition-opacity"
            >
              + Nueva asignación
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => openCreateAt(new Date())}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-ink hover:opacity-90 transition-opacity"
              >
                + Nueva
              </button>
            </div>
            {agendaGroups.map(({ key, label, events: dayEvents }) => (
              <div key={key}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                <div className="space-y-2">
                  {dayEvents.map((evt) => (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => setDetail(evt)}
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm hover:bg-gray-50 transition-colors"
                      style={{ borderLeft: `4px solid ${agendaBorderColor(evt.permissionRequested, evt.status)}` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{evt.title}</p>
                          {evt.client && (
                            <p className="mt-0.5 truncate text-xs text-gray-500">{evt.client}</p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                          {ASSIGNMENT_STATUS_LABELS[evt.status] ?? evt.status}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                        <span>{formatEventTime(evt.start)} – {formatEventTime(evt.end)}</span>
                        {evt.assignees.length > 0 && (
                          <span>{evt.assignees.map((a) => a.name.split(' ')[0]).join(', ')}</span>
                        )}
                        {evt.ticketCode && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">{evt.ticketCode}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar grid — hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
        {view === 'month' && <MonthView cursor={cursor} byDay={byDay} today={today} onCreate={openCreateAt} onSelect={setDetail} />}
        {view === 'week' && <TimeGridView days={Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))} byDay={byDay} onCreate={openCreateAt} onSelect={setDetail} />}
        {view === 'day' && <TimeGridView days={[cursor]} byDay={byDay} onCreate={openCreateAt} onSelect={setDetail} />}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-green-300 bg-green-100" />
          Permiso solicitado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-amber-300 bg-amber-100" />
          Sin permiso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-gray-200 bg-gray-100" />
          Cancelada
        </span>
      </div>

      {/* Create modal */}
      <Modal open={!!createInitial} onClose={() => setCreateInitial(null)} title="Nueva asignación">
        {createInitial && (
          <AssignmentForm action={createAction} options={options} initial={createInitial} submitLabel="Crear asignación" />
        )}
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? ''}>
        {detail && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`w-fit rounded-full border px-2 py-0.5 text-xs ${permissionEventColor(detail.permissionRequested, detail.status)}`}>
                {detail.permissionRequested ? 'Permiso solicitado' : 'Sin permiso de sucursal'}
              </span>
              <span className="text-xs text-gray-400">{ASSIGNMENT_STATUS_LABELS[detail.status]}</span>
            </div>
            <DetailRow label="Inicio" value={formatDateTime(new Date(detail.start))} />
            <DetailRow label="Término" value={formatDateTime(new Date(detail.end))} />
            {detail.client && <DetailRow label="Cliente" value={detail.client} />}
            {detail.assignees.length > 0 && (
              <DetailRow
                label="Equipo"
                value={
                  <span className="flex flex-wrap gap-1.5">
                    {detail.assignees.map((a) => (
                      <span key={a.id} className={`rounded-full px-2 py-0.5 text-xs ${ASSIGNEE_ROLE_BADGE[a.role]}`}>
                        {a.name} · {ASSIGNEE_ROLE_LABELS[a.role]}
                      </span>
                    ))}
                  </span>
                }
              />
            )}
            {detail.description && <DetailRow label="Descripción" value={detail.description} />}
            {detail.meetingUrl && (
              <DetailRow
                label="Reunión"
                value={
                  <a href={detail.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    Unirse a la reunión
                  </a>
                }
              />
            )}
            <div className="mt-2 flex items-center gap-2">
              <Link href={`/cronograma/${detail.id}`} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-600">
                Editar
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(detail.id)}
                disabled={isDeleting}
                className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {isDeleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  )
}

// ---------- Month ----------
function MonthView({
  cursor,
  byDay,
  today,
  onCreate,
  onSelect,
}: {
  cursor: Date
  byDay: Map<string, CalendarEvent[]>
  today: Date
  onCreate: (d: Date) => void
  onSelect: (e: CalendarEvent) => void
}) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = mondayIndex(first)
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const todayKey = dayKey(today)

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 text-sm">
      {WEEKDAYS.map((d) => (
        <div key={d} className="bg-gray-50 px-2 py-1.5 text-center text-xs font-medium text-gray-500">{d}</div>
      ))}
      {cells.map((day, i) => {
        if (day === null) return <div key={i} className="min-h-[92px] bg-gray-50/50" />
        const date = new Date(year, month, day)
        const k = dayKey(date)
        const dayEvents = byDay.get(k) ?? []
        const isToday = k === todayKey
        return (
          <div
            key={i}
            onClick={() => onCreate(new Date(year, month, day, 9, 0))}
            className="min-h-[92px] cursor-pointer bg-white p-1.5 transition-colors hover:bg-gray-50/60"
          >
            <div className={`mb-1 text-xs font-medium ${isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-ink' : 'text-gray-400'}`}>{day}</div>
            <div className="flex flex-col gap-1">
              {dayEvents.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); onSelect(e) }}
                  className={`cursor-pointer truncate rounded border px-1.5 py-0.5 text-left text-[11px] transition-opacity hover:opacity-80 ${permissionEventColor(e.permissionRequested, e.status)}`}
                >
                  {e.title}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Day / Week time grid ----------
function TimeGridView({
  days,
  byDay,
  onCreate,
  onSelect,
}: {
  days: Date[]
  byDay: Map<string, CalendarEvent[]>
  onCreate: (d: Date) => void
  onSelect: (e: CalendarEvent) => void
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
  const todayKey = dayKey(new Date())

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[560px]">
        {/* Hour gutter */}
        <div className="w-12 shrink-0 pt-7">
          {hours.map((h) => (
            <div key={h} className="relative text-right text-[10px] text-gray-400" style={{ height: HOUR_PX }}>
              <span className="absolute -top-1.5 right-1">{h}:00</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => {
            const k = dayKey(day)
            const dayEvents = byDay.get(k) ?? []
            const isToday = k === todayKey
            return (
              <div key={k} className="border-l border-gray-200">
                <div className={`h-7 border-b border-gray-200 text-center text-xs font-medium ${isToday ? 'text-brand-600' : 'text-gray-500'}`}>
                  {day.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit' })}
                </div>
                <div className="relative">
                  {hours.map((h) => (
                    <div
                      key={h}
                      onClick={() => onCreate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0))}
                      className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-brand/5"
                      style={{ height: HOUR_PX }}
                    />
                  ))}
                  {dayEvents.map((e) => {
                    const s = new Date(e.start)
                    const en = new Date(e.end)
                    const startH = s.getHours() + s.getMinutes() / 60
                    const endH = en.getHours() + en.getMinutes() / 60
                    const top = Math.max(0, (startH - HOUR_START) * HOUR_PX)
                    const height = Math.max(20, (Math.min(endH, HOUR_END) - Math.max(startH, HOUR_START)) * HOUR_PX - 2)
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); onSelect(e) }}
                        className={`absolute left-1 right-1 cursor-pointer overflow-hidden rounded border px-1.5 py-0.5 text-left text-[11px] transition-opacity hover:opacity-90 ${permissionEventColor(e.permissionRequested, e.status)}`}
                        style={{ top, height }}
                      >
                        <span className="block font-medium">{s.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="block truncate">{e.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
