'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ScheduleEntry = {
  id: string
  start_time: string
  end_time: string
  content: string
  created_by: string
}
type ScheduleMap = Record<string, ScheduleEntry[]>

type Reminder = {
  id: string
  due_date: string
  content: string
  created_by: string
  created_at: string
  profiles?: { name: string }
}

// ── Mini Calendar ─────────────────────────────────────────────
function MiniCalendar({
  year, month, schedulesByDate, onDateClick,
}: {
  year: number
  month: number
  schedulesByDate: ScheduleMap
  onDateClick: (dateStr: string) => void
}) {
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today       = new Date()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)

  const dateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const hasEvent = (day: number) => (schedulesByDate[dateStr(day)] || []).length > 0

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  return (
    <div>
      <div className="grid grid-cols-7 text-center mb-1">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d} className="text-[9px] text-slate-500 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center">
        {cells.map((day, i) => (
          <div
            key={i}
            onClick={day && hasEvent(day) ? () => onDateClick(dateStr(day)) : undefined}
            className={`text-[11px] py-1 leading-none rounded transition-colors
              ${!day ? '' :
                isToday(day) ? 'bg-blue-600 text-white font-bold' :
                hasEvent(day) ? 'text-amber-400 font-semibold cursor-pointer hover:bg-slate-700' :
                'text-slate-400'
              }`}
          >
            {day || ''}
          </div>
        ))}
      </div>
    </div>
  )
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

  // ── Calendar state
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [schedulesByDate, setSchedulesByDate] = useState<ScheduleMap>({})

  // ── Add schedule modal
  const [showAddSch,  setShowAddSch]  = useState(false)
  const [schDate,     setSchDate]     = useState(todayStr)
  const [schStart,    setSchStart]    = useState('09:00')
  const [schEnd,      setSchEnd]      = useState('10:00')
  const [schContent,  setSchContent]  = useState('')
  const [schSaving,   setSchSaving]   = useState(false)

  // ── Calendar date click modal (view + delete schedules)
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null)

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

  useEffect(() => { loadSchedules() }, [calYear, calMonth])

  async function loadSchedules() {
    const pad   = (n: number) => String(n).padStart(2, '0')
    const first = `${calYear}-${pad(calMonth + 1)}-01`
    const last  = `${calYear}-${pad(calMonth + 1)}-${new Date(calYear, calMonth + 1, 0).getDate()}`

    const { data } = await supabase
      .from('schedules')
      .select('id, date, start_time, end_time, content, created_by')
      .gte('date', first)
      .lte('date', last)

    const map: ScheduleMap = {}
    for (const r of (data || [])) {
      if (!map[r.date]) map[r.date] = []
      map[r.date].push({
        id: r.id, start_time: r.start_time, end_time: r.end_time,
        content: r.content, created_by: r.created_by,
      })
    }
    setSchedulesByDate(map)
  }

  async function loadReminders() {
    const { data } = await supabase
      .from('reminders')
      .select('*, profiles(name)')
      .order('due_date', { ascending: true })
    setReminders(data || [])
  }

  // ── Calendar nav ─────────────────────────────────────────
  function prevMonth() {
    const d = new Date(calYear, calMonth - 1)
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth())
  }
  function nextMonth() {
    const d = new Date(calYear, calMonth + 1)
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth())
  }

  // ── Add schedule ─────────────────────────────────────────
  async function saveSchedule() {
    if (!schDate || !schStart || !schEnd || !schContent.trim()) {
      alert('请填写完整信息'); return
    }
    if (schEnd <= schStart) { alert('结束时间必须晚于开始时间'); return }
    setSchSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('schedules').insert({
      date: schDate, start_time: schStart, end_time: schEnd,
      content: schContent.trim(), created_by: user!.id,
    })
    if (error) { alert('保存失败：' + error.message) }
    else {
      setShowAddSch(false)
      setSchContent('')
      const d = new Date(schDate)
      setCalYear(d.getFullYear())
      setCalMonth(d.getMonth())
      await loadSchedules()
    }
    setSchSaving(false)
  }

  // ── Delete schedule ──────────────────────────────────────
  async function deleteSchedule(id: string) {
    if (!confirm('确认删除该日程？')) return
    const { error } = await supabase.from('schedules').delete().eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    await loadSchedules()
    // Refresh the selected date's entries (or close if none left)
    if (selectedCalDate) {
      const remaining = (schedulesByDate[selectedCalDate] || []).filter(s => s.id !== id)
      if (remaining.length === 0) setSelectedCalDate(null)
    }
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

  // Entries for the currently selected calendar date
  const selectedDateEntries = selectedCalDate ? (schedulesByDate[selectedCalDate] || []) : []

  return (
    <>
      <div className="w-56 bg-slate-900 text-white flex flex-col h-full flex-shrink-0">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">D</div>
            <div>
              <div className="text-sm font-semibold leading-tight">Project Mgmt</div>
              <div className="text-xs text-slate-400 leading-tight mt-0.5">Deheng Team</div>
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
                ${pathname === item.href ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Mini Calendar */}
        <div className="px-3 py-3 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="text-slate-400 hover:text-white w-6 text-center text-sm">‹</button>
            <span className="text-xs text-slate-300 font-medium">
              {calYear} / {String(calMonth + 1).padStart(2, '0')}
            </span>
            <button onClick={nextMonth} className="text-slate-400 hover:text-white w-6 text-center text-sm">›</button>
          </div>

          <MiniCalendar
            year={calYear} month={calMonth}
            schedulesByDate={schedulesByDate}
            onDateClick={setSelectedCalDate}
          />

          <button
            onClick={() => setShowAddSch(true)}
            className="w-full mt-3 py-1.5 text-xs font-medium rounded-lg border border-slate-600
                       text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            + 增加日程
          </button>
        </div>

        {/* Reminders section — takes remaining space */}
        <div className="flex-1 min-h-0 flex flex-col border-b border-slate-700">
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
        <div className="px-3 py-4 flex-shrink-0">
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

      {/* ══ Add Schedule Modal ══════════════════════════════════ */}
      {showAddSch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">增加日程</h3>
              <button onClick={() => setShowAddSch(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                <input type="date" value={schDate} onChange={e => setSchDate(e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                  <input type="time" value={schStart} onChange={e => setSchStart(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                  <input type="time" value={schEnd} onChange={e => setSchEnd(e.target.value)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <textarea value={schContent} onChange={e => setSchContent(e.target.value)}
                  placeholder="日程内容…" rows={3} className="input-field resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddSch(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={saveSchedule} disabled={schSaving}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {schSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Calendar Date Detail Modal (click on event date) ═══ */}
      {selectedCalDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">
                {selectedCalDate.slice(0, 4)}/{selectedCalDate.slice(5, 7)}/{selectedCalDate.slice(8, 10)} 日程
              </h3>
              <button onClick={() => setSelectedCalDate(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="space-y-3">
              {selectedDateEntries
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map(entry => {
                  const canDelete = isAdmin || entry.created_by === currentUserId
                  return (
                    <div key={entry.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-blue-600">
                          {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                        </div>
                        <div className="text-sm text-gray-700 mt-0.5 leading-relaxed">{entry.content}</div>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => deleteSchedule(entry.id)}
                          className="flex-shrink-0 text-xs text-red-400 hover:text-red-600 font-medium mt-0.5"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>

            <button onClick={() => setSelectedCalDate(null)}
              className="w-full mt-5 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              关闭
            </button>
          </div>
        </div>
      )}

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
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {remSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Reminder Detail Modal (click on reminder) ══════════ */}
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
                    : 'bg-blue-50 text-blue-700'
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
