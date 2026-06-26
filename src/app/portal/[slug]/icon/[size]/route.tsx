import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(_req: Request, { params }: { params: any }) {
  const { slug, size } = await Promise.resolve(params)
  const sz = Math.min(Math.max(parseInt(size) || 192, 32), 512)

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { name: true, portalTheme: true },
  })

  let primary = '#d42030'
  let name = String(slug)
  if (client) {
    name = client.name
    if (client.portalTheme) {
      try { primary = JSON.parse(client.portalTheme).primary ?? primary } catch {}
    }
  }

  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const radius = Math.round(sz * 0.22)
  const fontSize = Math.round(sz * 0.36)

  return new ImageResponse(
    (
      <div
        style={{
          width: sz,
          height: sz,
          background: primary,
          borderRadius: radius,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#ffffff',
            fontSize,
            fontWeight: 800,
            lineHeight: 1,
            fontFamily: 'sans-serif',
          }}
        >
          {initials}
        </span>
      </div>
    ),
    { width: sz, height: sz },
  )
}
