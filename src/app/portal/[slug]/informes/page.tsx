import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPortalClientBySlug } from '@/lib/portal-client'
import { canViewPortal, isStaffViewing } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import { resolvePortalTheme } from '@/lib/portal-theme'
import { PortalInformeList } from '@/components/tickets/portal-informe-list'

export default async function PortalInformesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session  = await auth()

  const client = await getPortalClientBySlug(slug)
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const isStaff = isStaffViewing(session)
  const isClientAdmin = session?.user?.isClientAdmin ?? false
  const userBranchId = session?.user?.branchId ?? null
  // Mismo criterio de scoping por sucursal que /portal/[slug]/tickets,
  // /dashboard y /reportes (data.md, G45) -- esta es una vista nueva que
  // lista documentos ligados a tickets de un cliente, así que le aplica el
  // mismo criterio, no solo a la lista principal de tickets.
  const branchFilter = (!isStaff && !isClientAdmin && userBranchId) ? userBranchId : null

  const docs = await prisma.clientDocument.findMany({
    where: {
      clientId: client.id,
      type: 'informe',
      ...(branchFilter ? { ticket: { branchId: branchFilter } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      metadata: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      ticket: { select: { ticketCode: true, otNumber: true, branch: { select: { name: true } } } },
    },
  })

  const theme = resolvePortalTheme(client.portalTheme)

  const serialized = docs.map(d => {
    let meta: Record<string, string> = {}
    try { if (d.metadata) meta = JSON.parse(d.metadata) } catch { /* ignore */ }
    return {
      id: d.id,
      title: d.title,
      createdAt: d.createdAt.toISOString(),
      createdByName: d.createdBy?.name ?? 'INGEGAR',
      // El FK real Ticket manda sobre el JSON legado de metadata cuando
      // existe -- mismo criterio que el resto del código desde que ticketId
      // reemplazó el viejo string-match (ver nota en schema.prisma).
      workOrder: d.ticket?.otNumber ?? meta.workOrder ?? meta.otNumber ?? '',
      branch: d.ticket?.branch?.name ?? meta.branch ?? '',
      reportId: meta.reportId ?? '',
      ticketCode: d.ticket?.ticketCode ?? '',
    }
  })

  return (
    <PortalShell
      slug={slug}
      clientName={client.name}
      logoUrl={client.logoUrl}
      userName={session!.user.name ?? 'Usuario'}
      primary={theme.primary}
      bg={theme.bg}
      cardBg={theme.card}
      textColor={theme.text}
      activeHref={`/portal/${slug}/informes`}
      topbarTitle="Informes Técnicos"
      topbarSub={`${docs.length} informe${docs.length !== 1 ? 's' : ''} disponible${docs.length !== 1 ? 's' : ''}`}
      isAdmin={isStaff}
      isClientAdmin={session?.user?.isClientAdmin ?? false}
    >
      <PortalInformeList
        docs={serialized}
        slug={slug}
        primary={theme.primary}
        bg={theme.bg}
        cardBg={theme.card}
        textColor={theme.text}
      />
    </PortalShell>
  )
}
