import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canViewPortal, isStaffViewing } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import { resolvePortalTheme } from '@/lib/portal-theme'
import { PortalInformeList } from '@/components/tickets/portal-informe-list'

export default async function PortalInformesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session  = await auth()

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true, logoUrl: true },
  })
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const isStaff = isStaffViewing(session)
  const docs = await prisma.clientDocument.findMany({
    where: { clientId: client.id, type: 'informe' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      metadata: true,
      createdAt: true,
      createdBy: { select: { name: true } },
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
      workOrder: meta.workOrder ?? meta.otNumber ?? '',
      branch: meta.branch ?? '',
      reportId: meta.reportId ?? '',
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
