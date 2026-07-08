import { NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; size: string }> }) {
  const { slug, size } = await Promise.resolve(params)
  const sz = Math.min(Math.max(parseInt(size) || 192, 32), 512)

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { name: true, portalTheme: true, logoUrl: true },
  })

  // If client has an uploaded logo (stored as data URI), serve it directly
  if (client?.logoUrl) {
    const dataUri = client.logoUrl
    if (dataUri.startsWith('data:image/')) {
      const commaIdx = dataUri.indexOf(',')
      const meta = dataUri.slice(5, commaIdx)          // e.g. "image/png;base64"
      const mimeType = meta.split(';')[0]              // "image/png"
      const base64Data = dataUri.slice(commaIdx + 1)
      const binary = Buffer.from(base64Data, 'base64')
      return new NextResponse(binary, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }
    // External URL — redirect
    return NextResponse.redirect(dataUri, 302)
  }

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
