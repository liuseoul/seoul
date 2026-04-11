'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TYPE_LABELS: Record<string, string> = {
  online_meeting:  '线上会议',
  visiting:        '拜访',
  business_travel: '出差',
  others:          '其他',
}

const TYPE_COLORS: Record<string, string> = {
  online_meeting:  'bg-blue-100 text-blue-700',
  visiting:        'bg-purple-100 text-purple-700',
  business_travel: 'bg-orange-100 text-orange-700',
  others:          'bg-gray-100 text-gray-600',
}

// Alternating row backgrounds for reminder list
const ROW_BG = ['bg-white', 'bg-gray-50']

const MAX_VISIBLE = 10

type Reminder = {
  id: string
  due_date: string
  content: string
  type: string
  start_time: string | null
  end_time: string | null
  created_by: string
  created_at: string
  profiles?: { name: string }
}

interface SidebarProps {
  profile: { id: string; name: string; role: string } | null
}

export default function Sidebar({ profile }: SidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const isAdmin = profile?.role === 'admin'
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const now      = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const [reminders,    setReminders]    = useState<Reminder[]>([])
  const [showAll,      setShowAll]      = useState(false)

  const [showAddRem,   setShowAddRem]   = useState(false)
  const [remDate,      setRemDate]      = useState(todayStr)
  const [remContent,   setRemContent]   = useState('')
  const [remType,      setRemType]      = useState('others')
  const [remStartTime, setRemStartTime] = useState('')
  const [remEndTime,   setRemEndTime]   = useState('')
  const [remSaving,    setRemSaving]    = useState(false)

  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null))
    loadReminders()
  }, [])

  async function loadReminders() {
    // Delete ALL past reminders (any user — RLS now permits this)
    await supabase.from('reminders').delete().lt('due_date', todayStr)

    // Only fetch today-onwards so past items can never leak through
    const { data } = await supabase
      .from('reminders')
      .select('*, profiles(name)')
      .gte('due_date', todayStr)          // ← double-guard: never show past dates
      .order('due_date', { ascending: true })
    setReminders(data || [])
  }

  async function saveReminder() {
    if (!remDate || !remContent.trim()) { alert('请填写截止日期和内容'); return }
    if (remEndTime && remStartTime && remEndTime <= remStartTime) {
      alert('结束时间必须晚于开始时间'); return
    }
    setRemSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('reminders').insert({
      due_date: remDate, content: remContent.trim(), type: remType,
      start_time: remStartTime || null, end_time: remEndTime || null,
      created_by: user!.id,
    })
    if (error) { alert('保存失败：' + error.message) }
    else { setShowAddRem(false); resetAddForm(); await loadReminders() }
    setRemSaving(false)
  }

  function resetAddForm() {
    setRemContent(''); setRemDate(todayStr)
    setRemType('others'); setRemStartTime(''); setRemEndTime('')
  }

  async function deleteReminder(id: string) {
    if (!confirm('确认删除该日程？')) return
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

  function fmtTime(t: string | null) { return t ? t.slice(0, 5) : '' }

  const visibleReminders = showAll ? reminders : reminders.slice(0, MAX_VISIBLE)
  const hasMore = !showAll && reminders.length > MAX_VISIBLE

  return (
    <>
      <div className="w-56 bg-white border-r border-gray-200 text-gray-900 flex flex-col h-full flex-shrink-0">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0">D</div>
            <div className="text-sm font-semibold text-gray-900 leading-tight">Deheng Seoul</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-3 space-y-1 border-b border-gray-200 flex-shrink-0">
          {navItems.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 text-left
                ${pathname === item.href
                  ? 'bg-teal-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* 日程安排 */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">日程安排</span>
            <button
              onClick={() => setShowAddRem(true)}
              className="text-xs text-gray-500 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-300
                         hover:border-teal-400 transition-colors"
            >
              + 添加
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
            {reminders.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">暂无日程</p>
            )}

            {visibleReminders.map((r, idx) => {
              const isToday = r.due_date === todayStr
              const mm = r.due_date.slice(5, 7)
              const dd = r.due_date.slice(8, 10)
              const rowBg = isToday ? '' : ROW_BG[idx % 2]
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedReminder(r)}
                  className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border transition-colors
                    ${isToday
                      ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
                      : `${rowBg} border-gray-200 hover:border-teal-300 hover:bg-teal-50/40`
                    }`}
                >
                  <span className={`text-xs font-bold mt-0.5 flex-shrink-0 w-9
                    ${isToday ? 'text-amber-600' : 'text-teal-600'}`}>
                    {mm}/{dd}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={`text-sm leading-snug line-clamp-2 block
                      ${isToday ? 'text-amber-800 font-medium' : 'text-gray-800'}`}>
                      {r.content}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {r.type && r.type !== 'others' && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded
                          ${TYPE_COLORS[r.type] || TYPE_COLORS.others}`}>
                          {TYPE_LABELS[r.type] || r.type}
                        </span>
                      )}
                      {r.start_time && (
                        <span className="text-[10px] text-gray-400">
                          {fmtTime(r.start_time)}{r.end_time ? `–${fmtTime(r.end_time)}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Show more / collapse */}
            {hasMore && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-1.5 text-xs text-gray-500 hover:text-teal-600
                           border border-dashed border-gray-300 hover:border-teal-400
                           rounded-lg transition-colors"
              >
                查看更多（还有 {reminders.length - MAX_VISIBLE} 条）
              </button>
            )}
            {showAll && reminders.length > MAX_VISIBLE && (
              <button
                onClick={() => setShowAll(false)}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600
                           border border-dashed border-gray-200 rounded-lg transition-colors"
              >
                收起
              </button>
            )}
          </div>
        </div>

        {/* User info & logout */}
        <div className="px-3 py-4 border-t border-gray-200 flex-shrink-0">
          <div className="px-3 py-2 mb-1">
            <div className="text-sm font-medium text-gray-900 truncate">{profile?.name || 'User'}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {isAdmin ? 'Administrator' : 'Member'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                       text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
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
              <h3 className="text-base font-semibold text-gray-900">添加日程</h3>
              <button onClick={() => { setShowAddRem(false); resetAddForm() }}
                className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setRemType(val)}
                      className={`py-1.5 px-3 text-sm rounded-lg border transition-colors text-left
                        ${remType === val
                          ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
                <input type="date" value={remDate} onChange={e => setRemDate(e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                  <input type="time" value={remStartTime} onChange={e => setRemStartTime(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                  <input type="time" value={remEndTime} onChange={e => setRemEndTime(e.target.value)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <textarea value={remContent} onChange={e => setRemContent(e.target.value)}
                  placeholder="日程内容…" rows={3} className="input-field resize-none" autoFocus />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAddRem(false); resetAddForm() }}
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
              <h3 className="text-base font-semibold text-gray-900">日程详情</h3>
              <button onClick={() => setSelectedReminder(null)}
                className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-3">
              {selectedReminder.type && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                  ${TYPE_COLORS[selectedReminder.type] || TYPE_COLORS.others}`}>
                  {TYPE_LABELS[selectedReminder.type] || selectedReminder.type}
                </span>
              )}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold
                ${selectedReminder.due_date === todayStr
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-teal-50 text-teal-700'}`}>
                <span>📅</span>
                <span>
                  {selectedReminder.due_date === todayStr ? '今天 · ' : ''}
                  {selectedReminder.due_date.slice(0, 4)}/
                  {selectedReminder.due_date.slice(5, 7)}/
                  {selectedReminder.due_date.slice(8, 10)}
                </span>
              </div>
              {selectedReminder.start_time && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <span>🕐</span>
                  <span>
                    {fmtTime(selectedReminder.start_time)}
                    {selectedReminder.end_time ? ` – ${fmtTime(selectedReminder.end_time)}` : ''}
                  </span>
                </div>
              )}
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
                <button onClick={() => deleteReminder(selectedReminder.id)}
                  className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
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
