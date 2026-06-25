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
  primary: '#d42030',
  secondary: '#ffc107',
  bg: '#f4f3f1',
  card: '#ffffff',
  text: '#18130e',
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

        :root {
          --p-acc:   ${theme.primary};
          --p-bg:    ${theme.bg};
          --p-card:  ${theme.card};
          --p-text:  ${theme.text};
          --p-sb:    #121110;
          --p-bd:    rgba(24,19,14,0.10);
          --p-bd2:   rgba(24,19,14,0.16);
          --p-t2:    rgba(24,19,14,0.55);
          --p-t3:    rgba(24,19,14,0.38);
          --p-sh:    0 1px 3px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.04);
          --p-sh2:   0 4px 16px rgba(0,0,0,0.09),0 0 0 1px rgba(0,0,0,0.04);
          --p-r:     7px;
          --p-r2:    11px;
          --p-r3:    15px;
          --p-acc-l: color-mix(in srgb, ${theme.primary} 12%, transparent);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; -webkit-font-smoothing: antialiased; }
        body {
          font-family: 'Inter', system-ui, sans-serif;
          background: var(--p-bg);
          color: var(--p-text);
          font-size: 14px;
          line-height: 1.5;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--p-bd2); border-radius: 4px; }

        .portal-wrap { display: flex; min-height: 100vh; flex-direction: column; }
        .portal-main { flex: 1; }

        /* Sidebar dark */
        .psb {
          width: 220px; min-width: 220px;
          background: var(--p-sb);
          display: flex; flex-direction: column; flex-shrink: 0;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 40;
        }
        .psb-header {
          padding: 18px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; gap: 10px;
        }
        .psb-logo {
          width: 34px; height: 34px; border-radius: var(--p-r2);
          background: var(--p-acc); display: grid; place-items: center;
          font-size: 13px; font-weight: 800; color: #fff; flex-shrink: 0;
          letter-spacing: -0.5px;
        }
        .psb-client {
          min-width: 0;
        }
        .psb-client-name {
          font-size: 13px; font-weight: 700;
          color: rgba(255,255,255,0.90);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .psb-client-sub {
          font-size: 10px; color: rgba(255,255,255,0.30);
          white-space: nowrap;
        }
        .psb-nav {
          flex: 1; padding: 10px 8px; display: flex; flex-direction: column; gap: 1px; overflow-y: auto;
        }
        .psb-section-label {
          font-size: 9px; font-weight: 700; letter-spacing: 1.6px;
          text-transform: uppercase; color: rgba(255,255,255,0.20);
          padding: 12px 10px 5px;
        }
        .psb-link {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 11px; border-radius: var(--p-r);
          color: rgba(255,255,255,0.42); font-size: 13px; font-weight: 500;
          text-decoration: none; transition: all 0.12s;
          border: none; background: none; cursor: pointer; width: 100%;
        }
        .psb-link:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.80); }
        .psb-link.active {
          background: rgba(212,32,48,0.18); color: #fff; font-weight: 600;
          box-shadow: inset 2px 0 0 var(--p-acc);
        }
        .psb-link-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(255,255,255,0.18); flex-shrink: 0;
        }
        .psb-link.active .psb-link-dot { background: var(--p-acc); }
        .psb-footer {
          padding: 10px 8px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .psb-user {
          display: flex; align-items: center; gap: 8px; padding: 8px 10px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--p-r2);
        }
        .psb-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: var(--p-acc); display: grid; place-items: center;
          font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
        }
        .psb-username { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.80); }
        .psb-role {
          display: inline-block; font-size: 8px; font-weight: 700;
          padding: 1px 6px; border-radius: 20px; text-transform: uppercase;
          letter-spacing: 0.5px; margin-top: 1px;
          background: rgba(212,32,48,0.25); color: #fca5a5;
        }

        /* Main content offset from sidebar */
        .portal-content {
          margin-left: 220px;
          min-height: 100vh;
          display: flex; flex-direction: column;
        }

        /* Topbar */
        .ptopbar {
          background: var(--p-card);
          border-bottom: 1px solid var(--p-bd);
          padding: 0 28px;
          height: 56px; min-height: 56px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 30;
          box-shadow: var(--p-sh);
        }
        .ptopbar-title { font-size: 15px; font-weight: 700; color: var(--p-text); }
        .ptopbar-sub { font-size: 12px; color: var(--p-t3); margin-top: 1px; }

        /* Cards + surfaces */
        .pcard {
          background: var(--p-card);
          border: 1px solid var(--p-bd);
          border-radius: var(--p-r3);
          box-shadow: var(--p-sh);
        }
        .pcard-hover { transition: box-shadow 0.15s, border-color 0.15s; cursor: pointer; }
        .pcard-hover:hover { box-shadow: var(--p-sh2); border-color: var(--p-bd2); }

        /* Badge variants */
        .badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px; border-radius: 20px;
          font-size: 11px; font-weight: 600; white-space: nowrap;
        }
        .badge-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .badge-nuevo     { background: #eff6ff; color: #1d4ed8; }
        .badge-revision  { background: #fefce8; color: #a16207; }
        .badge-ejecucion { background: #fff7ed; color: #c2410c; }
        .badge-espera    { background: #f5f3ff; color: #6d28d9; }
        .badge-resuelto  { background: #f0fdf4; color: #15803d; }
        .badge-cancelado { background: #f9fafb; color: #6b7280; }
        .badge-em { background: #fef2f2; color: #b91c1c; }
        .badge-ur { background: #fff7ed; color: #c2410c; }
        .badge-rq { background: #f0fdf4; color: #166534; }
        .badge-pr { background: #eff6ff; color: #1e40af; }

        /* Timeline */
        .timeline { position: relative; }
        .timeline::before {
          content: ''; position: absolute; left: 7px; top: 8px; bottom: 8px;
          width: 1px; background: var(--p-bd); z-index: 0;
        }
        .tl-item { display: flex; gap: 14px; position: relative; z-index: 1; }
        .tl-dot {
          width: 15px; height: 15px; border-radius: 50%; flex-shrink: 0;
          margin-top: 2px; border: 2px solid var(--p-card);
          box-shadow: 0 0 0 1px var(--p-bd2);
          background: var(--p-bg);
        }
        .tl-dot-acc { background: var(--p-acc); box-shadow: 0 0 0 1px var(--p-acc); }
        .tl-dot-green { background: #22c55e; box-shadow: 0 0 0 1px #22c55e; }
        .tl-dot-blue  { background: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }

        /* Status progress bar */
        .psteps { display: flex; gap: 0; }
        .pstep {
          flex: 1; padding: 10px 12px;
          background: var(--p-bg); border: 1px solid var(--p-bd);
          font-size: 11px; font-weight: 500; color: var(--p-t3);
          text-align: center;
          transition: all 0.15s;
        }
        .pstep:first-child { border-radius: var(--p-r) 0 0 var(--p-r); }
        .pstep:last-child  { border-radius: 0 var(--p-r) var(--p-r) 0; border-left: none; }
        .pstep + .pstep    { border-left: none; }
        .pstep-done { background: color-mix(in srgb, var(--p-acc) 10%, white); color: var(--p-acc); font-weight: 600; border-color: color-mix(in srgb, var(--p-acc) 20%, transparent); }
        .pstep-current { background: var(--p-acc); color: #fff; font-weight: 700; border-color: var(--p-acc); }

        /* Form inputs */
        .pinput {
          width: 100%; border-radius: var(--p-r2);
          border: 1px solid var(--p-bd2); background: var(--p-bg);
          padding: 10px 14px; font-size: 13px; color: var(--p-text);
          font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }
        .pinput:focus { border-color: var(--p-acc); box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-acc) 15%, transparent); }
        .pinput::placeholder { color: var(--p-t3); }
        .plabel { display: block; font-size: 12px; font-weight: 600; color: var(--p-t2); margin-bottom: 5px; }

        /* Button */
        .pbtn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 20px; border-radius: var(--p-r2);
          font-size: 13px; font-weight: 700; cursor: pointer;
          border: none; transition: all 0.12s; text-decoration: none;
          white-space: nowrap;
        }
        .pbtn-primary { background: var(--p-acc); color: #fff; }
        .pbtn-primary:hover { opacity: 0.88; }
        .pbtn-ghost {
          background: var(--p-bg); color: var(--p-t2);
          border: 1px solid var(--p-bd2);
        }
        .pbtn-ghost:hover { background: var(--p-bd); color: var(--p-text); }
        .pbtn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Mono code */
        .mono { font-family: 'JetBrains Mono', monospace; }

        /* Empty state */
        .pempty {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 48px 24px; text-align: center;
        }
        .pempty-icon {
          width: 56px; height: 56px; border-radius: var(--p-r2);
          background: var(--p-bd); display: grid; place-items: center;
          font-size: 22px;
        }
        .pempty-title { font-size: 15px; font-weight: 700; color: var(--p-text); }
        .pempty-sub { font-size: 13px; color: var(--p-t3); max-width: 280px; }

        /* Divider */
        .pdivider { height: 1px; background: var(--p-bd); margin: 0; }

        /* History row hover */
        .prow-link:hover { background: var(--p-bg) !important; }

        /* Responsive: hide sidebar on mobile, show topbar hamburger */
        @media (max-width: 768px) {
          .psb { transform: translateX(-100%); }
          .psb.open { transform: translateX(0); box-shadow: 0 0 40px rgba(0,0,0,0.4); }
          .portal-content { margin-left: 0; }
          .ptopbar { padding: 0 16px; }
        }
      `}</style>
      <div className="portal-wrap">
        {children}
      </div>
    </>
  )
}
