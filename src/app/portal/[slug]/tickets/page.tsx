import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClientTickets } from '@/lib/tickets/tickets'
import { canViewPortal, isStaffViewing } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import { PortalTicketList } from '@/components/tickets/portal-ticket-list'

export default async function PortalTicketsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const isStaff = isStaffViewing(session)
  const raw = await getClientTickets(client.id)
  let theme = { primary: '#d42030', bg: '#f4f3f1', card: '#ffffff', text: '#18130e' }
  if (client.portalTheme) { try { theme = { ...theme, ...JSON.parse(client.portalTheme) } } catch {} }

  // Serialize dates to strings for client component
  const tickets = raw.map(t => ({
    id: t.id,
    ticketCode: t.ticketCode,
    title: t.title,
    status: t.status,
    urgency: t.urgency,
    createdAt: t.createdAt.toISOString(),
    estimatedDate: t.estimatedDate ? t.estimatedDate.toISOString() : null,
    closedDate: t.closedDate ? t.closedDate.toISOString() : null,
    branch: t.branch ? { id: t.branch.id, name: t.branch.name } : null,
    assignedTo: t.assignedTo ? { id: t.assignedTo.id, name: t.assignedTo.name } : null,
    _count: t._count,
  }))

  const open = raw.filter(t => !['resuelto','cancelado','fusionado'].includes(t.status))

  const btn = isStaff ? (
    <Link href="/tickets" style={{ textDecoration: 'none', fontSize: '12px', padding: '6px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: '600' }}>
      ← Volver a INGEGAR
    </Link>
  ) : (
    <Link href={`/portal/${slug}/tickets/new`} className="pbtn pbtn-primary" style={{ textDecoration: 'none', fontSize: '13px', padding: '8px 18px' }}>
      + Nueva solicitud
    </Link>
  )

  return (
    <PortalShell slug={slug} clientName={client.name}
      userName={session?.user?.name ?? 'Usuario'} primary={theme.primary}
      bg={theme.bg} cardBg={theme.card} textColor={theme.text}
      activeHref={`/portal/${slug}/tickets`}
      topbarTitle="Todos los requerimientos"
      topbarSub={`${raw.length} solicitudes · ${open.length} activas`}
      topbarRight={btn}>
      <PortalTicketList tickets={tickets} slug={slug} primary={theme.primary}
        bg={theme.bg} cardBg={theme.card} textColor={theme.text} isAdmin={isStaff} />
    </PortalShell>
  )
}
