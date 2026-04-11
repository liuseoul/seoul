import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Deheng Seoul | Project Management',
  description: 'Deheng Seoul team project management platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
