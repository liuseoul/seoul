'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ScheduleEntry = { start_time: string; end_time: string; content: string }
type ScheduleMap  = Record<string, ScheduleEntry[]>

function MiniCalendar({
  year, month, schedulesByDate,
}: {
  year: number
  month: number
  schedulesByDate: ScheduleMap
}) {
  const [tooltip, setTooltip] = useState<{ entries: ScheduleEntry[]; x: number; y: number } | null>(null)

  const firstDay   = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today      = new Date()

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
            className={`text-[11px] py-1 leading-none rounded transition-colors
              ${!day ? '' :
                isToday(day) ? 'bg-blue-600 text-white font-bold' :
                hasEvent(day) ? 'text-amber-400 font-semibold cursor-pointer hover:bg-slate-700' :
                'text-slate-400'
              }`}
            onMouseEnter={day && hasEvent(day) ? (e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setTooltip({
                entries: schedulesByDate[dateStr(day)],
                x: rect.right + 10,
                y: rect.top,
              })
            } : undefined}
            onMouseLeave={day && hasEvent(day) ? () => setTooltip(null) : undefined}
          >
            {day || ''}
          </div>
        ))}
      </div>

      {/* Hover tooltip — fixed positioned, appears to the right of the sidebar */}
      {tooltip && (
        <div
          style={{ position: 'fixed', left: tooltip.x, top: tooltip.y, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl p-3 w-52 text-xs pointer-events-none"
        >
          {tooltip.entries
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map((entry, i) => (
              <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-gray-100' : ''}>
                <div className="font-semibold text-blue-600 mb-0.5">
                  {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                </div>
                <div className="text-gray-700 leading-relaxed">{entry.content}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

interface SidebarProps {
  profile: { id: string; name: string; role: string } | null
}

export default function Sidebar({ profile }: SidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const now = new Date()
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [schedulesByDate, setSchedulesByDate] = useState<ScheduleMap>({})
  const [showModal, setShowModal] = useState(false)

  // Schedule form state
  const [schDate,    setSchDate]    = useState(now.toISOString().split('T')[0])
  const [schStart,   setSchStart]   = useState('09:00')
  const [schEnd,     setSchEnd]     = useState('10:00')
  const [schContent, setSchContent] = useState('')
  const [schSaving,  setSchSaving]  = useState(false)

  useEffect(() => { loadSchedules() }, [calYear, calMonth])

  async function loadSchedules() {
    const pad   = (n: number) => String(n).padStart(2, '0')
    const first = `${calYear}-${pad(calMonth + 1)}-01`
    const last  = `${calYear}-${pad(calMonth + 1)}-${new Date(calYear, calMonth + 1, 0).getDate()}`

    const { data } = await supabase
      .from('schedules')
      .select('date, start_time, end_time, content')
      .gte('date', first)
      .lte('date', last)

    const map: ScheduleMap = {}
    for (const r of (data || [])) {
      if (!map[r.date]) map[r.date] = []
      map[r.date].push({ start_time: r.start_time, end_time: r.end_time, content: r.content })
    }
    setSchedulesByDate(map)
  }

  function prevMonth() {
    const d = new Date(calYear, calMonth - 1)
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth())
  }
  function nextMonth() {
    const d = new Date(calYear, calMonth + 1)
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth())
  }

  async function saveSchedule() {
    if (!schDate || !schStart || !schEnd || !schContent.trim()) {
      alert('请填写完整信息'); return
    }
    if (schEnd <= schStart) {
      alert('结束时间必须晚于开始时间'); return
    }
    setSchSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('schedules').insert({
      date: schDate, start_time: schStart, end_time: schEnd,
      content: schContent.trim(), created_by: user!.id,
    })
    if (error) {
      alert('保存失败：' + error.message)
    } else {
      setShowModal(false)
      setSchContent('')
      const d = new Date(schDate)
      setCalYear(d.getFullYear())
      setCalMonth(d.getMonth())
      await loadSchedules()
    }
    setSchSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { href: '/projects', label: '项目概览', icon: '📋' },
    ...(profile?.role === 'admin' ? [{ href: '/admin', label: '管理后台', icon: '⚙️' }] : []),
  ]

  return (
    <>
      <div className="w-56 bg-slate-900 text-white flex flex-col h-full flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">D</div>
            <div>
              <div className="text-sm font-semibold leading-tight">Project Mgmt</div>
              <div className="text-xs text-slate-400 leading-tight mt-0.5">Deheng Team</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-3 space-y-1 border-b border-slate-700">
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
        <div className="px-3 py-3 border-b border-slate-700">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="text-slate-400 hover:text-white w-6 text-center text-sm">‹</button>
            <span className="text-xs text-slate-300 font-medium">
              {calYear} / {String(calMonth + 1).padStart(2, '0')}
            </span>
            <button onClick={nextMonth} className="text-slate-400 hover:text-white w-6 text-center text-sm">›</button>
          </div>

          <MiniCalendar year={calYear} month={calMonth} schedulesByDate={schedulesByDate} />

          {/* 增加日程 button */}
          <button
            onClick={() => setShowModal(true)}
            className="w-full mt-3 py-1.5 text-xs font-medium rounded-lg border border-slate-600
                       text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            + 增加日程
          </button>
        </div>

        {/* User info & logout */}
        <div className="px-3 py-4 mt-auto">
          <div className="px-3 py-2 mb-1">
            <div className="text-sm font-medium text-white truncate">{profile?.name || 'User'}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {profile?.role === 'admin' ? 'Administrator' : 'Member'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                       text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-150"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Add Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">增加日程</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                <input
                  type="date"
                  value={schDate}
                  onChange={e => setSchDate(e.target.value)}
                  className="input-field"
                />
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
                <textarea
                  value={schContent}
                  onChange={e => setSchContent(e.target.value)}
                  placeholder="日程内容…"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveSchedule}
                disabled={schSaving}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {schSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
