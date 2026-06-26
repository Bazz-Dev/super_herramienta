'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'

interface Props {
  slug: string
  clientName: string
  userName: string
  primary: string
  activeHref: string
  children: React.ReactNode
  topbarTitle?: string
  topbarSub?: string
  topbarRight?: React.ReactNode
}

function IconTickets() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="2"/>
      <path d="M5 7h6M5 10h4"/>
    </svg>
  )
}
function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M8 3v10M3 8h10"/>
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9 10l3-3-3-3M12 7H5"/>
    </svg>
  )
}
function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 5h14M3 10h14M3 15h14"/>
    </svg>
  )
}
function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 4l10 10M14 4L4 14"/>
    </svg>
  )
}

const NAV = [
  { href: (s: string) => `/portal/${s}/tickets`,     label: 'Mis solicitudes', Icon: IconTickets },
  { href: (s: string) => `/portal/${s}/tickets/new`, label: 'Nueva solicitud', Icon: IconPlus },
]

export function PortalShell({ slug, clientName, userName, primary, activeHref, children, topbarTitle, topbarSub, topbarRight }: Props) {
  const [open, setOpen] = useState(false)
  const initials = clientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  // Close sidebar when navigating
  useEffect(() => { setOpen(false) }, [activeHref])

  // Close on escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile overlay */}
      <div
        className={`psb-overlay${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`psb${open ? ' open' : ''}`}>
        {/* Header */}
        <div className="psb-header">
          <div className="psb-logo" style={{ background: primary }}>{initials}</div>
          <div className="psb-client">
            <div className="psb-client-name">{clientName}</div>
            <div className="psb-client-sub">Portal de mantención</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="psb-nav">
          <div className="psb-section-label">Solicitudes</div>
          {NAV.map(({ href, label, Icon }) => {
            const to = href(slug)
            const active = activeHref === to
            return (
              <Link key={to} href={to} className={`psb-link${active ? ' active' : ''}`} style={{ textDecoration: 'none' }}>
                <Icon />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer user */}
        <div className="psb-footer">
          <div className="psb-user">
            <div className="psb-avatar" style={{ background: primary }}>{userInitials}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="psb-username">{userName}</div>
              <div className="psb-role">cliente</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: `/portal/${slug}` })}
              title="Cerrar sesión"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)', padding: '4px', flexShrink: 0,
                display: 'flex', alignItems: 'center', borderRadius: '4px',
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
            >
              <IconLogout />
            </button>
          </div>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.12)', textAlign: 'center', marginTop: '10px' }}>
            Powered by INGEGAR Chile SpA
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="portal-content">
        {/* Topbar */}
        <header className="ptopbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="psb-hamburger"
              onClick={() => setOpen(v => !v)}
              aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            >
              {open ? <IconX /> : <IconMenu />}
            </button>
            <div>
              <div className="ptopbar-title">{topbarTitle ?? 'Portal'}</div>
              {topbarSub && <div className="ptopbar-sub">{topbarSub}</div>}
            </div>
          </div>
          {topbarRight}
        </header>

        {/* Page content */}
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
