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

// Alternating backgrounds for active (upcoming) reminder rows
const ROW_BG = ['bg-white', 'bg-gray-50']

const MAX_UPCOMING = 10   // cap before "show more"

type Reminder = {
  id: string
  due_date: string
  start_date: string | null
  end_date: string | null
  content: string
  type: string
  start_time: string | null
  end_time: string | null
  created_by: string
  created_at: string
  deleted: boolean
  deleted_by: string | null
  deleted_by_name: string | null
  deleted_at: string | null
  profiles?: { name: string }
}

interface SidebarProps {
  profile: { id: string; name: string; role: string } | null
}

// ── Helpers ───────────────────────────────────────────────────
function fmtTime(t: string | null) { return t ? t.slice(0, 5) : '' }

function remPrimaryDate(r: Reminder): string {
  return r.start_date || r.due_date
}
function remEndDate(r: Reminder): string {
  return r.end_date || r.start_date || r.due_date
}

/** Returns "mm/dd" or "mm/dd–mm/dd" */
function remDateLabel(r: Reminder): string {
  const sd = remPrimaryDate(r)
  const ed = remEndDate(r)
  const sd_label = sd.slice(5, 7) + '/' + sd.slice(8, 10)
  if (sd === ed) return sd_label
  return sd_label + '–' + ed.slice(5, 7) + '/' + ed.slice(8, 10)
}

/** Full date display for detail modal */
function remFullDateLabel(r: Reminder, todayStr: string): string {
  const sd = remPrimaryDate(r)
  const ed = remEndDate(r)
  const fmt = (s: string) => `${s.slice(0, 4)}/${s.slice(5, 7)}/${s.slice(8, 10)}`
  if (sd === ed) {
    return (sd === todayStr ? '今天 · ' : '') + fmt(sd)
  }
  return fmt(sd) + ' – ' + fmt(ed)
}

export default function Sidebar({ profile }: SidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const isAdmin = profile?.role === 'admin'
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const now      = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)

  // ── Add reminder form state ───────────────────────────────
  const [showAddRem,    setShowAddRem]    = useState(false)
  const [remStartDate,  setRemStartDate]  = useState(todayStr)
  const [remEndDate_,   setRemEndDate_]   = useState(todayStr)
  const [remContent,    setRemContent]    = useState('')
  const [remType,       setRemType]       = useState('others')
  const [remStartTime,  setRemStartTime]  = useState('')
  const [remEndTime,    setRemEndTime]    = useState('')
  const [remSaving,     setRemSaving]     = useState(false)

  // ── Reminder detail modal ─────────────────────────────────
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)

  // ── Daily stats modal (admin only) ────────────────────────
  const [showDailyStats,  setShowDailyStats]  = useState(false)
  const [statsDate,       setStatsDate]       = useState(todayStr)
  const [statsLoading,    setStatsLoading]    = useState(false)
  const [statsRecords,    setStatsRecords]    = useState<any[]>([])
  const [statsTodos,      setStatsTodos]      = useState<any[]>([])

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

  // ── Partition reminders ───────────────────────────────────
  const upcoming = reminders
    .filter(r => !r.deleted && remEndDate(r) >= todayStr)
    .sort((a, b) => remPrimaryDate(a).localeCompare(remPrimaryDate(b)))

  const past = reminders
    .filter(r => !r.deleted && remEndDate(r) < todayStr)
    .sort((a, b) => remPrimaryDate(b).localeCompare(remPrimaryDate(a)))

  const deleted = reminders
    .filter(r => r.deleted)
    .sort((a, b) => {
      const ta = a.deleted_at ?? remPrimaryDate(a)
      const tb = b.deleted_at ?? remPrimaryDate(b)
      return tb.localeCompare(ta)
    })

  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, MAX_UPCOMING)
  const hasMoreUpcoming = !showAllUpcoming && upcoming.length > MAX_UPCOMING

  // ── Save reminder ─────────────────────────────────────────
  async function saveReminder() {
    if (!remStartDate)          { alert('请填写开始日期'); return }
    if (!remEndDate_)           { alert('请填写结束日期'); return }
    if (!remContent.trim())     { alert('请填写内容'); return }
    if (remEndDate_ < remStartDate) { alert('结束日期不能早于开始日期'); return }
    if (remEndTime && remStartTime && remEndTime <= remStartTime) {
      alert('结束时间必须晚于开始时间'); return
    }
    setRemSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('reminders').insert({
      due_date:   remStartDate,   // backwards compat
      start_date: remStartDate,
      end_date:   remEndDate_,
      content:    remContent.trim(),
      type:       remType,
      start_time: remStartTime || null,
      end_time:   remEndTime   || null,
      created_by: user!.id,
    })
    if (error) { alert('保存失败：' + error.message) }
    else { setShowAddRem(false); resetAddForm(); await loadReminders() }
    setRemSaving(false)
  }

  function resetAddForm() {
    setRemContent(''); setRemStartDate(todayStr); setRemEndDate_(todayStr)
    setRemType('others'); setRemStartTime(''); setRemEndTime('')
  }

  // ── Soft-delete ───────────────────────────────────────────
  async function softDeleteReminder(id: string) {
    if (!confirm('确认删除该日程？删除后仍可在历史记录中查看。')) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase
      .from('profiles').select('name').eq('id', user!.id).single()
    const { error } = await supabase.from('reminders').update({
      deleted:          true,
      deleted_by:       user!.id,
      deleted_by_name:  prof?.name || '未知',
      deleted_at:       new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    setSelectedReminder(null)
    await loadReminders()
  }

  // ── Restore reminder (deleter or admin) ──────────────────
  async function restoreReminder(id: string) {
    const { error } = await supabase.from('reminders').update({
      deleted:          false,
      deleted_by:       null,
      deleted_by_name:  null,
      deleted_at:       null,
    }).eq('id', id)
    if (error) { alert('恢复失败：' + error.message); return }
    setSelectedReminder(null)
    await loadReminders()
  }

  // ── Admin hard-delete ─────────────────────────────────────
  async function hardDeleteReminder(id: string) {
    if (!confirm('确认永久删除该日程？此操作不可恢复。')) return
    const { error } = await supabase.from('reminders').delete().eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    setSelectedReminder(null)
    await loadReminders()
  }

  // ── Daily statistics ──────────────────────────────────────
  async function loadDailyStats() {
    setStatsLoading(true)
    const dayStart = `${statsDate}T00:00:00.000Z`
    const dayEnd   = `${statsDate}T23:59:59.999Z`

    const [{ data: recs }, { data: tdos }] = await Promise.all([
      supabase
        .from('work_records')
        .select('id, content, created_at, profiles!work_records_author_id_fkey(name), projects(name)')
        .eq('deleted', false)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at', { ascending: true }),
      supabase
        .from('todos')
        .select('id, content, assignee_abbrev, completed_at, completed_by_name')
        .eq('completed', true)
        .eq('deleted', false)
        .gte('completed_at', dayStart)
        .lte('completed_at', dayEnd)
        .order('completed_at', { ascending: true }),
    ])
    setStatsRecords(recs || [])
    setStatsTodos(tdos || [])
    setStatsLoading(false)
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

  // ── Single reminder row ───────────────────────────────────
  function ReminderRow({ r, index, variant }: {
    r: Reminder
    index: number
    variant: 'upcoming' | 'past' | 'deleted'
  }) {
    const primDate  = remPrimaryDate(r)
    const isToday   = primDate === todayStr
    const dateLabel = remDateLabel(r)

    const rowBg = variant === 'upcoming'
      ? (isToday ? '' : ROW_BG[index % 2])
      : ''

    const containerCls =
      variant === 'upcoming' && isToday
        ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
        : variant === 'upcoming'
        ? `${rowBg} border-gray-200 hover:border-teal-300 hover:bg-teal-50/40`
        : variant === 'past'
        ? 'bg-gray-50 border-gray-100 opacity-60 hover:opacity-80'
        : 'bg-red-50/40 border-red-100 opacity-50 hover:opacity-70'

    return (
      <button
        onClick={() => setSelectedReminder(r)}
        className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border transition-all ${containerCls}`}
      >
        {/* Date */}
        <span className={`text-xs font-bold mt-0.5 flex-shrink-0 w-auto min-w-9
          ${variant === 'upcoming' && isToday ? 'text-amber-600'
          : variant === 'upcoming' ? 'text-teal-600'
          : 'text-gray-400'}`}>
          {dateLabel}
        </span>

        <div className="min-w-0 flex-1">
          {/* Content */}
          <span className={`text-sm leading-snug line-clamp-2 block
            ${variant === 'deleted' ? 'line-through text-gray-400'
            : variant === 'past'    ? 'line-through text-gray-500'
            : isToday               ? 'text-amber-800 font-medium'
            : 'text-gray-800'}`}>
            {r.content}
          </span>

          {/* Meta row */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {/* Type badge — only for upcoming */}
            {variant === 'upcoming' && r.type && r.type !== 'others' && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded
                ${TYPE_COLORS[r.type] || TYPE_COLORS.others}`}>
                {TYPE_LABELS[r.type] || r.type}
              </span>
            )}
            {/* Time range */}
            {variant === 'upcoming' && r.start_time && (
              <span className="text-[10px] text-gray-400">
                {fmtTime(r.start_time)}{r.end_time ? `–${fmtTime(r.end_time)}` : ''}
              </span>
            )}
            {/* Past label */}
            {variant === 'past' && (
              <span className="text-[10px] text-gray-400">已过期</span>
            )}
            {/* Deleted label with operator */}
            {variant === 'deleted' && r.deleted_by_name && (
              <span className="text-[10px] text-red-400">
                已删除 · {r.deleted_by_name}
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }

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
          {/* Daily stats button — admin only */}
          {isAdmin && (
            <button
              onClick={() => { setShowDailyStats(true); setStatsRecords([]); setStatsTodos([]) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 text-left
                         text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <span className="text-base">📊</span>
              <span>日统计</span>
            </button>
          )}
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

            {/* ── Upcoming items ── */}
            {visibleUpcoming.map((r, i) => (
              <ReminderRow key={r.id} r={r} index={i} variant="upcoming" />
            ))}

            {hasMoreUpcoming && (
              <button
                onClick={() => setShowAllUpcoming(true)}
                className="w-full py-1.5 text-xs text-gray-500 hover:text-teal-600
                           border border-dashed border-gray-300 hover:border-teal-400
                           rounded-lg transition-colors"
              >
                查看更多（还有 {upcoming.length - MAX_UPCOMING} 条）
              </button>
            )}
            {showAllUpcoming && upcoming.length > MAX_UPCOMING && (
              <button
                onClick={() => setShowAllUpcoming(false)}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600
                           border border-dashed border-gray-200 rounded-lg transition-colors"
              >
                收起
              </button>
            )}

            {/* ── Past items ── */}
            {past.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">已过期 {past.length}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {past.map((r, i) => (
                  <ReminderRow key={r.id} r={r} index={i} variant="past" />
                ))}
              </>
            )}

            {/* ── Deleted items ── */}
            {deleted.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">已删除 {deleted.length}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {deleted.map((r, i) => (
                  <ReminderRow key={r.id} r={r} index={i} variant="deleted" />
                ))}
              </>
            )}

            {reminders.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">暂无日程</p>
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
              {/* Type — mandatory */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  类型 <span className="text-red-500">*</span>
                </label>
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

              {/* Date range — both mandatory */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    开始日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={remStartDate}
                    onChange={e => {
                      setRemStartDate(e.target.value)
                      if (remEndDate_ < e.target.value) setRemEndDate_(e.target.value)
                    }}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    结束日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={remEndDate_}
                    min={remStartDate}
                    onChange={e => setRemEndDate_(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Time range — optional */}
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

              {/* Content — mandatory */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  内容 <span className="text-red-500">*</span>
                </label>
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
              {/* Status badge */}
              {selectedReminder.deleted ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg">
                  <span className="text-xs text-red-500 font-semibold">已删除</span>
                  {selectedReminder.deleted_by_name && (
                    <span className="text-xs text-red-400">· 操作人：{selectedReminder.deleted_by_name}</span>
                  )}
                </div>
              ) : remEndDate(selectedReminder) < todayStr ? (
                <div className="px-3 py-1.5 bg-gray-100 rounded-lg">
                  <span className="text-xs text-gray-500 font-semibold">已过期</span>
                </div>
              ) : null}

              {/* Type badge */}
              {!selectedReminder.deleted && selectedReminder.type && selectedReminder.type !== 'others' && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                  ${TYPE_COLORS[selectedReminder.type] || TYPE_COLORS.others}`}>
                  {TYPE_LABELS[selectedReminder.type] || selectedReminder.type}
                </span>
              )}

              {/* Date range */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold
                ${remPrimaryDate(selectedReminder) === todayStr
                  ? 'bg-amber-100 text-amber-700'
                  : remEndDate(selectedReminder) < todayStr || selectedReminder.deleted
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-teal-50 text-teal-700'}`}>
                <span>📅</span>
                <span>{remFullDateLabel(selectedReminder, todayStr)}</span>
              </div>

              {/* Time range */}
              {selectedReminder.start_time && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <span>🕐</span>
                  <span>
                    {fmtTime(selectedReminder.start_time)}
                    {selectedReminder.end_time ? ` – ${fmtTime(selectedReminder.end_time)}` : ''}
                  </span>
                </div>
              )}

              {/* Content */}
              <p className={`text-sm leading-relaxed whitespace-pre-wrap
                ${selectedReminder.deleted || remEndDate(selectedReminder) < todayStr
                  ? 'text-gray-400 line-through'
                  : 'text-gray-800'}`}>
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
              {/* Soft-delete: any member, non-deleted items */}
              {!selectedReminder.deleted && (
                <button
                  onClick={() => softDeleteReminder(selectedReminder.id)}
                  className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                >
                  删除
                </button>
              )}
              {/* Restore: deleter or admin */}
              {selectedReminder.deleted &&
                (currentUserId === selectedReminder.deleted_by || isAdmin) && (
                <button
                  onClick={() => restoreReminder(selectedReminder.id)}
                  className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                >
                  恢复
                </button>
              )}
              {/* Hard-delete: admin only, already soft-deleted */}
              {selectedReminder.deleted && isAdmin && (
                <button
                  onClick={() => hardDeleteReminder(selectedReminder.id)}
                  className="flex-1 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors"
                >
                  永久删除
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Daily Statistics Modal (admin only) ════════════════ */}
      {showDailyStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">日统计</h3>
              <button onClick={() => setShowDailyStats(false)}
                className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* Date picker */}
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0 flex items-center gap-3">
              <input
                type="date"
                value={statsDate}
                onChange={e => setStatsDate(e.target.value)}
                className="input-field w-44"
              />
              <button
                onClick={loadDailyStats}
                disabled={statsLoading}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {statsLoading ? '查询中…' : '确认'}
              </button>
              {(statsRecords.length > 0 || statsTodos.length > 0) && !statsLoading && (
                <span className="text-xs text-gray-400">
                  共 {statsRecords.length + statsTodos.length} 条
                </span>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {statsLoading && (
                <p className="text-sm text-gray-400 text-center py-8">查询中…</p>
              )}

              {!statsLoading && statsRecords.length === 0 && statsTodos.length === 0 && (statsRecords !== null) && (
                <p className="text-sm text-gray-400 text-center py-8">该日暂无记录</p>
              )}

              {/* Work records section */}
              {!statsLoading && statsRecords.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    工作记录 <span className="text-gray-400 font-normal">({statsRecords.length})</span>
                  </h4>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-24">项目</th>
                        <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">内容</th>
                        <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-14">操作人</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsRecords.map((r: any) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5 border border-gray-200 text-gray-600">
                            {r.projects?.name || '—'}
                          </td>
                          <td className="px-2 py-1.5 border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {r.content}
                          </td>
                          <td className="px-2 py-1.5 border border-gray-200 text-gray-500">
                            {r.profiles?.name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Completed todos section */}
              {!statsLoading && statsTodos.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    已完成待办 <span className="text-gray-400 font-normal">({statsTodos.length})</span>
                  </h4>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">内容</th>
                        <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-10">负责</th>
                        <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-16">完成时间</th>
                        <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-14">操作人</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsTodos.map((t: any) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5 border border-gray-200 text-gray-800">{t.content}</td>
                          <td className="px-2 py-1.5 border border-gray-200 text-center text-teal-600 font-bold">
                            {t.assignee_abbrev || '—'}
                          </td>
                          <td className="px-2 py-1.5 border border-gray-200 text-gray-500">
                            {t.completed_at
                              ? new Date(t.completed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </td>
                          <td className="px-2 py-1.5 border border-gray-200 text-gray-500">
                            {t.completed_by_name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
