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
import { resolvePortalTheme } from '@/lib/portal-theme'
import {
  PORTAL_STATUS_BADGE as SB,
  PORTAL_STATUS_SHORT as SL,
  PORTAL_URGENCY_BADGE as UB,
  PORTAL_URGENCY_SHORT as UL,
  PROGRESS_STEPS as STEPS,
  PROGRESS_STEPS_LABEL as SLBL,
} from '@/lib/tickets/labels'

// SVG icons — no emojis
function IconCheck() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l2.8 2.8L10 3"/></svg>
}
function IconDoc() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/><path d="M9 2v4h4M5 9h6M5 12h4"/></svg>
}
function IconFolder() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4a1 1 0 011-1h4l2 2h4a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V4z"/></svg>
}
function IconClock() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="4.5"/><path d="M6 3.5V6l1.5 1.5"/></svg>
}
function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11L5 7l4-4"/></svg>
}

function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins <= 1 ? 'hace un momento' : `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs === 1 ? 'hace 1 hora' : `hace ${hrs} horas`
  const days = Math.floor(hrs / 24)
  if (days < 7) return days === 1 ? 'ayer' : `hace ${days} días`
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
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

  // Pre-sign document URLs server-side (1h expiry, never exposed as static paths)
  const signedDocs = await Promise.all(
    ticket.documents.map(async (doc) => ({
      ...doc,
      viewUrl: isR2Key(doc.fileUrl) ? await getPresignedUrl(doc.fileUrl, 3600) : doc.fileUrl,
    })),
  )

  const theme = resolvePortalTheme(client.portalTheme)

  const si = STEPS.indexOf(ticket.status)
  const isResolved = ['resuelto', 'cancelado'].includes(ticket.status)
  const canComment = !isStaffViewing(session) && !isResolved
  const isClientViewing = !isStaffViewing(session) && session?.user?.role === 'client'
  const canEdit = isClientViewing && ticket.status === 'nuevo'
  const canAddItems = isClientViewing && ['nuevo', 'en_revision'].includes(ticket.status)

  const urgencyCardClass: Record<string, string> = {
    emergencia: 'ticket-card-em', urgencia: 'ticket-card-ur',
    no_urgente: 'ticket-card-rq', preventivo: 'ticket-card-pr',
  }

  const backLink = (
    <Link href={`/portal/${slug}/tickets`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--p-t2)', textDecoration: 'none', fontWeight: '500', transition: 'color 0.12s' }}>
      <IconArrowLeft />
      Mis solicitudes
    </Link>
  )

  return (
    <PortalShell slug={slug} clientName={client.name} userName={session!.user.name ?? 'Usuario'} primary={theme.primary}
      bg={theme.bg} cardBg={theme.card} textColor={theme.text}
      activeHref={`/portal/${slug}/tickets`} topbarTitle={ticket.title} topbarSub={ticket.ticketCode} topbarRight={backLink}>
      <div className="pg" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }} data-ticket-detail="1">

        {/* ── Main column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Progress stepper */}
          {si >= 0 && !isResolved && (
            <div className="pcard" style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '18px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
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

          {/* Resolved / Cancelled banner */}
          {ticket.status === 'resuelto' && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--p-r2)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#22c55e', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3.5 9l3.5 4L14.5 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#15803d' }}>Solicitud resuelta</p>
                {ticket.closedDate && <p style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>Cerrada el {new Date(ticket.closedDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
              </div>
            </div>
          )}
          {ticket.status === 'cancelado' && (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 'var(--p-r2)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#9ca3af', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4L4 12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#374151' }}>Solicitud cancelada</p>
                {ticket.closedDate && <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Fecha: {new Date(ticket.closedDate).toLocaleDateString('es-CL')}</p>}
              </div>
            </div>
          )}

          {/* Work summary */}
          {ticket.workSummary && (
            <div style={{ background: `color-mix(in srgb, ${theme.primary} 7%, white)`, border: `1px solid color-mix(in srgb, ${theme.primary} 18%, transparent)`, borderRadius: 'var(--p-r2)', padding: '16px 18px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: theme.primary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Resumen del trabajo realizado
              </p>
              <p style={{ fontSize: '14px', color: 'var(--p-text)', lineHeight: '1.65' }}>{ticket.workSummary}</p>
            </div>
          )}

          {/* Description + clientComment */}
          {(ticket.description || ticket.clientComment) && (
            <div className="pcard" style={{ padding: '16px 18px' }}>
              {ticket.description && (
                <>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Descripción del requerimiento</p>
                  <p style={{ fontSize: '14px', color: 'var(--p-text)', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
                </>
              )}
              {ticket.clientComment && (
                <div style={{ marginTop: ticket.description ? '14px' : '0', paddingTop: ticket.description ? '14px' : '0', borderTop: ticket.description ? '1px solid var(--p-bd)' : 'none' }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Comentario adicional</p>
                  <p style={{ fontSize: '14px', color: 'var(--p-text)', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{ticket.clientComment}</p>
                </div>
              )}
            </div>
          )}

          {/* Items checklist + add item */}
          {(ticket.items.length > 0 || canAddItems) && (
            <div className="pcard" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Trabajos</p>
                {ticket.items.length > 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--p-t3)', fontWeight: '600' }}>
                    {ticket.items.filter(i => i.status === 'resuelto').length}/{ticket.items.length} completados
                  </span>
                )}
              </div>
              {ticket.items.length > 0 && (
                <>
                  <div style={{ height: '5px', background: 'var(--p-bd)', borderRadius: '5px', marginBottom: '14px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '5px',
                      background: `linear-gradient(90deg, ${theme.primary}, color-mix(in srgb, ${theme.primary} 70%, #22c55e))`,
                      width: `${(ticket.items.filter(i => i.status === 'resuelto').length / ticket.items.length) * 100}%`,
                      transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                    }} />
                  </div>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: canAddItems ? '14px' : '0' }}>
                    {ticket.items.map(item => (
                      <li key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0, marginTop: '1px',
                          background: item.status === 'resuelto' ? '#22c55e' : 'var(--p-bg)',
                          border: item.status === 'resuelto' ? '2px solid #22c55e' : '2px solid var(--p-bd2)',
                          display: 'grid', placeItems: 'center',
                        }}>
                          {item.status === 'resuelto' && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', color: item.status === 'resuelto' ? 'var(--p-t3)' : 'var(--p-text)', fontWeight: '500', textDecoration: item.status === 'resuelto' ? 'line-through' : 'none', lineHeight: '1.4' }}>
                            {item.title}
                          </p>
                          {item.description && <p style={{ fontSize: '12px', color: 'var(--p-t3)', marginTop: '2px' }}>{item.description}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {ticket.items.length === 0 && canAddItems && (
                <p style={{ fontSize: '13px', color: 'var(--p-t3)', marginBottom: '12px' }}>Sin sub-tareas aún. Agrega trabajos específicos que necesitas resolver.</p>
              )}
              {canAddItems && (
                <PortalTicketActions
                  ticketId={ticket.id}
                  canEdit={false}
                  canAddItems={true}
                  initialTitle={ticket.title}
                  initialDescription={ticket.description ?? ''}
                  initialUrgency={ticket.urgency}
                  primary={theme.primary}
                />
              )}
            </div>
          )}

          {/* Edit ticket actions (outside items card) */}
          {canEdit && (
            <PortalTicketActions
              ticketId={ticket.id}
              canEdit={true}
              canAddItems={false}
              initialTitle={ticket.title}
              initialDescription={ticket.description ?? ''}
              initialUrgency={ticket.urgency}
              primary={theme.primary}
            />
          )}

          {/* Documents (R2) */}
          {ticket.documents.length > 0 && (
            <div className="pcard" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Documentos adjuntos
                <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '600', color: 'var(--p-t3)', background: 'var(--p-bg)', border: '1px solid var(--p-bd)', borderRadius: '10px', padding: '1px 7px' }}>
                  {ticket.documents.length}
                </span>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {signedDocs.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--p-bg)', borderRadius: 'var(--p-r)', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ color: 'var(--p-t3)', flexShrink: 0 }}><IconDoc /></div>
                      <span style={{ fontSize: '13px', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                    </div>
                    <a href={doc.viewUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '12px', fontWeight: '600', color: theme.primary, textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      Ver
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={theme.primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9L9 3M9 3H5M9 3v4"/>
                      </svg>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History timeline + comment form */}
          <div className="pcard" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Actividad</p>
            {ticket.history.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--p-t3)' }}>Sin actividad registrada aún.</p>
            ) : (
              <div className="timeline" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {ticket.history.map((h, i) => {
                  const isClient = h.user?.id === session?.user?.id
                  return (
                    <div key={h.id} className="tl-item">
                      <div className={`tl-dot${i === 0 ? ' tl-dot-acc' : h.toStatus === 'resuelto' ? ' tl-dot-green' : isClient ? ' tl-dot-blue' : ''}`}
                        style={{ background: i === 0 ? theme.primary : undefined }} />
                      <div style={{ flex: 1 }}>
                        {isClient && (
                          <p style={{ fontSize: '10px', fontWeight: '700', color: theme.primary, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>
                            Tu mensaje
                          </p>
                        )}
                        {h.note && <p style={{ fontSize: '13px', color: 'var(--p-text)', lineHeight: '1.55' }}>{h.note}</p>}
                        {h.fromStatus && h.toStatus && (
                          <p style={{ fontSize: '12px', color: 'var(--p-t3)', marginTop: '3px' }}>
                            {SL[h.fromStatus] ?? h.fromStatus}
                            <span style={{ margin: '0 5px', color: 'var(--p-bd2)' }}>→</span>
                            <strong style={{ color: 'var(--p-t2)', fontWeight: '600' }}>{SL[h.toStatus] ?? h.toStatus}</strong>
                          </p>
                        )}
                        <p style={{ fontSize: '11px', color: 'var(--p-t3)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IconClock />
                          {relativeTime(new Date(h.createdAt))}
                          {h.user?.name && !isClient && <span style={{ marginLeft: '4px' }}>· {h.user.name}</span>}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {canComment && (
              <PortalCommentForm ticketId={ticket.id} primary={theme.primary} />
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '76px' }}>

          {/* Urgency highlight */}
          <div className={`pcard ${urgencyCardClass[ticket.urgency] ?? ''}`} style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--p-t3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Urgencia</p>
            <span className={UB[ticket.urgency] ?? 'badge'} style={{ fontSize: '13px', padding: '4px 12px' }}>
              {UL[ticket.urgency] ?? ticket.urgency}
            </span>
          </div>

          <div className="pcard" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--p-t3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>Detalles</p>
            {[
              { label: 'Estado', value: <span className={SB[ticket.status] ?? 'badge'}>{SL[ticket.status] ?? ticket.status}</span> },
              { label: 'Sucursal', value: ticket.branch?.name ?? '—' },
              { label: 'Técnico', value: ticket.assignedTo?.name ?? 'Por asignar' },
              { label: 'Categoría', value: ticket.category ?? '—' },
              ...(ticket.otNumber ? [{ label: 'N° OT', value: <span className="mono" style={{ fontSize: '12px' }}>{ticket.otNumber}</span> }] : []),
              { label: 'Creado', value: new Date(ticket.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) },
              ...(ticket.estimatedDate ? [{ label: 'Fecha estimada', value: new Date(ticket.estimatedDate).toLocaleDateString('es-CL') }] : []),
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid var(--p-bd)', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--p-t3)', flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: '12px', color: 'var(--p-text)', fontWeight: '500', textAlign: 'right' }}>{row.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--p-t3)' }}>Código</span>
              <span className="mono" style={{ fontSize: '10px', color: 'var(--p-t3)' }}>{ticket.ticketCode}</span>
            </div>
          </div>

          {signedDocs.length > 0 && (
            <p style={{ fontSize: '12px', color: 'var(--p-t3)', textAlign: 'center', marginTop: '4px' }}>
              {signedDocs.length} archivo{signedDocs.length !== 1 ? 's' : ''} adjunto{signedDocs.length !== 1 ? 's' : ''}
            </p>
          )}

          <Link href={`/portal/${slug}/tickets`} className="pbtn pbtn-ghost" style={{ textDecoration: 'none', justifyContent: 'center' }}>
            ← Volver a solicitudes
          </Link>
        </div>
      </div>
    </PortalShell>
  )
}
