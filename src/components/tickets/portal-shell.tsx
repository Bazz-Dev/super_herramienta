'use client'

import Link from 'next/link'
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

const NAV = [
  { href: (slug: string) => `/portal/${slug}/tickets`,     label: 'Mis solicitudes', icon: '📋' },
  { href: (slug: string) => `/portal/${slug}/tickets/new`, label: 'Nueva solicitud', icon: '➕' },
]

export function PortalShell({ slug, clientName, userName, primary, activeHref, children, topbarTitle, topbarSub, topbarRight }: Props) {
  const initials = clientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="psb">
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
          {NAV.map(item => {
            const href = item.href(slug)
            const active = activeHref === href
            return (
              <Link key={href} href={href} className={`psb-link ${active ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
                <span className="psb-link-dot" />
                <span>{item.label}</span>
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
                color: 'rgba(255,255,255,0.30)', fontSize: '13px', padding: '4px', flexShrink: 0,
              }}
            >
              ⏏
            </button>
          </div>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.14)', textAlign: 'center', marginTop: '10px' }}>
            Powered by INGEGAR Chile SpA
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="portal-content">
        {/* Topbar */}
        <header className="ptopbar">
          <div>
            <div className="ptopbar-title">{topbarTitle ?? 'Portal'}</div>
            {topbarSub && <div className="ptopbar-sub">{topbarSub}</div>}
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
