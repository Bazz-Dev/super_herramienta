import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { canViewPortal } from '@/lib/portal-auth'
import { PortalLoginForm } from '@/components/tickets/portal-login-form'
import { resolvePortalTheme } from '@/lib/portal-theme'

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
  const initials = client.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <style>{`
        .portal-login { display:flex; min-height:100dvh; background:#0f0e0d; font-family:'Inter',system-ui,sans-serif; }
        .login-left {
          width:420px; min-width:420px; padding:48px 40px;
          display:flex; flex-direction:column; justify-content:space-between;
          background:linear-gradient(160deg,#1a1210 0%,#0f0e0d 100%);
          border-right:1px solid rgba(255,255,255,0.05);
          position:relative; overflow:hidden;
        }
        .login-right {
          flex:1; display:flex; align-items:center; justify-content:center;
          padding:48px 24px; background:${theme.bg};
          min-height:100dvh;
        }
        .login-form-box { width:100%; max-width:380px; }
        .login-feature { display:flex; align-items:center; gap:12px; }
        .login-feature-icon { width:30px; height:30px; border-radius:7px; background:rgba(255,255,255,0.06); display:grid; place-items:center; flex-shrink:0; }
        @media (max-width: 700px) {
          .login-left { display:none !important; }
          .login-right {
            background:linear-gradient(180deg, #0f0e0d 0%, ${theme.bg} 38%);
            padding:40px 20px 32px;
            align-items:flex-start;
          }
          .login-form-box { max-width:100%; margin-top:0; }
          .login-mobile-brand { display:flex !important; }
        }
        .login-mobile-brand { display:none; align-items:center; gap:10px; margin-bottom:32px; }
      `}</style>
      <div className="portal-login">
        {/* Left panel — desktop branding */}
        <div className="login-left">
          <div style={{ position:'absolute', top:'-80px', left:'-80px', width:'320px', height:'320px', borderRadius:'50%', background:`radial-gradient(circle, ${theme.primary}33 0%, transparent 70%)`, pointerEvents:'none' }} />
          <div style={{ position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'56px' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'6px', background:theme.primary, display:'grid', placeItems:'center' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h10M2 11h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
              <span style={{ fontSize:'11px', fontWeight:'700', color:'rgba(255,255,255,0.28)', letterSpacing:'1.2px', textTransform:'uppercase' }}>Powered by INGEGAR</span>
            </div>
            <div style={{ width:'64px', height:'64px', borderRadius:'16px', background:theme.primary, display:'grid', placeItems:'center', fontSize:'22px', fontWeight:'800', color:'#fff', marginBottom:'20px', boxShadow:`0 8px 32px ${theme.primary}55` }}>{initials}</div>
            <h1 style={{ fontSize:'28px', fontWeight:'800', color:'#fff', lineHeight:'1.2', marginBottom:'10px' }}>{client.name}</h1>
            <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.38)', lineHeight:'1.6' }}>Portal de gestión de mantención<br/>y soporte técnico.</p>
            <div style={{ marginTop:'40px', display:'flex', flexDirection:'column', gap:'12px' }}>
              {([
                [<svg key="a" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(255,255,255,0.60)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="2" width="11" height="10" rx="1.5"/><path d="M4 6h6M4 8.5h4"/></svg>, 'Seguimiento en tiempo real'],
                [<svg key="b" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(255,255,255,0.60)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1.5A3.5 3.5 0 003.5 5v3l-1 2h9l-1-2V5A3.5 3.5 0 007 1.5z"/><path d="M5.5 10a1.5 1.5 0 003 0"/></svg>, 'Notificaciones de estado'],
                [<svg key="c" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(255,255,255,0.60)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3a1 1 0 011-1h3.5l2 2H11a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"/></svg>, 'Documentos y fotos adjuntas'],
                [<svg key="d" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(255,255,255,0.60)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 2.5a1 1 0 011-1h9a1 1 0 011 1v6a1 1 0 01-1 1H8L5 11.5V9.5H2.5a1 1 0 01-1-1v-6z"/></svg>, 'Comunicación con el equipo'],
              ] as [React.ReactNode, string][]).map(([icon, text]) => (
                <div key={String(text)} className="login-feature">
                  <div className="login-feature-icon">{icon}</div>
                  <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.45)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.16)', position:'relative' }}>© 2026 INGEGAR Chile SpA · Portal v2.1</p>
        </div>

        {/* Right panel — form */}
        <div className="login-right">
          <div className="login-form-box">
            {/* Mobile brand header */}
            <div className="login-mobile-brand">
              <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:theme.primary, display:'grid', placeItems:'center', fontSize:'16px', fontWeight:'800', color:'#fff', flexShrink:0 }}>{initials}</div>
              <div>
                <div style={{ fontSize:'16px', fontWeight:'800', color:'#fff' }}>{client.name}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', marginTop:'1px' }}>Portal de mantención</div>
              </div>
            </div>
            <div style={{ marginBottom:'28px' }}>
              <h2 style={{ fontSize:'22px', fontWeight:'800', color:theme.text, marginBottom:'6px' }}>Iniciar sesión</h2>
              <p style={{ fontSize:'13px', color:'rgba(24,19,14,0.48)' }}>Ingresa tus credenciales para acceder al portal.</p>
            </div>
            <PortalLoginForm slug={slug} primaryColor={theme.primary} />
            <p style={{ marginTop:'24px', fontSize:'12px', color:'rgba(24,19,14,0.32)', textAlign:'center' }}>
              ¿Problemas para ingresar?{' '}
              <a href="mailto:soporte@ingegarchile.cl" style={{ color:theme.primary, fontWeight:'600', textDecoration:'none' }}>Contactar soporte</a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
