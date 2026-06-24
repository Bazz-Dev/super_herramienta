import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

interface PortalTheme {
  primary: string
  secondary: string
  bg: string
  card: string
  text: string
}

const DEFAULT_THEME: PortalTheme = {
  primary: '#f5b100',
  secondary: '#111111',
  bg: '#f9fafb',
  card: '#ffffff',
  text: '#111111',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: any }) {
  const { slug } = await Promise.resolve(params)

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })

  if (!client) notFound()

  let theme: PortalTheme = DEFAULT_THEME
  if (client.portalTheme) {
    try { theme = { ...DEFAULT_THEME, ...JSON.parse(client.portalTheme) } } catch {}
  }

  return (
    <>
      <style>{`
        :root {
          --portal-primary: ${theme.primary};
          --portal-secondary: ${theme.secondary};
          --portal-bg: ${theme.bg};
          --portal-card: ${theme.card};
          --portal-text: ${theme.text};
        }
        body { background-color: var(--portal-bg); color: var(--portal-text); }
      `}</style>
      <div className="min-h-screen" style={{ background: theme.bg, color: theme.text }}>
        {children}
      </div>
    </>
  )
}
