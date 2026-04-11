'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Reminder = {
  id: string
  due_date: string
  content: string
  created_by: string
  created_at: string
  profiles?: { name: string }
}

// ── Sidebar ───────────────────────────────────────────────────
interface SidebarProps {
  profile: { id: string; name: string; role: string } | null
}

export default function Sidebar({ profile }: SidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const isAdmin = profile?.role === 'admin'
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // ── Reminders state
  const [reminders, setReminders] = useState<Reminder[]>([])

  // ── Add reminder modal
  const [showAddRem,  setShowAddRem]  = useState(false)
  const [remDate,     setRemDate]     = useState(todayStr)
  const [remContent,  setRemContent]  = useState('')
  const [remSaving,   setRemSaving]   = useState(false)

  // ── Reminder click modal (view + delete)
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null))
    loadReminders()
  }, [])

  async function loadReminders() {
    const { data } = await supabase
      .from('reminders')
      .select('*, profiles(name)')
      .order('due_date', { ascending: true })
    setReminders(data || [])
  }

  // ── Add reminder ─────────────────────────────────────────
  async function saveReminder() {
    if (!remDate || !remContent.trim()) { alert('请填写截止日期和内容'); return }
    setRemSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('reminders').insert({
      due_date: remDate, content: remContent.trim(), created_by: user!.id,
    })
    if (error) { alert('保存失败：' + error.message) }
    else {
      setShowAddRem(false)
      setRemContent('')
      setRemDate(todayStr)
      await loadReminders()
    }
    setRemSaving(false)
  }

  // ── Delete reminder ──────────────────────────────────────
  async function deleteReminder(id: string) {
    if (!confirm('确认删除该提醒？')) return
    const { error } = await supabase.from('reminders').delete().eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    setSelectedReminder(null)
    await loadReminders()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { href: '/projects', label: '项目概览', icon: '📋' },
    ...(isAdmin ? [{ href: '/admin', label: '管理后台', icon: '⚙️' }] : []),
  ]

  return (
    <>
      <div className="w-56 bg-slate-900 text-white flex flex-col h-full flex-shrink-0">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">D</div>
            <div>
              <div className="text-sm font-semibold leading-tight">Deheng Seoul</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-3 space-y-1 border-b border-slate-700 flex-shrink-0">
          {navItems.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 text-left
                ${pathname === item.href ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Reminders — fills all remaining space */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">提醒</span>
            <button
              onClick={() => setShowAddRem(true)}
              className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-700
                         hover:border-slate-500 transition-colors"
            >
              + 添加
            </button>
          </div>

          {/* Reminders list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {reminders.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-4">暂无提醒</p>
            )}
            {reminders.map(r => {
              const isToday = r.due_date === todayStr
              const isPast  = r.due_date < todayStr
              const mm = r.due_date.slice(5, 7)
              const dd = r.due_date.slice(8, 10)
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedReminder(r)}
                  className={`w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-lg transition-colors
                    ${isToday
                      ? 'bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30'
                      : isPast
                        ? 'opacity-50 hover:bg-slate-800'
                        : 'hover:bg-slate-800'
                    }`}
                >
                  <span className={`text-[10px] font-bold mt-0.5 flex-shrink-0 w-9
                    ${isToday ? 'text-amber-400' : isPast ? 'text-slate-500' : 'text-slate-400'}`}>
                    {mm}/{dd}
                  </span>
                  <span className={`text-xs leading-snug line-clamp-2
                    ${isToday ? 'text-amber-200' : isPast ? 'text-slate-500' : 'text-slate-300'}`}>
                    {r.content}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* User info & logout */}
        <div className="px-3 py-4 border-t border-slate-700 flex-shrink-0">
          <div className="px-3 py-2 mb-1">
            <div className="text-sm font-medium text-white truncate">{profile?.name || 'User'}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {isAdmin ? 'Administrator' : 'Member'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                       text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-150"
          >
            <span>🚪</span><span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* ══ Add Reminder Modal ═════════════════════════════════ */}
      {showAddRem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">添加提醒</h3>
              <button onClick={() => setShowAddRem(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
                <input type="date" value={remDate} onChange={e => setRemDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <textarea value={remContent} onChange={e => setRemContent(e.target.value)}
                  placeholder="提醒内容…" rows={3} className="input-field resize-none" autoFocus />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddRem(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={saveReminder} disabled={remSaving}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {remSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Reminder Detail Modal ══════════════════════════════ */}
      {selectedReminder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">提醒详情</h3>
              <button onClick={() => setSelectedReminder(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="space-y-3">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold
                ${selectedReminder.due_date === todayStr
                  ? 'bg-amber-100 text-amber-700'
                  : selectedReminder.due_date < todayStr
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-teal-50 text-teal-700'
                }`}>
                <span>📅</span>
                <span>
                  {selectedReminder.due_date === todayStr ? '今天 · ' : ''}
                  {selectedReminder.due_date.slice(0, 4)}/
                  {selectedReminder.due_date.slice(5, 7)}/
                  {selectedReminder.due_date.slice(8, 10)}
                </span>
              </div>

              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {selectedReminder.content}
              </p>

              {selectedReminder.profiles?.name && (
                <p className="text-xs text-gray-400">创建人：{selectedReminder.profiles.name}</p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelectedReminder(null)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                关闭
              </button>
              {(isAdmin || selectedReminder.created_by === currentUserId) && (
                <button
                  onClick={() => deleteReminder(selectedReminder.id)}
                  className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600
                             rounded-lg transition-colors"
                >
                  删除
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
