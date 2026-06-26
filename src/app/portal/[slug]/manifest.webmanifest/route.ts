import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(_req: Request, { params }: { params: any }) {
  const { slug } = await Promise.resolve(params)

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { name: true, portalTheme: true },
  })

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let theme = { primary: '#d42030', bg: '#f4f3f1' }
  if (client.portalTheme) { try { theme = { ...theme, ...JSON.parse(client.portalTheme) } } catch {} }

  const shortName = client.name.split(' ').slice(0, 2).join(' ')
  const iconBase = `/portal/${slug}/icon`

  const manifest = {
    name: `${client.name} — Portal`,
    short_name: shortName,
    description: 'Portal de gestión de mantención y soporte técnico.',
    start_url: `/portal/${slug}/dashboard`,
    scope: `/portal/${slug}/`,
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: theme.bg,
    theme_color: theme.primary,
    categories: ['business', 'productivity'],
    lang: 'es',
    icons: [
      { src: `${iconBase}/72`,  sizes: '72x72',   type: 'image/png', purpose: 'any' },
      { src: `${iconBase}/96`,  sizes: '96x96',   type: 'image/png', purpose: 'any' },
      { src: `${iconBase}/128`, sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: `${iconBase}/144`, sizes: '144x144', type: 'image/png', purpose: 'any' },
      { src: `${iconBase}/152`, sizes: '152x152', type: 'image/png', purpose: 'any' },
      { src: `${iconBase}/192`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${iconBase}/384`, sizes: '384x384', type: 'image/png', purpose: 'any' },
      { src: `${iconBase}/512`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    shortcuts: [
      {
        name: 'Mis requerimientos',
        short_name: 'Tickets',
        url: `/portal/${slug}/tickets`,
        icons: [{ src: `${iconBase}/96`, sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Nueva solicitud',
        short_name: 'Nuevo',
        url: `/portal/${slug}/tickets/new`,
        icons: [{ src: `${iconBase}/96`, sizes: '96x96', type: 'image/png' }],
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  })
}
