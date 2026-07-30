import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPortalClientBySlug } from '@/lib/portal-client'
import { canViewPortal } from '@/lib/portal-auth'
import { resolvePortalTheme } from '@/lib/portal-theme'
import { PortalShell } from '@/components/tickets/portal-shell'
import { PortalBranchesManager } from '@/components/tickets/portal-branches-manager'
import { PortalTeamManager } from '@/components/tickets/portal-team-manager'

export default async function PortalSucursalesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  const client = await getPortalClientBySlug(slug)
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)
  // Ficha exclusiva del admin del cliente — un usuario de sucursal normal o
  // staff viendo el portal no debe llegar acá.
  if (!session?.user?.isClientAdmin || session.user.role !== 'client') redirect(`/portal/${slug}/dashboard`)

  const [branches, users] = await Promise.all([
    prisma.branch.findMany({
      where: { clientId: client.id },
      select: { id: true, name: true, city: true, active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { clientId: client.id, role: 'client' },
      select: { id: true, email: true, username: true, active: true, isClientAdmin: true, branchId: true },
      orderBy: { email: 'asc' },
    }),
  ])

  const userCountByBranch = new Map<string, number>()
  for (const u of users) {
    if (!u.branchId) continue
    userCountByBranch.set(u.branchId, (userCountByBranch.get(u.branchId) ?? 0) + 1)
  }
  const branchesWithCount = branches.map(b => ({ ...b, userCount: userCountByBranch.get(b.id) ?? 0 }))

  const theme = resolvePortalTheme(client.portalTheme)

  return (
    <PortalShell
      slug={slug} clientName={client.name} logoUrl={client.logoUrl}
      userName={session!.user.name ?? 'Usuario'} primary={theme.primary}
      bg={theme.bg} cardBg={theme.card} textColor={theme.text}
      activeHref={`/portal/${slug}/sucursales`}
      topbarTitle="Sucursales y equipo"
      topbarSub={`${branches.length} sucursales · ${users.length} usuarios`}
      isClientAdmin
    >
      <div className="pg" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 22px' }}>
        <PortalBranchesManager branches={branchesWithCount} primary={theme.primary} />
        <PortalTeamManager users={users} branches={branches} primary={theme.primary} />
      </div>
    </PortalShell>
  )
}
