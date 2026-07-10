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
import { PortalApprovalActions } from '@/components/tickets/portal-approval-actions'
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

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11L5 7l4-4"/></svg>
}
function IconUser() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="5" r="2.5"/><path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5"/></svg>
}
function IconCalendar() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="2.5" width="11" height="10" rx="1.5"/><path d="M5 1v3M9 1v3M1.5 6h11"/></svg>
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

  // Branch users can only view tickets from their own branch
  const userBranchId = session?.user?.branchId ?? null
  const isClientAdmin = session?.user?.isClientAdmin ?? false
  if (userBranchId && !isClientAdmin && ticket.branch?.id && ticket.branch.id !== userBranchId) {
    redirect(`/portal/${slug}/tickets`)
  }

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

  const isPendingApproval = ticket.status === 'pendiente_aprobacion'
  const si = STEPS.indexOf(ticket.status)
  const isResolved = ['resuelto', 'cancelado'].includes(ticket.status)
  const isCancelled = ticket.status === 'cancelado'
  const canComment = !isStaffViewing(session) && !isResolved && !isPendingApproval
  const isClientViewing = !isStaffViewing(session) && session?.user?.role === 'client'
  const canEdit = isClientViewing && ticket.status === 'nuevo'
  const canAddItems = isClientViewing && ['nuevo', 'en_revision'].includes(ticket.status)
  const canApprove = isClientAdmin && isPendingApproval

  const mediaDocs = signedDocs.filter(d => isMedia(d.mimeType))
  const fileDocs  = signedDocs.filter(d => !isMedia(d.mimeType))

  const backLink = (
    <Link href={`/portal/${slug}/tickets`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--t2)', textDecoration: 'none', fontWeight: '500' }}>
      <IconArrowLeft />
      Mis solicitudes
    </Link>
  )

  const visibleHistory = filterPortalHistory(ticket.history)
  const chronological = [...visibleHistory].reverse() // oldest first → chat order

  return (
    <PortalShell slug={slug} clientName={client.name} userName={session!.user.name ?? 'Usuario'} primary={acc}
      bg={theme.bg} cardBg={theme.card} textColor={theme.text}
      activeHref={`/portal/${slug}/tickets`} topbarTitle={ticket.title} topbarSub={ticket.ticketCode} topbarRight={backLink}
      isAdmin={isStaffViewing(session)}>

      <div className="pg" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── HERO: título + progreso + meta ────────────────────────────── */}
        <div className="pcard" style={{ padding: '20px 22px' }}>
          {/* Meta chips: code + OT + category */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t3)', fontFamily: 'ui-monospace, monospace' }}>{ticket.ticketCode}</span>
              {ticket.otNumber && <span style={{ fontSize: '11px', color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '6px', padding: '1px 7px' }}>OT {ticket.otNumber}</span>}
              {ticket.category && <span style={{ fontSize: '11px', color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '6px', padding: '1px 7px' }}>{ticket.category}</span>}
            </div>
            <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
              <span className={UB[ticket.urgency] ?? 'badge'} style={{ fontSize: '11px' }}>{UL[ticket.urgency] ?? ticket.urgency}</span>
              <span className={SB[ticket.status] ?? 'badge'} style={{ fontSize: '11px' }}>{SL[ticket.status] ?? ticket.status}</span>
            </div>
          </div>

          {/* Título */}
          <h1 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--tx)', lineHeight: '1.35', margin: '0 0 16px' }}>{ticket.title}</h1>

          {/* Progreso — solo tickets en curso (no resuelto/cancelado/pendiente_aprobacion) */}
          {si >= 0 && !isResolved && !isPendingApproval && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ position: 'absolute', top: '6px', left: '6px', right: '6px', height: '2px', background: 'var(--bd)', zIndex: 0 }} />
                <div style={{ position: 'absolute', top: '6px', left: '6px', height: '2px', background: acc, zIndex: 0, transition: 'width 0.5s', width: si === 0 ? '0%' : `calc(${(si / (STEPS.length - 1)) * 100}% - 12px)` }} />
                {STEPS.map((s, i) => (
                  <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: i <= si ? acc : 'var(--bg)', border: `2px solid ${i <= si ? acc : 'var(--bd2)'}`, boxShadow: i === si ? `0 0 0 3px ${acc}28` : 'none', transition: 'all 0.3s' }} />
                    <span style={{ fontSize: '10px', fontWeight: i === si ? '700' : '500', color: i === si ? acc : i < si ? 'var(--t2)' : 'var(--t3)', whiteSpace: 'nowrap' }}>{SLBL[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta chips: técnico + sucursal + fecha */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg)', borderRadius: '30px', border: '1px solid var(--bd)' }}>
              <IconUser />
              <span style={{ fontSize: '12px', color: ticket.assignedTo ? 'var(--tx)' : 'var(--t3)', fontWeight: '500' }}>{ticket.assignedTo?.name ?? 'Por asignar'}</span>
            </div>
            {ticket.branch?.name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'var(--bg)', borderRadius: '30px', border: '1px solid var(--bd)' }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="5.5" r="2"/><path d="M7 13S2.5 9.5 2.5 5.5a4.5 4.5 0 019 0C11.5 9.5 7 13 7 13z"/></svg>
                <span style={{ fontSize: '12px', color: 'var(--t2)', fontWeight: '500' }}>{ticket.branch.name}</span>
              </div>
            )}
            {ticket.estimatedDate ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: `color-mix(in srgb, ${acc} 10%, white)`, borderRadius: '30px', border: `1px solid color-mix(in srgb, ${acc} 20%, transparent)` }}>
                <IconCalendar />
                <span style={{ fontSize: '12px', color: 'var(--tx)', fontWeight: '600' }}>{new Date(ticket.estimatedDate).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg)', borderRadius: '30px', border: '1px solid var(--bd)' }}>
                <IconCalendar />
                <span style={{ fontSize: '12px', color: 'var(--t3)', fontWeight: '500' }}>{new Date(ticket.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── PENDIENTE APROBACIÓN (sucursal) ──────────────────────────── */}
        {isPendingApproval && !isClientAdmin && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 'var(--r2)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><circle cx="10" cy="10" r="9" stroke="#f59e0b" strokeWidth="2"/><path d="M10 6v4M10 13v1" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/></svg>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', margin: 0 }}>Pendiente de aprobación</p>
              <p style={{ fontSize: '12px', color: '#b45309', margin: '2px 0 0' }}>El administrador revisará tu solicitud y te notificaremos cuando sea aprobada.</p>
            </div>
          </div>
        )}

        {/* ── ACCIONES DE APROBACIÓN (Carolina) ────────────────────────── */}
        {canApprove && <PortalApprovalActions ticketId={ticket.id} slug={slug} primary={acc} />}

        {/* ── RESUELTO / CANCELADO ─────────────────────────────────────── */}
        {ticket.status === 'resuelto' && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--r2)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#22c55e', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3.5 9l3.5 4L14.5 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#15803d', margin: 0 }}>Solicitud resuelta</p>
              {ticket.closedDate && <p style={{ fontSize: '12px', color: '#166534', margin: '2px 0 0' }}>Cerrada el {new Date(ticket.closedDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
            </div>
          </div>
        )}
        {isCancelled && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 'var(--r2)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#9ca3af', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#374151', margin: 0 }}>Solicitud cancelada</p>
              {ticket.closedDate && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>Fecha: {new Date(ticket.closedDate).toLocaleDateString('es-CL')}</p>}
            </div>
          </div>
        )}

        {/* ── RESUMEN DEL TRABAJO ──────────────────────────────────────── */}
        {ticket.workSummary && (
          <div style={{ background: `color-mix(in srgb, ${acc} 7%, white)`, border: `1px solid color-mix(in srgb, ${acc} 20%, transparent)`, borderRadius: 'var(--r2)', padding: '16px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: acc, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Resumen del trabajo</p>
            <p style={{ fontSize: '14px', color: 'var(--tx)', lineHeight: '1.65', whiteSpace: 'pre-wrap', margin: 0 }}>{ticket.workSummary}</p>
          </div>
        )}

        {/* ── DESCRIPCIÓN ─────────────────────────────────────────────── */}
        {(ticket.description || ticket.clientComment) && (
          <div className="pcard" style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Descripción</p>
            {ticket.description && <p style={{ fontSize: '14px', color: 'var(--tx)', lineHeight: '1.65', whiteSpace: 'pre-wrap', margin: 0 }}>{ticket.description}</p>}
            {ticket.clientComment && (
              <div style={{ marginTop: ticket.description ? '12px' : '0', paddingTop: ticket.description ? '12px' : '0', borderTop: ticket.description ? '1px solid var(--bd)' : 'none' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--t3)', marginBottom: '6px' }}>Comentario adicional</p>
                <p style={{ fontSize: '14px', color: 'var(--tx)', lineHeight: '1.65', whiteSpace: 'pre-wrap', margin: 0 }}>{ticket.clientComment}</p>
              </div>
            )}
          </div>
        )}

        {/* ── SUB-TAREAS ──────────────────────────────────────────────── */}
        {(ticket.items.length > 0 || canAddItems) && (
          <div className="pcard" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>Trabajos</p>
              {ticket.items.length > 0 && <span style={{ fontSize: '11px', color: 'var(--t3)', fontWeight: '600' }}>{ticket.items.filter(i => i.status === 'resuelto').length}/{ticket.items.length} listos</span>}
            </div>
            {ticket.items.length > 0 && (
              <>
                <div style={{ height: '4px', background: 'var(--bd)', borderRadius: '4px', marginBottom: '14px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '4px', background: acc, width: `${(ticket.items.filter(i => i.status === 'resuelto').length / ticket.items.length) * 100}%`, transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)' }} />
                </div>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: canAddItems ? '14px' : '0' }}>
                  {ticket.items.map(item => (
                    <li key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, marginTop: '2px', background: item.status === 'resuelto' ? '#22c55e' : 'var(--bg)', border: item.status === 'resuelto' ? '2px solid #22c55e' : '2px solid var(--bd2)', display: 'grid', placeItems: 'center' }}>
                        {item.status === 'resuelto' && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', color: item.status === 'resuelto' ? 'var(--t3)' : 'var(--tx)', fontWeight: '500', textDecoration: item.status === 'resuelto' ? 'line-through' : 'none', lineHeight: '1.4', margin: 0 }}>{item.title}</p>
                        {item.description && <p style={{ fontSize: '12px', color: 'var(--t3)', margin: '2px 0 0' }}>{item.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {ticket.items.length === 0 && canAddItems && <p style={{ fontSize: '13px', color: 'var(--t3)', margin: '0 0 12px' }}>Sin sub-tareas aún.</p>}
            {canAddItems && <PortalTicketActions ticketId={ticket.id} canEdit={false} canAddItems={true} initialTitle={ticket.title} initialDescription={ticket.description ?? ''} initialUrgency={ticket.urgency} primary={acc} />}
          </div>
        )}

        {canEdit && <PortalTicketActions ticketId={ticket.id} canEdit={true} canAddItems={false} initialTitle={ticket.title} initialDescription={ticket.description ?? ''} initialUrgency={ticket.urgency} primary={acc} />}

        {/* ── CONVERSACIÓN ────────────────────────────────────────────── */}
        <div className="pcard" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H2a1 1 0 00-1 1v7a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V4a1 1 0 00-1-1z"/></svg>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>Conversación</p>
            {chronological.length > 0 && <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '1px 7px', marginLeft: 'auto' }}>{chronological.length}</span>}
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {chronological.length === 0 && !canComment && (
              <p style={{ fontSize: '13px', color: 'var(--t3)', textAlign: 'center', padding: '12px 0', margin: 0 }}>Sin actividad aún.</p>
            )}
            {chronological.map((h) => {
              const isStatusChange = !!(h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus)
              const isCreation = !h.fromStatus && !!h.toStatus
              const rawNote = h.note ? cleanPortalNote(h.note) : null
              const displayNote = rawNote && !rawNote.startsWith('{') ? rawNote : null
              const isBoringNote = !!displayNote && /^solicitud (creada|registrada|por sucursal)/i.test(displayNote.trim())
              const isMyMsg = h.user?.id === session?.user?.id

              // Creation event → subtle centered pill
              if (isCreation && (!displayNote || isBoringNote)) {
                return (
                  <div key={h.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', margin: '2px 0' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: `color-mix(in srgb, ${acc} 8%, white)`, border: `1px solid color-mix(in srgb, ${acc} 20%, transparent)`, borderRadius: '20px', padding: '4px 12px' }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={acc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 5l2.5 2.5L8.5 2"/></svg>
                      <span style={{ fontSize: '11px', color: acc, fontWeight: '700' }}>Solicitud recibida</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--t3)' }}>{relativeTime(new Date(h.createdAt))}</span>
                  </div>
                )
              }

              // Status change without note → centered transition pill
              if (isStatusChange && (!displayNote || isBoringNote)) {
                const fromLbl = SL[h.fromStatus!] ?? h.fromStatus
                const toLbl   = SL[h.toStatus!]   ?? h.toStatus
                if (fromLbl === toLbl) return null
                return (
                  <div key={h.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', margin: '2px 0' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '20px', padding: '4px 12px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--t3)' }}>{fromLbl}</span>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5h6M6 2l3 3-3 3"/></svg>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--tx)' }}>{toLbl}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--t3)' }}>{relativeTime(new Date(h.createdAt))}</span>
                  </div>
                )
              }

              // Comment / note with optional status context → chat bubble
              if (!displayNote || isBoringNote) return null
              return (
                <div key={h.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMyMsg ? 'flex-end' : 'flex-start', gap: '4px' }}>
                  {isStatusChange && SL[h.fromStatus!] !== SL[h.toStatus!] && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '12px', padding: '2px 9px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--t3)' }}>{SL[h.fromStatus!] ?? h.fromStatus} → {SL[h.toStatus!] ?? h.toStatus}</span>
                    </div>
                  )}
                  <div style={{ maxWidth: '82%', background: isMyMsg ? `color-mix(in srgb, ${acc} 12%, white)` : 'white', border: `1px solid ${isMyMsg ? `color-mix(in srgb, ${acc} 25%, transparent)` : 'var(--bd)'}`, borderRadius: isMyMsg ? '14px 14px 3px 14px' : '14px 14px 14px 3px', padding: '10px 14px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--tx)', lineHeight: '1.55', whiteSpace: 'pre-wrap', margin: 0 }}>{displayNote}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', fontSize: '10px', color: 'var(--t3)', alignItems: 'center' }}>
                    {!isMyMsg && h.user?.name && <><span style={{ fontWeight: '600' }}>{h.user.name}</span><span>·</span></>}
                    <span>{relativeTime(new Date(h.createdAt))}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {canComment && (
            <div style={{ borderTop: '1px solid var(--bd)', padding: '14px 20px', background: 'var(--bg)' }}>
              <PortalCommentForm ticketId={ticket.id} primary={acc} inline />
            </div>
          )}
        </div>

        {/* ── FOTOS Y VIDEOS ──────────────────────────────────────────── */}
        {mediaDocs.length > 0 && (
          <div className="pcard" style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Fotos y videos <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '1px 7px' }}>{mediaDocs.length}</span>
            </p>
            <PhotoGallery items={mediaDocs.map(doc => ({ id: doc.id, name: doc.name, url: doc.viewUrl, mimeType: doc.mimeType }))} accent={acc} />
          </div>
        )}

        {/* ── ARCHIVOS ADJUNTOS ───────────────────────────────────────── */}
        {fileDocs.length > 0 && (
          <div className="pcard" style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Archivos <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '1px 7px' }}>{fileDocs.length}</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {fileDocs.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--r)', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{fileIcon(doc.mimeType, doc.name)}</span>
                    <span style={{ fontSize: '13px', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                  </div>
                  <a href={doc.viewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', fontWeight: '600', color: acc, textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    Ver <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={acc} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9L9 3M9 3H5M9 3v4"/></svg>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INFORMES TÉCNICOS ───────────────────────────────────────── */}
        {linkedInformes.length > 0 && (
          <div className="pcard" style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--t2)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Informes técnicos <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '10px', padding: '1px 7px' }}>{linkedInformes.length}</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {linkedInformes.map(inf => (
                <PortalInformeBtn key={inf.id} docId={inf.id} title={inf.title} primary={acc}
                  date={new Date(inf.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })} />
              ))}
            </div>
          </div>
        )}

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
