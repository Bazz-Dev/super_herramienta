import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { canViewPortal } from '@/lib/portal-auth'
import { PortalLoginForm } from '@/components/tickets/portal-login-form'
import { resolvePortalTheme } from '@/lib/portal-theme'

const FEATURES = [
  { icon: '📋', text: 'Seguimiento en tiempo real' },
  { icon: '🔔', text: 'Notificaciones de estado' },
  { icon: '📎', text: 'Documentos y fotos adjuntas' },
  { icon: '💬', text: 'Comunicación con el equipo' },
]

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)}`
}

export default async function PortalLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true, logoUrl: true },
  })
  if (!client) notFound()

  const session = await auth()
  if (canViewPortal(session, client.id)) redirect(`/portal/${slug}/dashboard`)

  const theme = resolvePortalTheme(client.portalTheme)
  const rgb = hexToRgb(theme.primary)
  const initials = client.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; -webkit-font-smoothing: antialiased; }

        .pl-root {
          display: flex;
          min-height: 100dvh;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        /* ── Left panel ── */
        .pl-left {
          width: 38%;
          max-width: 420px;
          min-height: 100dvh;
          background: #111009;
          display: flex;
          flex-direction: column;
          padding: 28px 32px 24px;
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }
        .pl-left::before {
          content: '';
          position: absolute;
          bottom: -80px; left: -80px;
          width: 360px; height: 360px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(${rgb}, 0.18), transparent 70%);
          pointer-events: none;
        }
        .pl-powered {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.28);
          margin-bottom: auto;
        }
        .pl-powered svg { opacity: 0.35; }
        .pl-brand {
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
          justify-content: center;
          padding: 24px 0;
        }
        .pl-logo-box {
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
          box-shadow: 0 8px 32px rgba(${rgb}, 0.4);
          letter-spacing: -1px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .pl-logo-box img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 6px;
        }
        .pl-client-name {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.5px;
          line-height: 1.1;
        }
        .pl-desc {
          font-size: 13px;
          color: rgba(255,255,255,0.38);
          line-height: 1.55;
          max-width: 260px;
        }
        .pl-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 11px;
          margin-top: 8px;
        }
        .pl-feat {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: rgba(255,255,255,0.48);
        }
        .pl-feat-icon {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          flex-shrink: 0;
        }
        .pl-left-footer {
          font-size: 10px;
          color: rgba(255,255,255,0.14);
          margin-top: auto;
          padding-top: 20px;
        }

        /* ── Right panel ── */
        .pl-right {
          flex: 1;
          min-height: 100dvh;
          background: #f4f3f1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
        }
        .pl-form-box {
          width: 100%;
          max-width: 400px;
        }
        .pl-form-title {
          font-size: 24px;
          font-weight: 800;
          color: #18130e;
          letter-spacing: -0.4px;
          margin-bottom: 6px;
        }
        .pl-form-sub {
          font-size: 13px;
          color: #8c857e;
          margin-bottom: 28px;
        }
        .pl-right-footer {
          margin-top: 32px;
          text-align: center;
          font-size: 11px;
          color: #b0a89f;
        }
        .pl-right-footer a {
          color: ${theme.primary};
          font-weight: 600;
          text-decoration: none;
        }
        .pl-right-footer a:hover { text-decoration: underline; }

        /* ── Mobile: stack vertically ── */
        @media (max-width: 700px) {
          .pl-root { flex-direction: column; }
          .pl-left {
            width: 100%;
            max-width: 100%;
            min-height: auto;
            padding: 24px 22px;
          }
          .pl-brand { padding: 20px 0 10px; gap: 10px; }
          .pl-client-name { font-size: 22px; }
          .pl-features { display: none; }
          .pl-left-footer { display: none; }
          .pl-right {
            min-height: auto;
            padding: 32px 22px 48px;
            justify-content: flex-start;
          }
        }
      `}</style>

      <div className="pl-root">
        {/* ── Left panel ── */}
        <aside className="pl-left">
          <div className="pl-powered">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect width="6" height="6" rx="1.5" fill="currentColor"/>
              <rect x="8" width="6" height="6" rx="1.5" fill="currentColor"/>
              <rect y="8" width="6" height="6" rx="1.5" fill="currentColor"/>
              <rect x="8" y="8" width="6" height="6" rx="1.5" fill="currentColor"/>
            </svg>
            Powered by INGEGAR
          </div>

          <div className="pl-brand">
            <div className="pl-logo-box">
              {client.logoUrl ? (
                <img src={client.logoUrl} alt={`${client.name} logo`} />
              ) : (
                initials
              )}
            </div>
            <div className="pl-client-name">{client.name}</div>
            <p className="pl-desc">
              Portal de gestión de mantención<br />y soporte técnico.
            </p>
            <ul className="pl-features">
              {FEATURES.map(f => (
                <li key={f.text} className="pl-feat">
                  <span className="pl-feat-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pl-left-footer">
            © {new Date().getFullYear()} INGEGAR Chile SpA · Portal v2.1
          </div>
        </aside>

        {/* ── Right panel ── */}
        <main className="pl-right">
          <div className="pl-form-box">
            <h1 className="pl-form-title">Iniciar sesión</h1>
            <p className="pl-form-sub">Ingresa tus credenciales para acceder al portal.</p>

            <PortalLoginForm slug={slug} primaryColor={theme.primary} />

            <p className="pl-right-footer">
              ¿Problemas para ingresar?{' '}
              <a href="mailto:soporte@ingegarchile.cl">Contactar soporte</a>
            </p>
          </div>
        </main>
      </div>
    </>
  )
}
