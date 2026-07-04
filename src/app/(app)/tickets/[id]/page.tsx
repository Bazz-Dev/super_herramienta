import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTicket } from '@/lib/tickets/tickets'
import {
  STATUS_LABEL, STATUS_COLOR, STATUS_DOT,
  URGENCY_LABEL, URGENCY_COLOR,
  type TicketStatusId, type TicketUrgencyId,
} from '@/lib/tickets/labels'
import { TicketControls } from '@/components/tickets/ticket-controls'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const actor = { tenantId: session.user.tenantId, role: session.user.role, id: session.user.id! }

  const { id } = await params
  const ticket = await getTicket(actor, id)
  if (!ticket) notFound()

  const [technicians, staffUsers, allInformes] = await Promise.all([
    prisma.technician.findMany({
      where: { tenantId: actor.tenantId, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { tenantId: actor.tenantId, role: { in: ['super', 'supervisor', 'tecnico'] }, active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.clientDocument.findMany({
      where: { tenantId: actor.tenantId, type: 'informe', metadata: { contains: `"ticketId":"${id}"` } },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const linkedInformes = allInformes.map(d => ({
    id: d.id,
    title: d.title,
    createdAt: d.createdAt.toISOString(),
  }))

  const urgency = ticket.urgency as TicketUrgencyId
  const status = ticket.status as TicketStatusId

  const publicHistory = ticket.history.filter((h) => !h.isInternal)
  const internalHistory = ticket.history.filter((h) => h.isInternal)

  return (
    <div className="max-w-5xl space-y-6">
      {/* Back */}
      <Link href="/tickets" className="inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4"/></svg>
        Volver a tickets
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Client / branch / portal */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-gray-900 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                {ticket.client.name}
              </span>
              {ticket.branch && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 14S3.5 10.2 3.5 6.5a4.5 4.5 0 0 1 9 0C12.5 10.2 8 14 8 14z" stroke="currentColor" strokeWidth="1.5"/></svg>
                  {ticket.branch.name}{ticket.branch.city ? `, ${ticket.branch.city}` : ''}
                </span>
              )}
              {ticket.client.portalSlug && (
                <Link href={`/portal/${ticket.client.portalSlug}`} target="_blank" className="text-xs text-brand hover:underline">
                  Ver portal →
                </Link>
              )}
            </div>

            <p className="mb-1 font-mono text-xs text-gray-400">{ticket.ticketCode}</p>
            <h1 className="text-xl font-bold text-ink">{ticket.title}</h1>
            {ticket.description && <p className="mt-1 text-sm text-gray-600">{ticket.description}</p>}
            {ticket.clientComment && (
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <p className="mb-0.5 text-xs font-semibold text-blue-600">Comentario del cliente</p>
                <p className="text-sm text-blue-800">{ticket.clientComment}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${URGENCY_COLOR[urgency]}`}>
              {URGENCY_LABEL[urgency]}
            </span>
            {ticket.otNumber && (
              <span className="rounded-full bg-gray-100 px-3 py-1 font-mono text-xs text-gray-600">
                OT: {ticket.otNumber}
              </span>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-xs sm:grid-cols-4">
          <div>
            <p className="text-gray-400">Creado por</p>
            <p className="font-medium text-gray-700">{ticket.createdBy.name}</p>
          </div>
          <div>
            <p className="text-gray-400">Asignado a</p>
            {ticket.assignedTo?.technician?.id ? (
              <Link
                href={`/recursos/tecnicos/${ticket.assignedTo.technician.id}`}
                className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
              >
                {ticket.assignedTo.name}
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h8M6 2l4 4-4 4"/></svg>
              </Link>
            ) : (
              <p className={`font-medium ${ticket.assignedTo ? 'text-gray-700' : 'text-amber-600'}`}>
                {ticket.assignedTo?.name ?? 'Sin asignar'}
              </p>
            )}
          </div>
          <div>
            <p className="text-gray-400">Fecha estimada</p>
            <p className="font-medium text-gray-700">
              {ticket.estimatedDate ? new Date(ticket.estimatedDate).toLocaleDateString('es-CL') : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Adjuntos</p>
            <p className="font-medium text-gray-700">
              {ticket.documents.length > 0
                ? `${ticket.documents.length} archivo${ticket.documents.length > 1 ? 's' : ''}`
                : '—'}
            </p>
          </div>
        </div>

        {ticket.workSummary && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="mb-1 text-xs font-semibold text-green-700">Resumen del trabajo</p>
            <p className="text-sm text-green-800">{ticket.workSummary}</p>
          </div>
        )}
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: controls */}
        <div className="space-y-5 lg:col-span-2">
          <TicketControls
            ticket={{
              id: ticket.id,
              status: ticket.status,
              otNumber: ticket.otNumber,
              assignedToId: ticket.assignedToId,
              estimatedDate: ticket.estimatedDate?.toISOString().split('T')[0] ?? null,
              workSummary: ticket.workSummary,
              internalNotes: ticket.internalNotes,
              folderKey: ticket.folderKey,
              showToClient: ticket.showToClient,
              items: ticket.items,
              documents: ticket.documents,
            }}
            staffUsers={staffUsers}
            technicians={technicians}
            linkedInformes={linkedInformes}
          />
        </div>

        {/* Right: history */}
        <div className="space-y-4">
          <HistoryPanel events={publicHistory} title="Historial de actividad" variant="public" />
          {internalHistory.length > 0 && (
            <HistoryPanel events={internalHistory} title="Notas internas" variant="internal" />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── HistoryEvent type ── */

type HistoryEvent = {
  id: string
  note: string | null
  fromStatus: string | null
  toStatus: string | null
  isInternal: boolean
  createdAt: Date
  user: { id: string; name: string } | null
}

/* ── History helpers ── */

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

function filterHistory(events: HistoryEvent[]): HistoryEvent[] {
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

/* ── History panel ── */

function HistoryPanel({
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

/* ── Note renderer ── */

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

/* ── Date formatting ── */

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
