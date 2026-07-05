'use server'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClientTicket } from '@/lib/tickets/tickets'
import { canViewPortal, isStaffViewing } from '@/lib/portal-auth'
import { getPresignedUrl, isR2Key } from '@/lib/r2'
import { PortalShell } from '@/components/tickets/portal-shell'
import { PortalCommentForm } from '@/components/tickets/portal-comment-form'
import { PortalTicketActions } from '@/components/tickets/portal-ticket-actions'
import { PortalInformeBtn } from '@/components/tickets/portal-informe-btn'
import { PhotoGallery } from '@/components/tickets/photo-gallery'
import { resolvePortalTheme } from '@/lib/portal-theme'
import {
  PORTAL_STATUS_BADGE as SB,
  PORTAL_STATUS_SHORT as SL,
  PORTAL_URGENCY_BADGE as UB,
  PORTAL_URGENCY_SHORT as UL,
  PROGRESS_STEPS as STEPS,
  PROGRESS_STEPS_LABEL as SLBL,
} from '@/lib/tickets/labels'

/* ── Helpers ── */
function isImage(mime: string | null | undefined) {
  return !!mime?.startsWith('image/')
}
function isVideo(mime: string | null | undefined) {
  return !!mime?.startsWith('video/')
}
function isMedia(mime: string | null | undefined) {
  return isImage(mime) || isVideo(mime)
}
function fileIcon(mimeType: string | null | undefined, name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mimeType?.includes('pdf') || ext === 'pdf') return '📄'
  if (mimeType?.includes('word') || ['doc', 'docx'].includes(ext)) return '📝'
  if (mimeType?.includes('excel') || mimeType?.includes('sheet') || ['xls', 'xlsx'].includes(ext)) return '📊'
  if (mimeType?.includes('zip') || ['zip', 'rar', '7z'].includes(ext)) return '🗜️'
  return '📎'
}

/* ── History filtering (mirrors internal app logic) ── */
type HistoryItem = {
  id: string
  note: string | null
  fromStatus: string | null
  toStatus: string | null
  createdAt: Date
  user: { id: string; name: string } | null
}

function parseNoteJson(note: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(note)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as Record<string, unknown>
  } catch { /* ignore */ }
  return null
}

function isNoisyPortalEntry(h: HistoryItem): boolean {
  if (h.fromStatus && h.toStatus && h.fromStatus === h.toStatus) return true
  if (h.note) {
    const obj = parseNoteJson(h.note)
    if (obj) {
      if ('parentId' in obj) return true
      if ('item_order' in obj) return true
      if (obj.createdBy === 'sistema') return true
    }
  }
  return false
}

function filterPortalHistory(events: HistoryItem[]): HistoryItem[] {
  const visible = events.filter(h => !isNoisyPortalEntry(h))
  let seenCreation = false
  return visible.filter(h => {
    const cleaned = h.note?.replace(/^\[CREADO\]\s*\n?/i, '').trim()
    if (cleaned === 'Requerimiento creado' || cleaned === 'Ticket creado') {
      if (seenCreation) return false
      seenCreation = true
    }
    return true
  })
}

function cleanPortalNote(note: string): string {
  return note.replace(/^\[CREADO\]\s*\n?/i, '').trim()
}

function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs === 1 ? 'hace 1 hora' : `hace ${hrs} horas`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

function IconCheck() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l2.8 2.8L10 3"/></svg>
}
function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11L5 7l4-4"/></svg>
}
function IconClock() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="4.5"/><path d="M6 3.5V6l1.5 1.5"/></svg>
}
function IconUser() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="5" r="2.5"/><path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5"/></svg>
}
function IconCalendar() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="2.5" width="11" height="10" rx="1.5"/><path d="M5 1v3M9 1v3M1.5 6h11"/></svg>
}
function IconReport() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3M5 7h6M5 10h4"/></svg>
}

export default async function PortalTicketDetailPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const session = await auth()

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const ticket = await getClientTicket(client.id, id)
  if (!ticket) notFound()

  // Pre-sign document URLs (1h expiry)
  const signedDocs = await Promise.all(
    ticket.documents.map(async (doc) => ({
      ...doc,
      viewUrl: isR2Key(doc.fileUrl) ? await getPresignedUrl(doc.fileUrl, 3600) : doc.fileUrl,
    })),
  )

  // Informes técnicos vinculados a este ticket (en metadata)
  const linkedInformes = await prisma.clientDocument.findMany({
    where: { clientId: client.id, type: 'informe', metadata: { contains: `"ticketId":"${id}"` } },
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  const theme = resolvePortalTheme(client.portalTheme)
  const acc = theme.primary

  const si = STEPS.indexOf(ticket.status)
  const isResolved = ['resuelto', 'cancelado'].includes(ticket.status)
  const isCancelled = ticket.status === 'cancelado'
  const canComment = !isStaffViewing(session) && !isResolved
  const isClientViewing = !isStaffViewing(session) && session?.user?.role === 'client'
  const canEdit = isClientViewing && ticket.status === 'nuevo'
  const canAddItems = isClientViewing && ['nuevo', 'en_revision'].includes(ticket.status)

  const mediaDocs = signedDocs.filter(d => isMedia(d.mimeType))
  const fileDocs  = signedDocs.filter(d => !isMedia(d.mimeType))

  const backLink = (
    <Link href={`/portal/${slug}/tickets`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--t2)', textDecoration: 'none', fontWeight: '500' }}>
      <IconArrowLeft />
      Mis solicitudes
    </Link>
  )

  return (
    <PortalShell slug={slug} clientName={client.name} userName={session!.user.name ?? 'Usuario'} primary={acc}
      bg={theme.bg} cardBg={theme.card} textColor={theme.text}
      activeHref={`/portal/${slug}/tickets`} topbarTitle={ticket.title} topbarSub={ticket.ticketCode} topbarRight={backLink}
      isAdmin={isStaffViewing(session)}>

      <div className="pg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── HERO CARD: estado + datos clave ─────────────────────────── */}
        <div className="pcard" style={{ padding: '20px 22px' }}>

          {/* Título + badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '16px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '4px' }}>{ticket.ticketCode}</p>
              <h1 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--tx)', lineHeight: '1.35', margin: 0 }}>{ticket.title}</h1>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
              <span className={UB[ticket.urgency] ?? 'badge'} style={{ fontSize: '11px' }}>{UL[ticket.urgency] ?? ticket.urgency}</span>
              <span className={SB[ticket.status] ?? 'badge'} style={{ fontSize: '11px' }}>{SL[ticket.status] ?? ticket.status}</span>
            </div>
          </div>

          {/* Chips: técnico + fecha estimada */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', background: 'var(--bg)', borderRadius: '40px', border: '1px solid var(--bd)' }}>
              <IconUser />
              <span style={{ fontSize: '13px', color: ticket.assignedTo ? 'var(--tx)' : 'var(--t3)', fontWeight: '500' }}>
                {ticket.assignedTo?.name ?? 'Por asignar'}
              </span>
            </div>
            {ticket.estimatedDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', background: `color-mix(in srgb, ${acc} 10%, white)`, borderRadius: '40px', border: `1px solid color-mix(in srgb, ${acc} 25%, transparent)` }}>
                <IconCalendar />
                <span style={{ fontSize: '13px', color: 'var(--tx)', fontWeight: '600' }}>
                  {new Date(ticket.estimatedDate).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'long' })}
                </span>
              </div>
            )}
            {ticket.branch?.name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg)', borderRadius: '40px', border: '1px solid var(--bd)' }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="5.5" r="2"/><path d="M7 13S2.5 9.5 2.5 5.5a4.5 4.5 0 019 0C11.5 9.5 7 13 7 13z"/></svg>
                <span style={{ fontSize: '13px', color: 'var(--t2)', fontWeight: '500' }}>{ticket.branch.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── DETALLES DEL REQUERIMIENTO ─────────────────────────────── */}
        <div className="pcard" style={{ padding: '18px 22px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Detalles del requerimiento
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Código</p>
              <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--tx)', fontFamily: 'ui-monospace, monospace' }}>{ticket.ticketCode}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>N° OT</p>
              <p style={{ fontSize: '13px', fontWeight: '600', color: ticket.otNumber ? 'var(--tx)' : 'var(--t3)' }}>{ticket.otNumber ?? '—'}</p>
            </div>
            {ticket.category && (
              <div>
                <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Categoría</p>
                <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--tx)' }}>{ticket.category}</p>
              </div>
            )}
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Fecha de solicitud</p>
              <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--tx)' }}>
                {new Date(ticket.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* ── PROGRESO ─────────────────────────────────────────────────── */}
        {si >= 0 && !isResolved && (
          <div className="pcard" style={{ padding: '18px 22px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Estado del requerimiento
            </p>
            <div className="psteps">
              {STEPS.map((s, i) => {
                const state = i < si ? 'done' : i === si ? 'current' : ''
                return (
                  <div key={s} className={`pstep-wrap${state ? ' ' + state : ''}`}>
                    <div className="pstep-circle">
                      {i < si ? <IconCheck /> : <span>{i + 1}</span>}
                    </div>
                    <span className="pstep-label">{SLBL[i]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── RESUELTO / CANCELADO ─────────────────────────────────────── */}
        {ticket.status === 'resuelto' && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--r2)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#22c55e', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><path d="M3.5 9l3.5 4L14.5 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: '700', color: '#15803d' }}>Solicitud resuelta</p>
              {ticket.closedDate && <p style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>Cerrada el {new Date(ticket.closedDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
            </div>
          </div>
        )}
        {isCancelled && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 'var(--r2)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#9ca3af', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4L4 12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: '700', color: '#374151' }}>Solicitud cancelada</p>
              {ticket.closedDate && <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Fecha: {new Date(ticket.closedDate).toLocaleDateString('es-CL')}</p>}
            </div>
          </div>
        )}

        {/* ── RESUMEN DEL TRABAJO ──────────────────────────────────────── */}
        {ticket.workSummary && (
          <div style={{ background: `color-mix(in srgb, ${acc} 7%, white)`, border: `1px solid color-mix(in srgb, ${acc} 20%, transparent)`, borderRadius: 'var(--r2)', padding: '18px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: acc, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Resumen del trabajo realizado
            </p>
            <p style={{ fontSize: '14px', color: 'var(--tx)', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{ticket.workSummary}</p>
          </div>
        )}

        {/* ── DESCRIPCIÓN ─────────────────────────────────────────────── */}
        {(ticket.description || ticket.clientComment) && (
          <div className="pcard" style={{ padding: '18px 20px' }}>
            {ticket.description && (
              <>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Descripción</p>
                <p style={{ fontSize: '14px', color: 'var(--tx)', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
              </>
            )}
            {ticket.clientComment && (
              <div style={{ marginTop: ticket.description ? '14px' : '0', paddingTop: ticket.description ? '14px' : '0', borderTop: ticket.description ? '1px solid var(--bd)' : 'none' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Comentario adicional</p>
                <p style={{ fontSize: '14px', color: 'var(--tx)', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{ticket.clientComment}</p>
              </div>
            )}
          </div>
        )}

        {/* ── SUB-TAREAS ──────────────────────────────────────────────── */}
        {(ticket.items.length > 0 || canAddItems) && (
          <div className="pcard" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Trabajos</p>
              {ticket.items.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--t3)', fontWeight: '600' }}>
                  {ticket.items.filter(i => i.status === 'resuelto').length}/{ticket.items.length} completados
                </span>
              )}
            </div>
            {ticket.items.length > 0 && (
              <>
                <div style={{ height: '5px', background: 'var(--bd)', borderRadius: '5px', marginBottom: '14px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '5px',
                    background: `linear-gradient(90deg, ${acc}, color-mix(in srgb, ${acc} 70%, #22c55e))`,
                    width: `${(ticket.items.filter(i => i.status === 'resuelto').length / ticket.items.length) * 100}%`,
                    transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: canAddItems ? '14px' : '0' }}>
                  {ticket.items.map(item => (
                    <li key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0, marginTop: '1px',
                        background: item.status === 'resuelto' ? '#22c55e' : 'var(--bg)',
                        border: item.status === 'resuelto' ? '2px solid #22c55e' : '2px solid var(--bd2)',
                        display: 'grid', placeItems: 'center',
                      }}>
                        {item.status === 'resuelto' && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', color: item.status === 'resuelto' ? 'var(--t3)' : 'var(--tx)', fontWeight: '500', textDecoration: item.status === 'resuelto' ? 'line-through' : 'none', lineHeight: '1.4' }}>
                          {item.title}
                        </p>
                        {item.description && <p style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>{item.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {ticket.items.length === 0 && canAddItems && (
              <p style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '12px' }}>Sin sub-tareas aún.</p>
            )}
            {canAddItems && (
              <PortalTicketActions ticketId={ticket.id} canEdit={false} canAddItems={true}
                initialTitle={ticket.title} initialDescription={ticket.description ?? ''} initialUrgency={ticket.urgency} primary={acc} />
            )}
          </div>
        )}

        {canEdit && (
          <PortalTicketActions ticketId={ticket.id} canEdit={true} canAddItems={false}
            initialTitle={ticket.title} initialDescription={ticket.description ?? ''} initialUrgency={ticket.urgency} primary={acc} />
        )}

        {/* ── FOTOS Y VIDEOS ──────────────────────────────────────────── */}
        {mediaDocs.length > 0 && (
          <div className="pcard" style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Fotos y videos
              <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '600', color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '1px 7px' }}>
                {mediaDocs.length}
              </span>
            </p>
            <PhotoGallery
              items={mediaDocs.map(doc => ({ id: doc.id, name: doc.name, url: doc.viewUrl, mimeType: doc.mimeType }))}
              accent={acc}
            />
          </div>
        )}

        {/* ── ARCHIVOS ADJUNTOS ───────────────────────────────────────── */}
        {fileDocs.length > 0 && (
          <div className="pcard" style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Archivos adjuntos
              <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '600', color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '1px 7px' }}>
                {fileDocs.length}
              </span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {fileDocs.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--r)', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{fileIcon(doc.mimeType, doc.name)}</span>
                    <span style={{ fontSize: '13px', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                  </div>
                  <a href={doc.viewUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '12px', fontWeight: '600', color: acc, textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    Ver
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={acc} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9L9 3M9 3H5M9 3v4"/></svg>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INFORMES TÉCNICOS ───────────────────────────────────────── */}
        {linkedInformes.length > 0 && (
          <div className="pcard" style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Informes técnicos
              <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '600', color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '1px 7px' }}>
                {linkedInformes.length}
              </span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {linkedInformes.map(inf => (
                <PortalInformeBtn
                  key={inf.id}
                  docId={inf.id}
                  title={inf.title}
                  primary={acc}
                  date={new Date(inf.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── ACTIVIDAD + COMENTAR ────────────────────────────────────── */}
        {(() => {
          const visibleHistory = filterPortalHistory(ticket.history)
          return (
            <div className="pcard" style={{ padding: '18px 20px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Actividad
                {visibleHistory.length > 0 && (
                  <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '600', color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '1px 7px' }}>
                    {visibleHistory.length}
                  </span>
                )}
              </p>

              {canComment && (
                <div style={{ marginBottom: '20px' }}>
                  <PortalCommentForm ticketId={ticket.id} primary={acc} />
                </div>
              )}

              {visibleHistory.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--t3)' }}>Sin actividad registrada aún.</p>
              ) : (
                <div className="timeline" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {visibleHistory.map((h, i) => {
                    const isMyMsg = h.user?.id === session?.user?.id
                    const isStatusUpdate = !!(h.fromStatus && h.toStatus)
                    // Don't show backwards / noisy transitions that passed the filter but have same label
                    const fromLabel = h.fromStatus ? (SL[h.fromStatus] ?? h.fromStatus) : null
                    const toLabel   = h.toStatus   ? (SL[h.toStatus]   ?? h.toStatus)   : null
                    const noteText  = h.note ? cleanPortalNote(h.note) : null
                    // Skip notes that are pure JSON (field left after partial filter)
                    const isJsonNote = !!noteText && noteText.startsWith('{')
                    const displayNote = isJsonNote ? null : noteText

                    return (
                      <div key={h.id} className="tl-item">
                        <div
                          className={`tl-dot${i === 0 ? ' tl-dot-acc' : h.toStatus === 'resuelto' ? ' tl-dot-green' : isMyMsg ? ' tl-dot-blue' : ''}`}
                          style={{ background: i === 0 ? acc : undefined }}
                        />
                        <div style={{ flex: 1 }}>
                          {isMyMsg && (
                            <p style={{ fontSize: '10px', fontWeight: '700', color: acc, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>
                              Tu mensaje
                            </p>
                          )}
                          {isStatusUpdate && fromLabel !== toLabel && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '20px', padding: '3px 10px', marginBottom: displayNote ? '6px' : '0' }}>
                              <span style={{ fontSize: '11px', color: 'var(--t3)' }}>{fromLabel}</span>
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5h6M6 2l3 3-3 3"/></svg>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--tx)' }}>{toLabel}</span>
                            </div>
                          )}
                          {displayNote && (
                            <p style={{ fontSize: '13px', color: 'var(--tx)', lineHeight: '1.55', whiteSpace: 'pre-wrap' }}>{displayNote}</p>
                          )}
                          <p style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IconClock />
                            {relativeTime(new Date(h.createdAt))}
                            {h.user?.name && !isMyMsg && <span style={{ marginLeft: '4px' }}>· {h.user.name}</span>}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── PIE ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '16px' }}>
          <Link href={`/portal/${slug}/tickets`} className="pbtn pbtn-ghost" style={{ textDecoration: 'none' }}>
            ← Volver a mis solicitudes
          </Link>
        </div>
      </div>
    </PortalShell>
  )
}
