import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { PortalLoginForm } from '@/components/tickets/portal-login-form'

export default async function PortalLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()

  // If already logged in as a client user for this portal, redirect
  const session = await auth()
  if (session?.user?.role === 'client' && session.user.clientId === client.id) {
    redirect(`/portal/${slug}/tickets`)
  }

  let theme = { primary: '#f5b100', bg: '#1a1a2e', card: '#16213e', text: '#e0e0e0' }
  if (client.portalTheme) {
    try { theme = { ...theme, ...JSON.parse(client.portalTheme) } } catch {}
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Logo / branding area */}
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black"
          style={{ background: theme.primary, color: '#111' }}
        >
          {client.name.substring(0, 2).toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold" style={{ color: theme.text }}>
          {client.name}
        </h1>
        <p className="mt-1 text-sm opacity-60" style={{ color: theme.text }}>
          Portal de mantención · INGEGAR
        </p>
      </div>

      {/* Login card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-xl"
        style={{ background: theme.card, color: theme.text }}
      >
        <PortalLoginForm slug={slug} primaryColor={theme.primary} />
      </div>

      <p className="mt-6 text-xs opacity-40" style={{ color: theme.text }}>
        Powered by INGEGAR Chile SpA
      </p>
    </div>
  )
}
