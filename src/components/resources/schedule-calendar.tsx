'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ASSIGNMENT_STATUS_COLOR, ASSIGNMENT_STATUS_LABELS, type AssignmentStatusId } from '@/lib/resources/labels'
import { dayKey } from '@/lib/resources/dates'
import { IconButton } from '@/components/quotes/ui'

export type CalendarEvent = {
  id: string
  title: string
  start: string // ISO
  status: AssignmentStatusId
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Monday-first weekday index (0 = Monday).
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

export function ScheduleCalendar({ events }: { events: CalendarEvent[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const k = dayKey(new Date(e.start))
      const arr = map.get(k) ?? []
      arr.push(e)
      map.set(k, arr)
    }
    return map
  }, [events])

  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = mondayIndex(firstOfMonth)
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }
  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const todayKey = dayKey(today)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goToday}
            className="cursor-pointer rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Hoy
          </button>
          <IconButton label="Mes anterior" onClick={() => shift(-1)}>‹</IconButton>
          <IconButton label="Mes siguiente" onClick={() => shift(1)}>›</IconButton>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 text-sm">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-gray-50 px-2 py-1.5 text-center text-xs font-medium text-gray-500">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-[88px] bg-gray-50/50" />
          const k = dayKey(new Date(year, month, day))
          const dayEvents = byDay.get(k) ?? []
          const isToday = k === todayKey
          return (
            <div key={i} className="min-h-[88px] bg-white p-1.5">
              <div className={`mb-1 text-xs font-medium ${isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-ink' : 'text-gray-400'}`}>
                {day}
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.map((e) => (
                  <Link
                    key={e.id}
                    href={`/recursos/cronograma/${e.id}`}
                    title={`${e.title} · ${ASSIGNMENT_STATUS_LABELS[e.status]}`}
                    className={`truncate rounded border px-1.5 py-0.5 text-[11px] transition-opacity hover:opacity-80 ${ASSIGNMENT_STATUS_COLOR[e.status]}`}
                  >
                    {e.title}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        {(Object.keys(ASSIGNMENT_STATUS_LABELS) as AssignmentStatusId[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded border ${ASSIGNMENT_STATUS_COLOR[s]}`} />
            {ASSIGNMENT_STATUS_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  )
}
