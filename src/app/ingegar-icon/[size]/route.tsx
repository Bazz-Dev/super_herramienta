import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Renders the INGEGAR isotipo (3 triangles) as a PNG at any requested size.
// Used by the manifest.json and layout meta tags instead of static PNGs.
//
// Isotipo composition (SVG 100×100, inner area 6→94 = 88×88):
//   Blue  (#1a3c7d): upper-left triangle  — (0,0)(60,0)(0,60) in inner coords
//   Dark  (#1c2240): lower-left wedge     — (0,60)(0,88)(30,88) in inner coords
//   Gold  (#f5b100): fills everything else (inner background)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params
  const sz = Math.min(Math.max(parseInt(size) || 192, 32), 512)

  // 6% outer padding on each side (matches SVG margin)
  const pad = Math.round(sz * 0.06)
  const inner = sz - pad * 2

  // Pixel dimensions of each triangle within the inner square
  const blueWH = Math.round(inner * 60 / 88)
  const darkW  = Math.round(inner * 30 / 88)
  const darkH  = inner - blueWH

  return new ImageResponse(
    (
      <div
        style={{
          width: sz,
          height: sz,
          background: '#111111',
          display: 'flex',
          padding: pad,
        }}
      >
        {/* Inner square — gold background */}
        <div
          style={{
            width: inner,
            height: inner,
            background: '#f5b100',
            position: 'relative',
            display: 'flex',
          }}
        >
          {/* Blue upper-left triangle */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: blueWH,
              height: blueWH,
              background: '#1a3c7d',
              clipPath: 'polygon(0% 0%, 100% 0%, 0% 100%)',
            }}
          />
          {/* Dark lower-left wedge */}
          <div
            style={{
              position: 'absolute',
              top: blueWH,
              left: 0,
              width: darkW,
              height: darkH,
              background: '#1c2240',
              clipPath: 'polygon(0% 0%, 0% 100%, 100% 100%)',
            }}
          />
        </div>
      </div>
    ),
    { width: sz, height: sz },
  )
}
