import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { PortalShell } from '@/components/tickets/portal-shell'
import { PortalNewTicketForm } from '@/components/tickets/portal-new-ticket-form'

export default async function PortalNewTicketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true, branches: { where: { active: true }, select: { id: true, name: true, city: true }, orderBy: { name: 'asc' } } },
  })
  if (!client) notFound()
  if (!session?.user || session.user.role !== 'client' || session.user.clientId !== client.id) {
    redirect(`/portal/${slug}`)
  }

  let theme = { primary: '#d42030', bg: '#f4f3f1', card: '#ffffff', text: '#18130e' }
  if (client.portalTheme) { try { theme = { ...theme, ...JSON.parse(client.portalTheme) } } catch {} }

  const backLink = (
    <Link href={`/portal/${slug}/tickets`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--p-t2)', textDecoration: 'none', fontWeight: '500' }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Volver
    </Link>
  )

  return (
    <PortalShell slug={slug} clientName={client.name} userName={session.user.name ?? 'Usuario'} primary={theme.primary}
      activeHref={`/portal/${slug}/tickets/new`} topbarTitle="Nueva solicitud" topbarSub="Completa el formulario para crear un requerimiento" topbarRight={backLink}>
      <div style={{ padding: '24px 28px', maxWidth: '680px' }}>
        <div className="pcard" style={{ padding: '24px 26px' }}>
          <PortalNewTicketForm
            slug={slug}
            clientId={client.id}
            createdById={session.user.id}
            branches={client.branches}
            primary={theme.primary}
          />
        </div>
      </div>
    </PortalShell>
  )
}
