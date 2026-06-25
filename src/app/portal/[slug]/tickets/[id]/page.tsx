import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClientTicket } from '@/lib/tickets/tickets'
import { canViewPortal } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import {
  PORTAL_STATUS_BADGE as SB,
  PORTAL_STATUS_SHORT as SL,
  PORTAL_URGENCY_BADGE as UB,
  PORTAL_URGENCY_SHORT as UL,
  PROGRESS_STEPS as STEPS,
  PROGRESS_STEPS_LABEL as SLBL,
} from '@/lib/tickets/labels'

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

  let theme = { primary: '#d42030', bg: '#f4f3f1', card: '#ffffff', text: '#18130e' }
  if (client.portalTheme) { try { theme = { ...theme, ...JSON.parse(client.portalTheme) } } catch {} }

  const si = STEPS.indexOf(ticket.status)
  const isResolved = ['resuelto', 'cancelado'].includes(ticket.status)

  const backLink = (
    <Link href={`/portal/${slug}/tickets`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--p-t2)', textDecoration: 'none', fontWeight: '500' }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Mis solicitudes
    </Link>
  )

  return (
    <PortalShell slug={slug} clientName={client.name} userName={session!.user.name ?? 'Usuario'} primary={theme.primary}
      activeHref={`/portal/${slug}/tickets`} topbarTitle={ticket.title} topbarSub={ticket.ticketCode} topbarRight={backLink}>
      <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>

        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Status progress */}
          {si >= 0 && !isResolved && (
            <div className="pcard" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Estado del requerimiento
              </p>
              <div className="psteps">
                {STEPS.map((s, i) => (
                  <div key={s} className={['pstep', i < si ? 'pstep-done' : i === si ? 'pstep-current' : ''].filter(Boolean).join(' ')}>{SLBL[i]}</div>
                ))}
              </div>
            </div>
          )}

          {/* Resolved banner */}
          {ticket.status === 'resuelto' && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--p-r2)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#22c55e', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#15803d' }}>Solicitud resuelta</p>
                {ticket.closedDate && <p style={{ fontSize: '12px', color: '#166534' }}>Cerrada el {new Date(ticket.closedDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
              </div>
            </div>
          )}

          {/* Work summary */}
          {ticket.workSummary && (
            <div style={{ background: `color-mix(in srgb, ${theme.primary} 8%, white)`, border: `1px solid color-mix(in srgb, ${theme.primary} 20%, transparent)`, borderRadius: 'var(--p-r2)', padding: '16px 18px' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: theme.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Resumen del trabajo realizado
              </p>
              <p style={{ fontSize: '14px', color: 'var(--p-text)', lineHeight: '1.6' }}>{ticket.workSummary}</p>
            </div>
          )}

          {/* Description */}
          {ticket.description && (
            <div className="pcard" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Descripción</p>
              <p style={{ fontSize: '14px', color: 'var(--p-text)', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
            </div>
          )}

          {/* Items checklist */}
          {ticket.items.length > 0 && (
            <div className="pcard" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--p-t2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trabajos</p>
                <span style={{ fontSize: '11px', color: 'var(--p-t3)' }}>
                  {ticket.items.filter(i => i.status === 'resuelto').length}/{ticket.items.length} completados
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ height: '4px', background: 'var(--p-bd)', borderRadius: '4px', marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: '#22c55e', borderRadius: '4px',
                  width: `${(ticket.items.filter(i => i.status === 'resuelto').length / ticket.items.length) * 100}%`,
                  transition: 'width 0.4s',
                }} />
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ticket.items.map(item => (
                  <li key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, marginTop: '1px',
                      background: item.status === 'resuelto' ? '#22c55e' : 'var(--p-bg)',
                      border: item.status === 'resuelto' ? '1.5px solid #22c55e' : '1.5px solid var(--p-bd2)',
                      display: 'grid', placeItems: 'center',
                    }}>
                      {item.status === 'resuelto' && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.2 2.5L8 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', color: item.status === 'resuelto' ? 'var(--p-t3)' : 'var(--p-text)', fontWeight: '500', textDecoration: item.status === 'resuelto' ? 'line-through' : 'none' }}>
                        {item.title}
                      </p>
                      {item.description && <p style={{ fontSize: '12px', color: 'var(--p-t3)', marginTop: '2px' }}>{item.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Documents */}
          {ticket.documents.length > 0 && (
            <div className="pcard" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Documentos</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ticket.documents.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--p-bg)', borderRadius: 'var(--p-r)', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>📎</span>
                      <span style={{ fontSize: '13px', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                    </div>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', fontWeight: '600', color: theme.primary, textDecoration: 'none', flexShrink: 0 }}>
                      Ver ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History timeline */}
          <div className="pcard" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Historial de actividad</p>
            {ticket.history.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--p-t3)' }}>Sin actividad registrada aún.</p>
            ) : (
              <div className="timeline" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {ticket.history.map((h, i) => (
                  <div key={h.id} className="tl-item">
                    <div className={`tl-dot ${i === 0 ? 'tl-dot-acc' : h.toStatus === 'resuelto' ? 'tl-dot-green' : ''}`} style={{ background: i === 0 ? theme.primary : undefined }} />
                    <div style={{ flex: 1, paddingBottom: i < ticket.history.length - 1 ? '0' : '0' }}>
                      {h.note && <p style={{ fontSize: '13px', color: 'var(--p-text)', lineHeight: '1.5' }}>{h.note}</p>}
                      {h.fromStatus && h.toStatus && (
                        <p style={{ fontSize: '12px', color: 'var(--p-t3)', marginTop: '2px' }}>
                          {SL[h.fromStatus] ?? h.fromStatus} → <strong style={{ color: 'var(--p-t2)' }}>{SL[h.toStatus] ?? h.toStatus}</strong>
                        </p>
                      )}
                      <p style={{ fontSize: '11px', color: 'var(--p-t3)', marginTop: '3px' }}>
                        {new Date(h.createdAt).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '76px' }}>
          <div className="pcard" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>Detalles</p>
            {[
              { label: 'Estado', value: <span className={SB[ticket.status] ?? 'badge'}>{SL[ticket.status] ?? ticket.status}</span> },
              { label: 'Urgencia', value: <span className={UB[ticket.urgency] ?? 'badge'}>{UL[ticket.urgency] ?? ticket.urgency}</span> },
              { label: 'Sucursal', value: ticket.branch?.name ?? '—' },
              { label: 'Técnico', value: ticket.assignedTo?.name ?? 'Por asignar' },
              { label: 'Categoría', value: ticket.category ?? '—' },
              { label: 'N° OT', value: ticket.otNumber ? <span className="mono" style={{ fontSize: '12px' }}>{ticket.otNumber}</span> : '—' },
              { label: 'Creado', value: new Date(ticket.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) },
              ticket.estimatedDate && { label: 'Fecha est.', value: new Date(ticket.estimatedDate).toLocaleDateString('es-CL') },
            ].filter(Boolean).map((row) => {
              if (!row) return null
              return (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid var(--p-bd)', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--p-t3)', flexShrink: 0 }}>{row.label}</span>
                  <span style={{ fontSize: '12px', color: 'var(--p-text)', fontWeight: '500', textAlign: 'right' }}>{row.value}</span>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--p-t3)' }}>Código</span>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--p-t3)' }}>{ticket.ticketCode}</span>
            </div>
          </div>

          {ticket.driveFolderUrl && (
            <a href={ticket.driveFolderUrl} target="_blank" rel="noopener noreferrer" className="pbtn pbtn-ghost" style={{ textDecoration: 'none', justifyContent: 'center' }}>
              <span>📁</span> Carpeta de archivos
            </a>
          )}
        </div>
      </div>
    </PortalShell>
  )
}
