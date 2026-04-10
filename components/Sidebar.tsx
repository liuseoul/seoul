'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  profile: { id: string; name: string; role: string } | null
}

export default function Sidebar({ profile }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { href: '/projects', label: '项目概览', icon: '📋' },
    ...(profile?.role === 'admin'
      ? [{ href: '/admin', label: '管理后台', icon: '⚙️' }]
      : []),
  ]

  return (
    <div className="w-56 bg-slate-900 text-white flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">
            德
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">项目管理系统</div>
            <div className="text-xs text-slate-400 leading-tight mt-0.5">德恒团队</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 text-left
              ${pathname === item.href
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User info & logout */}
      <div className="px-3 py-4 border-t border-slate-700">
        <div className="px-3 py-2 mb-1">
          <div className="text-sm font-medium text-white truncate">{profile?.name || '用户'}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {profile?.role === 'admin' ? '管理员' : '团队成员'}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                     text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-150"
        >
          <span>🚪</span>
          <span>退出登录</span>
        </button>
      </div>
    </div>
  )
}
