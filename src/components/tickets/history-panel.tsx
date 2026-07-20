import { STATUS_LABEL, STATUS_COLOR, STATUS_DOT, type TicketStatusId } from '@/lib/tickets/labels'

export type HistoryEvent = {
  id: string
  note: string | null
  fromStatus: string | null
  toStatus: string | null
  isInternal: boolean
  createdAt: Date
  user: { id: string; name: string } | null
}

// Only these JSON fields from GAS import are surfaced; all others (parentId, titulo, item_order, etc.) are dropped
const APPROVED_JSON_FIELDS: Record<string, string> = {
  tecnico:       'Técnico',
  ot:            'N° OT',
  fechaEstimada: 'Fecha est.',
  avanceId:      'Avance',
  fechaAvance:   'Fecha avance',
}

function parseNoteJson(note: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(note)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as Record<string, unknown>
  } catch {}
  return null
}

// Strip GAS import prefix "[CREADO]" (and trailing whitespace/newline)
function cleanNote(note: string): string {
  return note.replace(/^\[CREADO\]\s*\n?/i, '').trim()
}

function isNoisyEntry(h: HistoryEvent): boolean {
  // Same-state transitions add no information
  if (h.fromStatus && h.toStatus && h.fromStatus === h.toStatus) return true
  if (h.note) {
    const obj = parseNoteJson(h.note)
    if (obj) {
      if ('parentId' in obj) return true         // avance sub-record
      if ('item_order' in obj) return true       // ticket item metadata from import
      if (obj.createdBy === 'sistema') return true  // import system marker
    }
  }
  return false
}

export function filterHistory(events: HistoryEvent[]): HistoryEvent[] {
  const visible = events.filter(h => !isNoisyEntry(h))
  // Keep only the first (newest) "Requerimiento creado" note — import often generates duplicates
  let seenCreation = false
  return visible.filter(h => {
    if (!h.note) return true
    if (cleanNote(h.note) === 'Requerimiento creado') {
      if (seenCreation) return false
      seenCreation = true
    }
    return true
  })
}

export function HistoryPanel({
  events,
  title,
  variant,
}: {
  events: HistoryEvent[]
  title: string
  variant: 'public' | 'internal'
}) {
  const isInternal = variant === 'internal'
  const visible = filterHistory(events)

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${isInternal ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <div className={`mb-4 flex items-center justify-between text-sm font-semibold ${isInternal ? 'text-amber-800' : 'text-gray-700'}`}>
        <span>{isInternal ? '🔒 ' : ''}{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isInternal ? 'bg-amber-200 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
          {visible.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-gray-400">Sin actividad registrada.</p>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
          <ol className="relative ml-2 space-y-0 border-l border-gray-100">
            {visible.map((h, i) => {
              const cleanedNote = h.note ? cleanNote(h.note) : null
              // Suppress status arrows on creation notes — import stored wrong direction
              const isCreationNote = cleanedNote === 'Requerimiento creado'
              const isStatusChange = !!(h.fromStatus && h.toStatus) && !isCreationNote

              const actor = h.user?.name ?? 'Sistema'
              const dateStr = formatDate(h.createdAt)
              const dotCls = h.toStatus && !isCreationNote
                ? (STATUS_DOT[h.toStatus as TicketStatusId] ?? 'bg-gray-300')
                : isInternal ? 'bg-amber-400' : 'bg-gray-300'
              const isLast = i === visible.length - 1

              return (
                <li key={h.id} className={`ml-4 ${isLast ? 'pb-1' : 'pb-5'}`}>
                  <span
                    className={`absolute -left-1.25 flex h-2.5 w-2.5 items-center justify-center rounded-full ring-2 ${isInternal ? 'ring-amber-50' : 'ring-white'} ${dotCls}`}
                  />
                  <div>
                    {isStatusChange && (
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                          {STATUS_LABEL[h.fromStatus as TicketStatusId] ?? h.fromStatus}
                        </span>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300">
                          <path d="M3 8h10M9 4l4 4-4 4"/>
                        </svg>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[h.toStatus as TicketStatusId] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {STATUS_LABEL[h.toStatus as TicketStatusId] ?? h.toStatus}
                        </span>
                      </div>
                    )}
                    <NoteContent note={h.note} />
                    <p className={`mt-0.5 text-[10px] ${isInternal ? 'text-amber-600' : 'text-gray-400'}`}>
                      <span className={`font-semibold ${isInternal ? 'text-amber-700' : 'text-gray-500'}`}>{actor}</span>
                      {' · '}{dateStr}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}

function NoteContent({ note }: { note: string | null }) {
  if (!note) return null

  // Parse JSON outside JSX to avoid constructing elements inside try/catch
  let jsonFields: string[] | null = null
  let isJsonNote = false
  try {
    const obj = JSON.parse(note)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      isJsonNote = true
      const fields = Object.entries(obj as Record<string, unknown>)
        .filter(([k, v]) => k in APPROVED_JSON_FIELDS && v && String(v).trim() !== '')
        .map(([k, v]) => `${APPROVED_JSON_FIELDS[k]}: ${v}`)
      if (fields.length > 0) jsonFields = fields
    }
  } catch {}

  if (isJsonNote) {
    if (!jsonFields) return null
    return (
      <div className="mb-0.5 flex flex-wrap gap-1">
        {jsonFields.map((f, i) => (
          <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            {f}
          </span>
        ))}
      </div>
    )
  }

  const text = cleanNote(note)
  if (!text) return null
  return <p className="mb-0.5 whitespace-pre-wrap text-xs leading-snug text-gray-700">{text}</p>
}

function formatDate(date: Date): string {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  if (hours < 24) return `hace ${hours}h`
  if (days < 7) return `hace ${days}d`

  return new Date(date).toLocaleString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: days > 365 ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  })
}
