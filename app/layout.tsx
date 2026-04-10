import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '项目管理系统',
  description: '德恒团队项目进度与工时管理平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
