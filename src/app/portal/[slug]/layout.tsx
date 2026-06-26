import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

interface PortalTheme {
  primary: string
  bg: string
  card: string
  text: string
}

const DEFAULT_THEME: PortalTheme = {
  primary: '#d42030',
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

  // Derive static color values from theme primary for CSS
  const acc = theme.primary

  return (
    <>
      <style>{`
        /* ── Portal Design System — forced light mode, scoped to .pw ── */
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800&family=JetBrains+Mono:wght@400;600&display=swap');

        /* ── Light mode hard-lock — three layers of enforcement ── */
        /* 1. Document root: "only light" tells browser+extensions to never go dark */
        :root { color-scheme: light only !important; }
        /* 2. Portal wrapper: explicit opaque background, no dark inheritance */
        .pw { color-scheme: light only !important; }
        /* 3. All portal descendants: inherit light scheme */
        .pw * { color-scheme: light !important; }
        .pw {
          --acc: ${acc};
          --bg:  ${theme.bg};
          --s1:  ${theme.card};
          --s2:  #f8f7f5;
          --s3:  #efedea;
          --bd:  #e0ddd8;
          --bd2: #ccc8c2;
          --bd3: rgba(0,0,0,0.06);
          --tx:  ${theme.text};
          --t2:  #4b4540;
          --t3:  #8c857e;
          --t4:  #beb7b0;
          --sb:  #121110;
          --r:   6px;
          --r2:  10px;
          --r3:  14px;
          --sh:  0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04);
          --sh2: 0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05);
          --sh3: 0 20px 60px rgba(0,0,0,0.18);
          --acc-l: color-mix(in srgb, ${acc} 12%, #fff);
          --acc-bd: color-mix(in srgb, ${acc} 22%, transparent);
          /* Legacy aliases for child components */
          --p-acc: ${acc};
          --p-bg: ${theme.bg};
          --p-card: ${theme.card};
          --p-text: ${theme.text};
          --p-sb: #121110;
          --p-bd: #e0ddd8;
          --p-bd2: #ccc8c2;
          --p-t2: #4b4540;
          --p-t3: #8c857e;
          --p-sh: 0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04);
          --p-sh2: 0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05);
          --p-r: 6px;
          --p-r2: 10px;
          --p-r3: 14px;
          /* force opaque backgrounds — prevents dark-mode bleed */
          background: ${theme.bg} !important;
          color: ${theme.text} !important;
        }

        .pw, .pw * { box-sizing: border-box; margin: 0; padding: 0; }
        .pw { font-family: 'Inter', system-ui, sans-serif; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; min-height: 100vh; display: flex; flex-direction: column; }
        .pw ::-webkit-scrollbar { width: 4px; height: 4px; }
        .pw ::-webkit-scrollbar-track { background: transparent; }
        .pw ::-webkit-scrollbar-thumb { background: var(--bd2); border-radius: 4px; }

        /* ── Sidebar ── */
        .psb {
          width: 216px; min-width: 216px; background: var(--sb);
          display: flex; flex-direction: column; flex-shrink: 0;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 40;
        }
        .psb-header {
          padding: 16px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; gap: 10px;
        }
        .psb-logo {
          width: 34px; height: 34px; border-radius: var(--r2);
          background: var(--acc); display: grid; place-items: center;
          font-size: 13px; font-weight: 800; color: #fff; flex-shrink: 0;
          letter-spacing: -0.5px;
        }
        .psb-client { min-width: 0; }
        .psb-client-name { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.92); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .psb-client-sub  { font-size: 10px; color: rgba(255,255,255,0.28); white-space: nowrap; }
        .psb-nav { flex: 1; padding: 8px; display: flex; flex-direction: column; gap: 1px; overflow-y: auto; }
        .psb-section-label { font-size: 9px; font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; color: rgba(255,255,255,0.22); padding: 12px 10px 5px; }
        .psb-link {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 11px; border-radius: var(--r);
          color: rgba(255,255,255,0.42); font-size: 13px; font-weight: 500;
          text-decoration: none; transition: all 0.12s;
          border: none; background: none; cursor: pointer; width: 100%;
        }
        .psb-link:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.82); }
        .psb-link.active { background: rgba(212,32,48,0.18); color: #fff; font-weight: 600; box-shadow: inset 2px 0 0 var(--acc); }
        .psb-footer { padding: 10px; border-top: 1px solid rgba(255,255,255,0.07); }
        .psb-user {
          display: flex; align-items: center; gap: 8px; padding: 8px 10px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--r2);
        }
        .psb-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--acc); display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0; }
        .psb-username { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.82); }
        .psb-role { display: inline-block; font-size: 8px; font-weight: 700; padding: 1px 6px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px; background: rgba(212,32,48,0.25); color: #fca5a5; }
        .psb-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.52); z-index: 39; backdrop-filter: blur(2px); }
        .psb-overlay.open { display: block; }
        .psb-hamburger { display: none; background: none; border: none; cursor: pointer; color: var(--t3); padding: 6px; border-radius: var(--r); transition: background 0.12s; }
        .psb-hamburger:hover { background: var(--s3); }

        /* ── Main content ── */
        .portal-content { margin-left: 216px; min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); }
        .portal-wrap { display: flex; min-height: 100vh; }

        /* ── Topbar ── */
        .ptopbar {
          background: var(--s1); border-bottom: 1px solid var(--bd);
          padding: 0 22px; height: 54px; min-height: 54px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 30; box-shadow: var(--sh);
        }
        .ptopbar-title { font-size: 15px; font-weight: 700; color: var(--tx); }
        .ptopbar-sub { font-size: 11px; color: var(--t3); margin-top: 1px; }

        /* ── Cards — hardcoded values so dark-mode can't override ── */
        .pcard { background: ${theme.card} !important; color: ${theme.text} !important; border: 1px solid #e0ddd8; border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04); }
        .pcard-hover { transition: box-shadow 0.15s, border-color 0.15s; cursor: pointer; }
        .pcard-hover:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05); border-color: #ccc8c2; }
        .kpi-card { background: ${theme.card} !important; color: ${theme.text} !important; border: 1px solid #e0ddd8; border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); padding: 16px 18px; }

        /* ── Badges ── */
        .badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px; border-radius: 4px;
          font-size: 11px; font-weight: 600; white-space: nowrap;
        }
        .badge-nuevo     { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .badge-revision  { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
        .badge-ejecucion { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
        .badge-espera    { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
        .badge-resuelto  { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
        .badge-cancelado { background: #f9fafb; color: #6b7280; border: 1px solid #e5e7eb; }
        .badge-em        { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .badge-ur        { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
        .badge-rq        { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .badge-pr        { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }

        /* ── Timeline ── */
        .timeline { position: relative; }
        .timeline::before { content: ''; position: absolute; left: 7px; top: 8px; bottom: 8px; width: 1px; background: var(--bd); z-index: 0; }
        .tl-item { display: flex; gap: 14px; position: relative; z-index: 1; }
        .tl-dot { width: 15px; height: 15px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; border: 2px solid var(--s1); box-shadow: 0 0 0 1px var(--bd2); background: var(--s2); }
        .tl-dot-acc   { background: var(--acc); box-shadow: 0 0 0 1px var(--acc); }
        .tl-dot-green { background: #22c55e; box-shadow: 0 0 0 1px #22c55e; }
        .tl-dot-blue  { background: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }

        /* ── Stepper ── */
        .psteps { display: flex; align-items: flex-start; gap: 0; position: relative; padding: 8px 0; }
        .pstep-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; gap: 8px; }
        .pstep-wrap:not(:last-child)::after {
          content: ''; position: absolute; top: 14px; left: calc(50% + 14px);
          width: calc(100% - 28px); height: 2px; background: var(--bd); z-index: 0;
        }
        .pstep-wrap.done::after    { background: var(--acc); }
        .pstep-wrap.current::after { background: var(--bd); }
        .pstep-circle {
          width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          display: grid; place-items: center; position: relative; z-index: 1;
          font-size: 11px; font-weight: 700;
          background: var(--s2); border: 2px solid var(--bd); color: var(--t3);
          transition: all 0.2s;
        }
        .pstep-wrap.done    .pstep-circle { background: var(--acc); border-color: var(--acc); color: #fff; }
        .pstep-wrap.current .pstep-circle { background: var(--acc); border-color: var(--acc); color: #fff; box-shadow: 0 0 0 4px color-mix(in srgb, var(--acc) 20%, transparent); }
        .pstep-label { font-size: 10px; font-weight: 500; color: var(--t3); text-align: center; line-height: 1.3; max-width: 70px; }
        .pstep-wrap.done    .pstep-label { color: var(--acc); font-weight: 600; }
        .pstep-wrap.current .pstep-label { color: var(--tx); font-weight: 700; }

        /* ── Form inputs ── */
        .pinput {
          width: 100%; border-radius: var(--r2); border: 1px solid var(--bd2);
          background: var(--s1); padding: 10px 14px; font-size: 13px; color: var(--tx);
          font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s; outline: none;
        }
        .pinput:focus { border-color: var(--acc); box-shadow: 0 0 0 3px color-mix(in srgb, var(--acc) 15%, transparent); }
        .pinput::placeholder { color: var(--t4); }
        .plabel { display: block; font-size: 12px; font-weight: 600; color: var(--t2); margin-bottom: 5px; }

        /* ── Buttons ── */
        .pbtn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 9px 18px; border-radius: var(--r2);
          font-size: 13px; font-weight: 700; cursor: pointer;
          border: none; transition: all 0.12s; text-decoration: none; white-space: nowrap; font-family: inherit;
        }
        .pbtn-primary { background: var(--acc); color: #fff; }
        .pbtn-primary:hover { background: color-mix(in srgb, var(--acc) 88%, #000); }
        .pbtn-ghost { background: var(--s1); color: var(--t2); border: 1px solid var(--bd); }
        .pbtn-ghost:hover { background: var(--s2); color: var(--tx); border-color: var(--bd2); }
        .pbtn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ── Misc ── */
        .mono { font-family: 'JetBrains Mono', monospace; }
        .pdivider { height: 1px; background: var(--bd); }
        .prow-link { transition: background 0.1s; }
        .prow-link:hover { background: var(--s2) !important; }

        /* ── Empty state ── */
        .pempty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 24px; text-align: center; }
        .pempty-icon { width: 56px; height: 56px; border-radius: var(--r2); background: var(--s2); border: 1px solid var(--bd); display: grid; place-items: center; color: var(--t3); }
        .pempty-title { font-size: 15px; font-weight: 700; color: var(--tx); }
        .pempty-sub { font-size: 13px; color: var(--t3); max-width: 280px; }

        /* ── Comment form ── */
        .pcomment-form { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
        .pcomment-input {
          width: 100%; border-radius: var(--r2); border: 1.5px solid var(--bd2);
          background: var(--s2); padding: 10px 14px; font-size: 13px; color: var(--tx);
          font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s;
          outline: none; resize: vertical; min-height: 80px;
        }
        .pcomment-input:focus { border-color: var(--acc); box-shadow: 0 0 0 3px color-mix(in srgb, var(--acc) 15%, transparent); background: var(--s1); }
        .pcomment-input::placeholder { color: var(--t4); }

        /* ── Urgency left-border cards ── */
        .ticket-card-em { border-left: 3px solid #ef4444 !important; }
        .ticket-card-ur { border-left: 3px solid #f59e0b !important; }
        .ticket-card-rq { border-left: 3px solid #22c55e !important; }
        .ticket-card-pr { border-left: 3px solid #3b82f6 !important; }

        /* ── Page padding utility ── */
        .pg { padding: 20px 22px; }

        /* ── Responsive layout utilities ── */
        .pw-kpi   { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
        .pw-dash  { display: grid; grid-template-columns: 1fr 280px; gap: 14px; align-items: start; }
        .pw-2col  { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .pw-3col  { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
        .kpi-card { background: var(--s1); border: 1px solid var(--bd); border-radius: var(--r3); box-shadow: var(--sh); padding: 16px 18px; }
        .kpi-val  { font-size: 28px; font-weight: 800; line-height: 1; margin-bottom: 4px; font-variant-numeric: tabular-nums; }
        .kpi-lbl  { font-size: 11px; font-weight: 700; color: var(--tx); margin-bottom: 2px; }
        .kpi-sub  { font-size: 10px; color: var(--t3); }

        /* ── Alert banners ── */
        .alert-red { background:#fef2f2; border:1px solid #fecaca; border-radius:var(--r2); padding:10px 16px; display:flex; align-items:center; gap:10px; }
        .alert-red strong { color:#b91c1c; font-size:13px; }

        /* ── Responsive ── */
        @media (max-width: 860px) {
          .psb { transform: translateX(-100%); transition: transform 0.22s ease; box-shadow: var(--sh3); }
          .psb.open { transform: translateX(0); }
          .psb-overlay.open { display: block; }
          .psb-hamburger { display: flex !important; align-items: center; justify-content: center; }
          .portal-content { margin-left: 0 !important; }
          .ptopbar { padding: 0 14px; }
          .pg { padding: 16px 14px 80px; }
          .pw-kpi  { grid-template-columns: 1fr 1fr; }
          .pw-dash { grid-template-columns: 1fr; }
          .pw-2col { grid-template-columns: 1fr; }
          [data-ticket-detail] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .ptopbar { height: 50px; min-height: 50px; }
          .ptopbar-title { font-size: 14px; }
          .pcard { border-radius: var(--r2); }
          .pw-3col { grid-template-columns: 1fr 1fr; }
        }

        /* ── Tablet/iPhone safe area ── */
        @supports (padding: max(0px)) {
          .portal-content { padding-bottom: env(safe-area-inset-bottom, 0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Light-mode enforcement — prevents Dark Reader & system dark mode ── */}
      {/* Standard: tells browser + extensions this page is light-only */}
      <meta name="color-scheme" content="light" />
      {/* Dark Reader extension opt-out */}
      <meta name="darkreader-lock" />

      {/* ── PWA meta tags ── */}
      <link rel="manifest" href={`/portal/${slug}/manifest.webmanifest`} />
      <meta name="theme-color" content={theme.primary} />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content={client.name} />
      <link rel="apple-touch-icon" sizes="180x180" href={`/portal/${slug}/icon/180`} />
      <link rel="apple-touch-icon" sizes="152x152" href={`/portal/${slug}/icon/152`} />
      <link rel="apple-touch-icon" sizes="120x120" href={`/portal/${slug}/icon/120`} />

      {/* ── Critical inline script: sets bg BEFORE first paint, no FOUC ── */}
      <script dangerouslySetInnerHTML={{ __html: `(function(){try{var r=document.documentElement;r.style.colorScheme='light';r.style.background='${theme.bg}';document.body&&(document.body.style.background='${theme.bg}');}catch(e){}})();` }} />

      {/* Service worker registration */}
      <script dangerouslySetInnerHTML={{ __html: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js').then(function(reg) {
              navigator.serviceWorker.addEventListener('message', function(e) {
                if (e.data?.type === 'navigate' && e.data?.href) {
                  window.location.href = e.data.href;
                }
              });
            }).catch(function(err) { console.warn('SW registration failed:', err); });
          });
        }
      ` }} />

      <div className="pw">
        {children}
      </div>
    </>
  )
}
