import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { canViewPortal } from '@/lib/portal-auth'
import { PortalLoginForm } from '@/components/tickets/portal-login-form'
import { resolvePortalTheme } from '@/lib/portal-theme'

// Just Burger logo SVG — used when slug === 'justburger'
const JB_LOGO = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 230' width='130' height='93'>
  <path d='M58 148 C58 58 262 58 262 148' fill='none' stroke='#E52432' stroke-width='12' stroke-linecap='round'/>
  <path d='M58 168 L58 177 Q58 188 70 188 L250 188 Q262 188 262 177 L262 168' fill='none' stroke='#E52432' stroke-width='12' stroke-linecap='round' stroke-linejoin='round'/>
  <text x='160' y='126' text-anchor='middle' font-family='Impact,Arial Black,sans-serif' font-weight='900' font-size='62' fill='#F8F8F8' transform='rotate(-3 160 126)'>JUST</text>
  <text x='160' y='172' text-anchor='middle' font-family='Impact,Arial Black,sans-serif' font-weight='900' font-size='52' fill='#F8F8F8' transform='rotate(-3 160 172)'>BURGER</text>
  <circle cx='270' cy='72' r='11' fill='none' stroke='#F8F8F8' stroke-width='1.8'/>
  <text x='270' y='76' text-anchor='middle' font-family='Arial,sans-serif' font-size='12' fill='#F8F8F8' font-weight='bold'>R</text>
</svg>`

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

export default async function PortalLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()

  const session = await auth()
  if (canViewPortal(session, client.id)) redirect(`/portal/${slug}/dashboard`)

  const theme = resolvePortalTheme(client.portalTheme)
  const rgb = hexToRgb(theme.primary)
  const initials = client.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const isJB = slug === 'justburger'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; -webkit-font-smoothing: antialiased; }
        .pl-root {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0e0d0c;
          padding: 20px;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .pl-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 55% 40% at 55% 38%, rgba(${rgb}, 0.13), transparent 65%);
          pointer-events: none;
        }
        .pl-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 14px;
          padding: 36px 32px;
          width: 100%;
          max-width: 390px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.04);
          position: relative;
          z-index: 1;
        }
        .pl-logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 28px;
        }
        .pl-initials {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          background: ${theme.primary};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          font-weight: 800;
          color: #fff;
          box-shadow: 0 8px 32px rgba(${rgb}, 0.45);
          letter-spacing: -1px;
        }
        .pl-title {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.4px;
          color: #fff;
          margin-bottom: 4px;
          text-align: center;
        }
        .pl-sub {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.32);
          text-align: center;
          margin-bottom: 28px;
        }
        .pl-footer {
          margin-top: 22px;
          text-align: center;
          font-size: 11px;
          color: rgba(255,255,255,0.15);
          font-family: 'Inter', sans-serif;
        }
        .pl-footer a {
          color: rgba(${rgb}, 0.75);
          text-decoration: none;
          font-weight: 600;
        }
        @media (max-width: 440px) {
          .pl-card { padding: 28px 20px; }
        }
      `}</style>

      <div className="pl-root">
        <div className="pl-card">
          {/* Logo / brand */}
          <div className="pl-logo-wrap">
            {isJB ? (
              <div dangerouslySetInnerHTML={{ __html: JB_LOGO }} />
            ) : (
              <div className="pl-initials">{initials}</div>
            )}
          </div>

          <h1 className="pl-title">Bienvenido</h1>
          <p className="pl-sub">Portal de Mantención &middot; Ingegar Chile SpA</p>

          <PortalLoginForm slug={slug} primaryColor={theme.primary} dark />

          <p className="pl-footer">
            ¿Problemas para ingresar?{' '}
            <a href="mailto:soporte@ingegarchile.cl">Contactar soporte</a>
          </p>
        </div>
      </div>
    </>
  )
}
