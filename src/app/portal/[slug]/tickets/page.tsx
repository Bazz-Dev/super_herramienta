import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClientTickets } from '@/lib/tickets/tickets'
import { canViewPortal, isStaffViewing } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import { PortalTicketList } from '@/components/tickets/portal-ticket-list'
import { resolvePortalTheme } from '@/lib/portal-theme'

export default async function PortalTicketsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true, logoUrl: true },
  })
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const isStaff = isStaffViewing(session)
  const isClientAdmin = session?.user?.isClientAdmin ?? false
  const userBranchId = session?.user?.branchId ?? null

  // Branch users see only their branch; client admins and staff see all
  const branchFilter = (!isStaff && !isClientAdmin && userBranchId) ? userBranchId : null
  const raw = await getClientTickets(client.id, branchFilter)
  const theme = resolvePortalTheme(client.portalTheme)

  // For client admin: also get pending approval tickets (all branches)
  const pendingApproval = isClientAdmin
    ? raw.filter(t => t.status === 'pendiente_aprobacion')
    : []

  const serialize = (t: typeof raw[number]) => ({
    id: t.id,
    ticketCode: t.ticketCode,
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    urgency: t.urgency,
    createdAt: t.createdAt.toISOString(),
    estimatedDate: t.estimatedDate ? t.estimatedDate.toISOString() : null,
    closedDate: t.closedDate ? t.closedDate.toISOString() : null,
    branch: t.branch ? { id: t.branch.id, name: t.branch.name } : null,
    assignedTo: t.assignedTo ? { id: t.assignedTo.id, name: t.assignedTo.name } : null,
    _count: t._count,
  })

  const tickets = raw.map(serialize)
  const open = raw.filter(t => !['resuelto','cancelado','fusionado','pendiente_aprobacion'].includes(t.status))

  const topbarSub = userBranchId
    ? `${raw.length} solicitudes de tu sucursal`
    : `${raw.length} solicitudes · ${open.length} activas`

  const btn = (
    <Link href={`/portal/${slug}/tickets/new`} className="pbtn pbtn-primary" style={{ textDecoration: 'none', fontSize: '13px', padding: '8px 18px' }}>
      + Nueva solicitud
    </Link>
  )

  return (
    <PortalShell slug={slug} clientName={client.name} logoUrl={client.logoUrl}
      userName={session?.user?.name ?? 'Usuario'} primary={theme.primary}
      bg={theme.bg} cardBg={theme.card} textColor={theme.text}
      activeHref={`/portal/${slug}/tickets`}
      topbarTitle="Mis solicitudes"
      topbarSub={topbarSub}
      topbarRight={btn}
      isAdmin={isStaff}>

      {/* Approval queue for client admin */}
      {pendingApproval.length > 0 && (
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: '12px', padding: '14px 18px', marginBottom: '4px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>
              ⏳ Pendientes de tu aprobación ({pendingApproval.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingApproval.map(t => (
                <Link key={t.id} href={`/portal/${slug}/tickets/${t.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', textDecoration: 'none', border: '1px solid rgba(253,211,77,0.4)' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#78350f', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                    {t.branch?.name && <p style={{ fontSize: '11px', color: '#92400e', margin: '2px 0 0' }}>{t.branch.name}</p>}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', flexShrink: 0 }}>Revisar →</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <PortalTicketList tickets={tickets} slug={slug} primary={theme.primary}
        bg={theme.bg} cardBg={theme.card} textColor={theme.text} isAdmin={isStaff} />
    </PortalShell>
  )
}
