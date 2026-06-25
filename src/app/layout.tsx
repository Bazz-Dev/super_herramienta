import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { PushProvider } from '@/components/ui/push-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'INGEGAR. Platform',
  description: 'Herramienta interna de gestión — INGEGAR',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'INGEGAR',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
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
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased">
        <PushProvider>
          {children}
        </PushProvider>
      </body>
    </html>
  )
}
