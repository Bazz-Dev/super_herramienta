'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { PortalPushPrompt } from './portal-push-prompt'

interface Props {
  slug: string
  clientName: string
  userName: string
  primary: string
  bg?: string
  cardBg?: string
  textColor?: string
  activeHref: string
  children: React.ReactNode
  topbarTitle?: string
  topbarSub?: string
  topbarRight?: React.ReactNode
  isAdmin?: boolean
}

const SB = '#121110'         // sidebar always dark
const BD = '#e0ddd8'         // border
const T2 = '#4b4540'         // secondary text
const T3 = '#8c857e'         // tertiary text

function IconDashboard() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>
}
function IconTickets() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="10" rx="2"/><path d="M5 7h6M5 10h4"/></svg>
}
function IconPlus() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
}
function IconReports() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12V5M6 12V8M10 12V3M14 12V7"/></svg>
}
function IconDocument() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3M6 8h4M6 11h3"/></svg>
}
function IconCalendar() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v3M11 1v3"/></svg>
}
function IconLogout() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9 10l3-3-3-3M12 7H5"/></svg>
}
function IconMenu() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14"/></svg>
}
function IconX() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l10 10M14 4L4 14"/></svg>
}

const NAV = [
  { href: (s: string) => `/portal/${s}/dashboard`,   label: 'Panel',             Icon: IconDashboard },
  { href: (s: string) => `/portal/${s}/tickets`,     label: 'Requerimientos',    Icon: IconTickets },
  { href: (s: string) => `/portal/${s}/tickets/new`, label: 'Nueva solicitud',   Icon: IconPlus },
  { href: (s: string) => `/portal/${s}/informes`,    label: 'Inf. Técnicos',     Icon: IconDocument },
  { href: (s: string) => `/portal/${s}/reportes`,    label: 'Reportes',          Icon: IconReports },
  { href: (s: string) => `/portal/${s}/cronograma`,  label: 'Cronograma',        Icon: IconCalendar },
]

export function PortalShell({
  slug, clientName, userName, primary,
  bg = '#f4f3f1', cardBg = '#ffffff', textColor = '#18130e',
  activeHref, children, topbarTitle, topbarSub, topbarRight,
  isAdmin = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [navHover, setNavHover] = useState<string | null>(null)
  const initials = clientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => { setOpen(false) }, [activeHref]) // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  // Mobile: detect below 860px
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mq.matches)
    const fn = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const SB_WIDTH = 216

  const visibleNav = isAdmin
    ? NAV.filter(item => !item.href(slug).endsWith('/tickets/new'))
    : NAV

  return (
    // Root wrapper — inline background prevents ANY external CSS from overriding
    <div style={{ display: 'flex', minHeight: '100dvh', background: bg, color: textColor, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", WebkitFontSmoothing: 'antialiased' }}>

      {/* Mobile overlay */}
      {isMobile && open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.52)', zIndex: 39, backdropFilter: 'blur(2px)' }}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: SB_WIDTH, minWidth: SB_WIDTH, background: SB,
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 40,
        transform: isMobile && !open ? `translateX(-${SB_WIDTH}px)` : 'translateX(0)',
        transition: 'transform 0.22s ease',
        boxShadow: isMobile && open ? '4px 0 40px rgba(0,0,0,0.4)' : 'none',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: primary, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0, letterSpacing: '-0.5px' }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clientName}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>Portal de mantención</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', padding: '12px 10px 5px' }}>
            Menu
          </div>
          {visibleNav.map(({ href, label, Icon }) => {
            const to = href(slug)
            const active = activeHref === to
            const hover = navHover === to
            return (
              <Link
                key={to}
                href={to}
                onMouseEnter={() => setNavHover(to)}
                onMouseLeave={() => setNavHover(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 11px', borderRadius: 6, textDecoration: 'none',
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? '#fff' : hover ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.42)',
                  background: active
                    ? `rgba(${hexToRgb(primary)}, 0.18)`
                    : hover ? 'rgba(255,255,255,0.07)' : 'transparent',
                  boxShadow: active ? `inset 2px 0 0 ${primary}` : 'none',
                  transition: 'all 0.12s',
                }}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: primary, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {userInitials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
              <div style={{ display: 'inline-block', fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 1, background: `rgba(${hexToRgb(primary)}, 0.25)`, color: '#fca5a5' }}>
                cliente
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: `/portal/${slug}` })}
              title="Cerrar sesión"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center', borderRadius: 4 }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
            >
              <IconLogout />
            </button>
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', textAlign: 'center', marginTop: 10 }}>
            Powered by INGEGAR · <span style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0 }}>v1.8.0</span>
          </p>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div style={{
        marginLeft: isMobile ? 0 : SB_WIDTH,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        background: bg,   // explicit — no CSS variable
        color: textColor,
      }}>
        {/* Topbar */}
        <header style={{
          background: cardBg,
          borderBottom: `1px solid ${BD}`,
          padding: '0 22px',
          height: 54, minHeight: 54,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 30,
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {/* Hamburger — only visible on mobile via JS state */}
            {isMobile && (
              <button
                onClick={() => setOpen(v => !v)}
                aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T3, padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                {open ? <IconX /> : <IconMenu />}
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {topbarTitle ?? 'Portal'}
              </div>
              {topbarSub && (
                <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>{topbarSub}</div>
              )}
            </div>
          </div>
          {topbarRight && <div style={{ flexShrink: 0 }}>{topbarRight}</div>}
        </header>

        {/* Page */}
        <main style={{ flex: 1, background: bg }}>
          {children}
        </main>
      </div>

      {/* Push notification opt-in */}
      <PortalPushPrompt primary={primary} slug={slug} />
    </div>
  )
}

// Convert hex to "R, G, B" for rgba() usage
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}
