import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { PushProvider } from '@/components/ui/push-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'INGEGAR One',
  description: 'INGEGAR One — Gestión integrada de operaciones',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'INGEGAR',
  },
  icons: {
    icon: [
      { url: '/ingegar-icon/192', sizes: '192x192', type: 'image/png' },
      { url: '/ingegar-icon/512', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/ingegar-icon/152', sizes: '152x152', type: 'image/png' },
      { url: '/ingegar-icon/180', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#f5b100',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning: el portal fija color-scheme/background inline
  // antes de hidratar (anti-FOUC, ver portal/[slug]/layout.tsx) — mismatch
  // esperado y documentado por React, no un bug real.
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <PushProvider>
          {children}
        </PushProvider>
      </body>
    </html>
  )
}
