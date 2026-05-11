import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaRegister from '@/components/PwaRegister'

export const viewport: Viewport = {
  themeColor: '#0d9488',
}

export const metadata: Metadata = {
  title: 'Deheng Seoul | Project Management',
  description: 'Deheng Seoul team project management platform',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Deheng Seoul',
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg',     type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        {/* Manifest served by /app/manifest.webmanifest/route.ts */}
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
