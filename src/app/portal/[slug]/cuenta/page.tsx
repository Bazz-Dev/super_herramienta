import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getPortalClientBySlug } from '@/lib/portal-client'
import { canViewPortal } from '@/lib/portal-auth'
import { resolvePortalTheme } from '@/lib/portal-theme'
import { PortalShell } from '@/components/tickets/portal-shell'
import { PortalChangePasswordForm } from '@/components/tickets/portal-change-password-form'

export default async function PortalCuentaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const client = await getPortalClientBySlug(slug)
  if (!client) notFound()

  const session = await auth()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const theme = resolvePortalTheme(client.portalTheme)

  return (
    <PortalShell
      slug={slug} clientName={client.name} logoUrl={client.logoUrl}
      userName={session?.user?.name ?? 'Usuario'} primary={theme.primary}
      bg={theme.bg} cardBg={theme.card} textColor={theme.text}
      activeHref={`/portal/${slug}/cuenta`}
      topbarTitle="Mi cuenta"
      topbarSub="Gestiona tu contraseña de acceso"
    >
      <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>
        <PortalChangePasswordForm slug={slug} primary={theme.primary} />
      </div>
    </PortalShell>
  )
}
