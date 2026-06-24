import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { PortalNewTicketForm } from '@/components/tickets/portal-new-ticket-form'

export default async function PortalNewTicketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()

  if (!session?.user || session.user.role !== 'client' || session.user.clientId !== client.id) {
    redirect(`/portal/${slug}`)
  }

  const branches = await prisma.branch.findMany({
    where: { clientId: client.id, active: true },
    select: { id: true, name: true, city: true },
    orderBy: { name: 'asc' },
  })

  let theme = { primary: '#f5b100', card: '#ffffff', text: '#111111', bg: '#f9fafb' }
  if (client.portalTheme) {
    try { theme = { ...theme, ...JSON.parse(client.portalTheme) } } catch {}
  }

  return (
    <div className="min-h-screen" style={{ background: theme.bg }}>
      <header className="border-b px-6 py-4" style={{ background: theme.card, borderColor: `${theme.text}20` }}>
        <a href={`/portal/${slug}/tickets`} className="text-sm opacity-60 hover:opacity-100 transition" style={{ color: theme.text }}>
          ← Volver
        </a>
        <h1 className="mt-1 text-lg font-bold" style={{ color: theme.text }}>Nueva solicitud</h1>
      </header>
      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="rounded-xl p-6 shadow-sm" style={{ background: theme.card }}>
          <PortalNewTicketForm
            slug={slug}
            clientId={client.id}
            createdById={session.user.id!}
            branches={branches}
            theme={theme}
          />
        </div>
      </main>
    </div>
  )
}
