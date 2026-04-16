'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TYPE_LABELS: Record<string, string> = {
  online_meeting:     '线上会议',
  visiting:           '拜访',
  business_travel:    '出差',
  personal_leave:     '请假',
  visiting_reception: '接待访客',
  others:             '其他',
}

const TYPE_COLORS: Record<string, string> = {
  online_meeting:     'bg-blue-100 text-blue-700',
  visiting:           'bg-purple-100 text-purple-700',
  business_travel:    'bg-orange-100 text-orange-700',
  personal_leave:     'bg-yellow-100 text-yellow-700',
  visiting_reception: 'bg-green-100 text-green-700',
  others:             'bg-gray-100 text-gray-600',
}

const ROW_BG    = ['bg-white', 'bg-gray-50']
const MAX_UPCOMING = 10

type Member = { id: string; name: string }

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
  assigned_to_name: string | null
  profiles?: { name: string }
}

interface SidebarProps {
  profile: { id: string; name: string; role: string } | null
}

// ── Pure helpers (no hooks, safe anywhere) ────────────────────
function fmtTime(t: string | null) { return t ? t.slice(0, 5) : '' }
function remPrimaryDate(r: Reminder) { return r.start_date || r.due_date }
function remEndDate(r: Reminder)     { return r.end_date || r.start_date || r.due_date }

function remDateLabel(r: Reminder) {
  const sd = remPrimaryDate(r), ed = remEndDate(r)
  const sl = sd.slice(5, 7) + '/' + sd.slice(8, 10)
  return sd === ed ? sl : sl + '–' + ed.slice(5, 7) + '/' + ed.slice(8, 10)
}

function remFullDateLabel(r: Reminder, today: string) {
  const sd = remPrimaryDate(r), ed = remEndDate(r)
  const fmt = (s: string) => `${s.slice(0,4)}/${s.slice(5,7)}/${s.slice(8,10)}`
  return sd === ed ? (sd === today ? '今天 · ' : '') + fmt(sd) : fmt(sd) + ' – ' + fmt(ed)
}

// ── Stats table ───────────────────────────────────────────────
function StatsTable({ loading, queried, records, timeLogs, todos, showOperator, groupByProject }: {
  loading: boolean; queried: boolean
  records: any[]; timeLogs: any[]; todos: any[]
  showOperator: boolean; groupByProject?: boolean
}) {
  if (loading) return <p className="text-sm text-gray-400 text-center py-8">查询中…</p>
  if (!queried) return <p className="text-sm text-gray-400 text-center py-8">请选择日期后点击确认</p>
  if (records.length === 0 && timeLogs.length === 0 && todos.length === 0)
    return <p className="text-sm text-gray-400 text-center py-8">该日暂无记录</p>

  function durMins(started: string, finished: string | null) {
    if (!finished) return '—'
    const m = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 60000)
    return m > 0 ? `${m} 分钟` : '—'
  }

  // ── Grouped-by-project rendering (for group stats) ──────
  if (groupByProject && (records.length > 0 || timeLogs.length > 0)) {
    type PGroup = { id: string; name: string; createdAt: string; records: any[]; timeLogs: any[] }
    const projectMap = new Map<string, PGroup>()

    for (const r of records) {
      const pid = r.projects?.id || '__none__'
      if (!projectMap.has(pid)) {
        projectMap.set(pid, { id: pid, name: r.projects?.name || '—', createdAt: r.projects?.created_at || '0', records: [], timeLogs: [] })
      }
      projectMap.get(pid)!.records.push(r)
    }
    for (const l of timeLogs) {
      const pid = l.projects?.id || '__none__'
      if (!projectMap.has(pid)) {
        projectMap.set(pid, { id: pid, name: l.projects?.name || '—', createdAt: l.projects?.created_at || '0', records: [], timeLogs: [] })
      }
      projectMap.get(pid)!.timeLogs.push(l)
    }

    const groups = Array.from(projectMap.values()).sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    return (
      <div className="space-y-4">
        {groups.map(group => (
          <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-teal-50 px-3 py-1.5 flex items-center">
              <span className="text-xs font-semibold text-teal-700">{group.name}</span>
              <span className="ml-2 text-[10px] text-teal-500">
                {group.records.length > 0 && `工作 ${group.records.length}`}
                {group.records.length > 0 && group.timeLogs.length > 0 && ' · '}
                {group.timeLogs.length > 0 && `工时 ${group.timeLogs.length}`}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {group.records.map((r: any) => (
                <div key={`r-${r.id}`} className="px-3 py-2 text-xs bg-white">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-gray-400 text-[10px]">工作记录</span>
                    <span className="text-gray-400">{new Date(r.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                    {showOperator && <span className="text-indigo-500 font-medium">{r.profiles?.name || '—'}</span>}
                  </div>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{r.content}</p>
                </div>
              ))}
              {group.timeLogs.map((l: any) => {
                const startStr = new Date(l.started_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                const endStr   = l.finished_at ? new Date(l.finished_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'
                return (
                  <div key={`t-${l.id}`} className="px-3 py-2 text-xs bg-white">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-gray-400 text-[10px]">工时记录</span>
                      <span className="text-gray-400">{startStr}–{endStr}</span>
                      <span className="text-teal-600 font-semibold">{durMins(l.started_at, l.finished_at)}</span>
                      {showOperator && <span className="text-indigo-500 font-medium">{l.profiles?.name || '—'}</span>}
                    </div>
                    {l.description && <p className="text-gray-800">{l.description}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Todos — grouped by operator when showOperator=true (group stats) */}
        {todos.length > 0 && (() => {
          if (showOperator) {
            // Group by completed_by_name
            const opMap = new Map<string, any[]>()
            for (const t of todos) {
              const op = t.completed_by_name || '未知'
              if (!opMap.has(op)) opMap.set(op, [])
              opMap.get(op)!.push(t)
            }
            const opGroups = Array.from(opMap.entries())
            return (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  已完成待办 <span className="text-gray-400 font-normal">({todos.length})</span>
                </h4>
                <div className="space-y-2">
                  {opGroups.map(([op, items]) => (
                    <div key={op} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-indigo-50 px-3 py-1.5 flex items-center gap-2">
                        <span className="text-xs font-semibold text-indigo-700">{op}</span>
                        <span className="text-[10px] text-indigo-400">{items.length} 项</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {items.map((t: any) => (
                          <div key={t.id} className="flex items-baseline gap-2 px-3 py-1.5 text-xs bg-white">
                            <span className="text-gray-400 flex-shrink-0">
                              {t.completed_at ? new Date(t.completed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                            <span className="text-gray-800 flex-1 leading-relaxed">{t.content}</span>
                            {t.assignee_abbrev && (
                              <span className="text-teal-600 font-bold flex-shrink-0">{t.assignee_abbrev}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
          // Personal stats — flat table (original layout)
          return (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                已完成待办 <span className="text-gray-400 font-normal">({todos.length})</span>
              </h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">内容</th>
                    <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-10">负责</th>
                    <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-16">完成时间</th>
                  </tr>
                </thead>
                <tbody>
                  {todos.map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-800">{t.content}</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-teal-600 font-bold">{t.assignee_abbrev || '—'}</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-500">
                        {t.completed_at ? new Date(t.completed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Work records */}
      {records.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            工作记录 <span className="text-gray-400 font-normal">({records.length})</span>
          </h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-24">项目</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">内容</th>
                {showOperator && <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-14">操作人</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5 border border-gray-200 text-gray-600">{r.projects?.name || '—'}</td>
                  <td className="px-2 py-1.5 border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed">{r.content}</td>
                  {showOperator && <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{r.profiles?.name || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Time logs */}
      {timeLogs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            工时记录 <span className="text-gray-400 font-normal">({timeLogs.length})</span>
          </h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-24">项目</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-20">时段</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-16">时长</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">内容</th>
                {showOperator && <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-14">操作人</th>}
              </tr>
            </thead>
            <tbody>
              {timeLogs.map((l: any) => {
                const startStr = new Date(l.started_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                const endStr   = l.finished_at ? new Date(l.finished_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 border border-gray-200 text-gray-600">{l.projects?.name || '—'}</td>
                    <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{startStr}–{endStr}</td>
                    <td className="px-2 py-1.5 border border-gray-200 text-teal-600 font-semibold">{durMins(l.started_at, l.finished_at)}</td>
                    <td className="px-2 py-1.5 border border-gray-200 text-gray-800">{l.description || '—'}</td>
                    {showOperator && <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{l.profiles?.name || '—'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Completed todos */}
      {todos.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            已完成待办 <span className="text-gray-400 font-normal">({todos.length})</span>
          </h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">内容</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-10">负责</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-16">完成时间</th>
                {showOperator && <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-14">操作人</th>}
              </tr>
            </thead>
            <tbody>
              {todos.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5 border border-gray-200 text-gray-800">{t.content}</td>
                  <td className="px-2 py-1.5 border border-gray-200 text-center text-teal-600 font-bold">{t.assignee_abbrev || '—'}</td>
                  <td className="px-2 py-1.5 border border-gray-200 text-gray-500">
                    {t.completed_at ? new Date(t.completed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  {showOperator && <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{t.completed_by_name || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ profile }: SidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const isAdmin    = profile?.role === 'admin'
  const todayStr   = new Date().toISOString().split('T')[0]

  const [currentUserId,   setCurrentUserId]   = useState<string | null>(null)
  const [reminders,       setReminders]       = useState<Reminder[]>([])
  const [members,         setMembers]         = useState<Member[]>([])
  const [showAllUpcoming,  setShowAllUpcoming]  = useState(false)
  const [showCalendarAll,  setShowCalendarAll]  = useState(false)

  // ── Add form state ────────────────────────────────────────
  const [showAddRem,   setShowAddRem]   = useState(false)
  const [remType,      setRemType]      = useState('others')
  const [remStartDate, setRemStartDate] = useState(todayStr)
  const [remEndDate_,  setRemEndDate_]  = useState(todayStr)
  const [remStartTime, setRemStartTime] = useState('')
  const [remEndTime,   setRemEndTime]   = useState('')
  const [remContent,   setRemContent]   = useState('')
  const [remAssigned,  setRemAssigned]  = useState('')
  const [remSaving,    setRemSaving]    = useState(false)

  // ── Detail / edit modal state ─────────────────────────────
  const [selectedRem, setSelectedRem] = useState<Reminder | null>(null)
  const [detailMode,  setDetailMode]  = useState<'view' | 'edit'>('view')
  const [editType,      setEditType]      = useState('others')
  const [editStartDate, setEditStartDate] = useState(todayStr)
  const [editEndDate_,  setEditEndDate_]  = useState(todayStr)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime,   setEditEndTime]   = useState('')
  const [editContent,   setEditContent]   = useState('')
  const [editAssigned,  setEditAssigned]  = useState('')
  const [editSaving,    setEditSaving]    = useState(false)

  // ── Personal daily stats (all members) ───────────────────
  const [showPersonalStats,  setShowPersonalStats]  = useState(false)
  const [personalMode,       setPersonalMode]       = useState<'single' | 'range'>('single')
  const [personalDate,       setPersonalDate]       = useState(todayStr)
  const [personalRangeStart, setPersonalRangeStart] = useState(todayStr.slice(0, 7) + '-01')
  const [personalRangeEnd,   setPersonalRangeEnd]   = useState(todayStr)
  const [personalLoading,    setPersonalLoading]    = useState(false)
  const [personalQueried,    setPersonalQueried]    = useState(false)
  const [personalRecords,    setPersonalRecords]    = useState<any[]>([])
  const [personalTimeLogs,   setPersonalTimeLogs]   = useState<any[]>([])
  const [personalTodos,      setPersonalTodos]      = useState<any[]>([])

  // ── Group daily stats (admin only) ────────────────────────
  const [showGroupStats,  setShowGroupStats]  = useState(false)
  const [groupMode,       setGroupMode]       = useState<'single' | 'range'>('single')
  const [groupDate,       setGroupDate]       = useState(todayStr)
  const [groupRangeStart, setGroupRangeStart] = useState(todayStr.slice(0, 7) + '-01')
  const [groupRangeEnd,   setGroupRangeEnd]   = useState(todayStr)
  const [groupLoading,    setGroupLoading]    = useState(false)
  const [groupQueried,    setGroupQueried]    = useState(false)
  const [groupRecords,    setGroupRecords]    = useState<any[]>([])
  const [groupTimeLogs,   setGroupTimeLogs]   = useState<any[]>([])
  const [groupTodos,      setGroupTodos]      = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null))
    loadReminders()
    loadMembers()
  }, [])

  async function loadReminders() {
    const { data } = await supabase
      .from('reminders').select('*, profiles(name)').order('due_date', { ascending: true })
    setReminders(data || [])
  }

  async function loadMembers() {
    const { data } = await supabase.from('profiles').select('id, name').order('name')
    setMembers(data || [])
  }

  // ── Partitions ─────────────────────────────────────────────
  const upcoming = reminders
    .filter(r => !r.deleted && remEndDate(r) >= todayStr)
    .sort((a, b) => remPrimaryDate(a).localeCompare(remPrimaryDate(b)))
  const past = reminders
    .filter(r => !r.deleted && remEndDate(r) < todayStr)
    .sort((a, b) => remPrimaryDate(b).localeCompare(remPrimaryDate(a)))
  const deletedRems = reminders
    .filter(r => r.deleted)
    .sort((a, b) => (b.deleted_at ?? remPrimaryDate(b)).localeCompare(a.deleted_at ?? remPrimaryDate(a)))

  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, MAX_UPCOMING)
  const hasMoreUpcoming = !showAllUpcoming && upcoming.length > MAX_UPCOMING

  // ── Save new reminder ────────────────────────────────────
  async function saveReminder() {
    if (!remStartDate || !remEndDate_ || !remContent.trim()) { alert('请填写必填项'); return }
    if (remEndDate_ < remStartDate) { alert('结束日期不能早于开始日期'); return }
    if (remEndTime && remStartTime && remEndTime <= remStartTime) { alert('结束时间必须晚于开始时间'); return }
    setRemSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('reminders').insert({
      due_date: remStartDate, start_date: remStartDate, end_date: remEndDate_,
      content: remContent.trim(), type: remType,
      start_time: remStartTime || null, end_time: remEndTime || null,
      assigned_to_name: remAssigned || null,
      created_by: user!.id,
    })
    if (error) { alert('保存失败：' + error.message) }
    else { setShowAddRem(false); resetAddForm(); await loadReminders() }
    setRemSaving(false)
  }

  function resetAddForm() {
    setRemContent(''); setRemStartDate(todayStr); setRemEndDate_(todayStr)
    setRemType('others'); setRemStartTime(''); setRemEndTime(''); setRemAssigned('')
  }

  // ── Detail modal helpers ──────────────────────────────────
  function openDetailRem(r: Reminder) { setSelectedRem(r); setDetailMode('view') }
  function closeDetailRem()           { setSelectedRem(null); setDetailMode('view') }

  function startEditRem(r: Reminder) {
    setEditType(r.type || 'others')
    setEditStartDate(r.start_date || r.due_date)
    setEditEndDate_(r.end_date || r.start_date || r.due_date)
    setEditStartTime(r.start_time || '')
    setEditEndTime(r.end_time || '')
    setEditContent(r.content)
    setEditAssigned(r.assigned_to_name || '')
    setDetailMode('edit')
  }

  async function saveEditRem() {
    if (!editStartDate || !editEndDate_ || !editContent.trim()) { alert('请填写必填项'); return }
    if (editEndDate_ < editStartDate) { alert('结束日期不能早于开始日期'); return }
    if (editEndTime && editStartTime && editEndTime <= editStartTime) { alert('结束时间必须晚于开始时间'); return }
    setEditSaving(true)
    const { error } = await supabase.from('reminders').update({
      due_date: editStartDate, start_date: editStartDate, end_date: editEndDate_,
      content: editContent.trim(), type: editType,
      start_time: editStartTime || null, end_time: editEndTime || null,
      assigned_to_name: editAssigned || null,
    }).eq('id', selectedRem!.id)
    setEditSaving(false)
    if (error) { alert('保存失败：' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function softDeleteReminder(id: string) {
    if (!confirm('确认删除该日程？删除后仍可在历史记录中查看。')) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', user!.id).single()
    const { error } = await supabase.from('reminders').update({
      deleted: true, deleted_by: user!.id,
      deleted_by_name: prof?.name || '未知', deleted_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function restoreReminder(id: string) {
    const { error } = await supabase.from('reminders').update({
      deleted: false, deleted_by: null, deleted_by_name: null, deleted_at: null,
    }).eq('id', id)
    if (error) { alert('恢复失败：' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function hardDeleteReminder(id: string) {
    if (!confirm('确认永久删除？此操作不可恢复。')) return
    const { error } = await supabase.from('reminders').delete().eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  // ── Personal stats ────────────────────────────────────────
  async function loadPersonalStats() {
    if (!currentUserId) return
    setPersonalLoading(true); setPersonalQueried(true)
    const startDay = personalMode === 'range' ? personalRangeStart : personalDate
    const endDay   = personalMode === 'range' ? personalRangeEnd   : personalDate
    if (endDay < startDay) { alert('结束日期不能早于开始日期'); setPersonalLoading(false); setPersonalQueried(false); return }
    const s = `${startDay}T00:00:00.000Z`, e = `${endDay}T23:59:59.999Z`
    const [{ data: recs }, { data: logs }, { data: tdos }] = await Promise.all([
      supabase.from('work_records')
        .select('id, content, created_at, projects(name)')
        .eq('author_id', currentUserId).eq('deleted', false)
        .gte('created_at', s).lte('created_at', e).order('created_at', { ascending: true }),
      supabase.from('time_logs')
        .select('id, started_at, finished_at, description, projects(name)')
        .eq('member_id', currentUserId).eq('deleted', false)
        .gte('started_at', s).lte('started_at', e).order('started_at', { ascending: true }),
      supabase.from('todos')
        .select('id, content, assignee_abbrev, completed_at, completed_by_name')
        .eq('completed', true).eq('deleted', false)
        .eq('completed_by_name', profile?.name || '')
        .gte('completed_at', s).lte('completed_at', e).order('completed_at', { ascending: true }),
    ])
    setPersonalRecords(recs || []); setPersonalTimeLogs(logs || []); setPersonalTodos(tdos || [])
    setPersonalLoading(false)
  }

  // ── Group stats (admin) ───────────────────────────────────
  async function loadGroupStats() {
    setGroupLoading(true); setGroupQueried(true)
    const startDay = groupMode === 'range' ? groupRangeStart : groupDate
    const endDay   = groupMode === 'range' ? groupRangeEnd   : groupDate
    if (endDay < startDay) { alert('结束日期不能早于开始日期'); setGroupLoading(false); setGroupQueried(false); return }
    const s = `${startDay}T00:00:00.000Z`, e = `${endDay}T23:59:59.999Z`
    const [{ data: recs }, { data: logs }, { data: tdos }] = await Promise.all([
      supabase.from('work_records')
        .select('id, content, created_at, profiles!work_records_author_id_fkey(name), projects(id, name, created_at)')
        .eq('deleted', false)
        .gte('created_at', s).lte('created_at', e).order('created_at', { ascending: true }),
      supabase.from('time_logs')
        .select('id, started_at, finished_at, description, profiles!time_logs_member_id_fkey(name), projects(id, name, created_at)')
        .eq('deleted', false)
        .gte('started_at', s).lte('started_at', e).order('started_at', { ascending: true }),
      supabase.from('todos')
        .select('id, content, assignee_abbrev, completed_at, completed_by_name')
        .eq('completed', true).eq('deleted', false)
        .gte('completed_at', s).lte('completed_at', e).order('completed_at', { ascending: true }),
    ])
    setGroupRecords(recs || []); setGroupTimeLogs(logs || []); setGroupTodos(tdos || [])
    setGroupLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut(); router.push('/login'); router.refresh()
  }

  // ── Render helpers (no inputs → safe inside component) ────
  function TypeGrid({ current, onSet }: { current: string; onSet: (v: string) => void }) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(TYPE_LABELS).map(([val, label]) => (
          <button key={val} type="button" onClick={() => onSet(val)}
            className={`py-1.5 px-3 text-sm rounded-lg border transition-colors text-left
              ${current === val ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>
    )
  }

  function MemberSelector({ current, onSet }: { current: string; onSet: (v: string) => void }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onSet('')}
          className={`text-xs px-2 py-1 rounded border transition-colors
            ${current === '' ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          不指定
        </button>
        {members.map(m => (
          <button key={m.id} type="button" onClick={() => onSet(m.name)}
            className={`text-xs px-2 py-1 rounded border transition-colors
              ${current === m.name ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {m.name}
          </button>
        ))}
      </div>
    )
  }

  // ReminderRow — no inputs inside, safe to define inside component
  function ReminderRow({ r, index, variant }: { r: Reminder; index: number; variant: 'upcoming' | 'past' | 'deleted' }) {
    const primDate  = remPrimaryDate(r)
    const isToday   = primDate === todayStr
    const dateLabel = remDateLabel(r)
    const rowBg     = variant === 'upcoming' ? (isToday ? '' : ROW_BG[index % 2]) : ''
    const cls =
      variant === 'upcoming' && isToday ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
      : variant === 'upcoming'          ? `${rowBg} border-gray-200 hover:border-teal-300 hover:bg-teal-50/40`
      : variant === 'past'              ? 'bg-gray-50 border-gray-100 opacity-60 hover:opacity-80'
      : 'bg-red-50/40 border-red-100 opacity-50 hover:opacity-70'
    return (
      <button onClick={() => openDetailRem(r)}
        className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border transition-all ${cls}`}>
        <span className={`text-xs font-bold mt-0.5 flex-shrink-0 min-w-9
          ${variant === 'upcoming' && isToday ? 'text-amber-600' : variant === 'upcoming' ? 'text-teal-600' : 'text-gray-400'}`}>
          {dateLabel}
        </span>
        <div className="min-w-0 flex-1">
          <span className={`text-sm leading-snug line-clamp-2 block
            ${variant === 'deleted' ? 'line-through text-gray-400'
            : variant === 'past'    ? 'line-through text-gray-500'
            : isToday               ? 'text-amber-800 font-medium'
            : 'text-gray-800'}`}>
            {r.content}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {variant === 'upcoming' && r.type && r.type !== 'others' && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[r.type] || TYPE_COLORS.others}`}>
                {TYPE_LABELS[r.type] || r.type}
              </span>
            )}
            {variant === 'upcoming' && r.assigned_to_name && (
              <span className="text-[10px] text-indigo-500 font-medium">@{r.assigned_to_name}</span>
            )}
            {variant === 'upcoming' && r.start_time && (
              <span className="text-[10px] text-gray-400">
                {fmtTime(r.start_time)}{r.end_time ? `–${fmtTime(r.end_time)}` : ''}
              </span>
            )}
            {variant === 'past'    && <span className="text-[10px] text-gray-400">已过期</span>}
            {variant === 'deleted' && r.deleted_by_name && (
              <span className="text-[10px] text-red-400">已删除 · {r.deleted_by_name}</span>
            )}
          </div>
        </div>
      </button>
    )
  }

  // ── Reusable form fields for add/edit modals ──────────────
  function DateTimeFields({
    startDate, endDate, startTime, endTime,
    onStartDate, onEndDate, onStartTime, onEndTime,
  }: {
    startDate: string; endDate: string; startTime: string; endTime: string
    onStartDate: (v: string) => void; onEndDate: (v: string) => void
    onStartTime: (v: string) => void; onEndTime:  (v: string) => void
  }) {
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">开始日期 <span className="text-red-500">*</span></label>
            <input type="date" value={startDate}
              onChange={e => { onStartDate(e.target.value); if (endDate < e.target.value) onEndDate(e.target.value) }}
              className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束日期 <span className="text-red-500">*</span></label>
            <input type="date" value={endDate} min={startDate} onChange={e => onEndDate(e.target.value)} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
            <input type="time" value={startTime} onChange={e => onStartTime(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
            <input type="time" value={endTime} onChange={e => onEndTime(e.target.value)} className="input-field" />
          </div>
        </div>
      </>
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
          {[
            { href: '/projects', label: '项目概览', icon: '📋' },
            ...(isAdmin ? [{ href: '/admin', label: '管理后台', icon: '⚙️' }] : []),
          ].map(item => (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 text-left
                ${pathname === item.href ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          {/* Personal daily stats — visible to all */}
          <button
            onClick={() => { setShowPersonalStats(true); setPersonalRecords([]); setPersonalTimeLogs([]); setPersonalTodos([]); setPersonalQueried(false) }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150 text-left">
            <span className="text-base">📊</span><span>个人日统计</span>
          </button>

          {/* Group daily stats — admin only */}
          {isAdmin && (
            <button
              onClick={() => { setShowGroupStats(true); setGroupRecords([]); setGroupTimeLogs([]); setGroupTodos([]); setGroupQueried(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150 text-left">
              <span className="text-base">📊</span><span>团队日统计</span>
            </button>
          )}
        </nav>

        {/* 日程安排 */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">日程安排</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowCalendarAll(true)}
                className="text-xs text-gray-500 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-300 hover:border-teal-400 transition-colors">
                全部
              </button>
              <button onClick={() => setShowAddRem(true)}
                className="text-xs text-gray-500 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-300 hover:border-teal-400 transition-colors">
                + 添加
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
            {visibleUpcoming.map((r, i) => <ReminderRow key={r.id} r={r} index={i} variant="upcoming" />)}
            {hasMoreUpcoming && (
              <button onClick={() => setShowAllUpcoming(true)}
                className="w-full py-1.5 text-xs text-gray-500 hover:text-teal-600 border border-dashed border-gray-300 hover:border-teal-400 rounded-lg transition-colors">
                查看更多（还有 {upcoming.length - MAX_UPCOMING} 条）
              </button>
            )}
            {showAllUpcoming && upcoming.length > MAX_UPCOMING && (
              <button onClick={() => setShowAllUpcoming(false)}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-lg transition-colors">
                收起
              </button>
            )}
            {past.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">已过期 {past.length}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {past.map((r, i) => <ReminderRow key={r.id} r={r} index={i} variant="past" />)}
              </>
            )}
            {deletedRems.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">已删除 {deletedRems.length}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {deletedRems.map((r, i) => <ReminderRow key={r.id} r={r} index={i} variant="deleted" />)}
              </>
            )}
            {reminders.length === 0 && <p className="text-xs text-gray-400 text-center py-4">暂无日程</p>}
          </div>
        </div>

        {/* User info & logout */}
        <div className="px-3 py-4 border-t border-gray-200 flex-shrink-0">
          <div className="px-3 py-2 mb-1">
            <div className="text-sm font-medium text-gray-900 truncate">{profile?.name || 'User'}</div>
            <div className="text-xs text-gray-400 mt-0.5">{isAdmin ? 'Administrator' : 'Member'}</div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150">
            <span>🚪</span><span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* ══ Add Reminder Modal ═════════════════════════════════ */}
      {showAddRem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">添加日程</h3>
              <button onClick={() => { setShowAddRem(false); resetAddForm() }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型 <span className="text-red-500">*</span></label>
                <TypeGrid current={remType} onSet={setRemType} />
              </div>
              <DateTimeFields
                startDate={remStartDate} endDate={remEndDate_}
                startTime={remStartTime} endTime={remEndTime}
                onStartDate={setRemStartDate} onEndDate={setRemEndDate_}
                onStartTime={setRemStartTime} onEndTime={setRemEndTime}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">指定成员</label>
                <MemberSelector current={remAssigned} onSet={setRemAssigned} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容 <span className="text-red-500">*</span></label>
                <textarea value={remContent} onChange={e => setRemContent(e.target.value)}
                  placeholder="日程内容…" rows={3} className="input-field resize-none" autoFocus />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button onClick={() => { setShowAddRem(false); resetAddForm() }}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
              <button onClick={saveReminder} disabled={remSaving}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {remSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Reminder Detail / Edit Modal ══════════════════════ */}
      {selectedRem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">
                {detailMode === 'edit' ? '修改日程' : '日程详情'}
              </h3>
              <button onClick={closeDetailRem} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {detailMode === 'view' ? (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {selectedRem.deleted ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg">
                      <span className="text-xs text-red-500 font-semibold">已删除</span>
                      {selectedRem.deleted_by_name && <span className="text-xs text-red-400">· 操作人：{selectedRem.deleted_by_name}</span>}
                    </div>
                  ) : remEndDate(selectedRem) < todayStr ? (
                    <div className="px-3 py-1.5 bg-gray-100 rounded-lg">
                      <span className="text-xs text-gray-500 font-semibold">已过期</span>
                    </div>
                  ) : null}

                  {!selectedRem.deleted && selectedRem.type && selectedRem.type !== 'others' && (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[selectedRem.type] || TYPE_COLORS.others}`}>
                      {TYPE_LABELS[selectedRem.type] || selectedRem.type}
                    </span>
                  )}

                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold
                    ${remPrimaryDate(selectedRem) === todayStr ? 'bg-amber-100 text-amber-700'
                    : remEndDate(selectedRem) < todayStr || selectedRem.deleted ? 'bg-gray-100 text-gray-500'
                    : 'bg-teal-50 text-teal-700'}`}>
                    <span>📅</span><span>{remFullDateLabel(selectedRem, todayStr)}</span>
                  </div>

                  {selectedRem.start_time && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span>🕐</span>
                      <span>{fmtTime(selectedRem.start_time)}{selectedRem.end_time ? ` – ${fmtTime(selectedRem.end_time)}` : ''}</span>
                    </div>
                  )}
                  {selectedRem.assigned_to_name && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span>👤</span><span>{selectedRem.assigned_to_name}</span>
                    </div>
                  )}

                  <p className={`text-sm leading-relaxed whitespace-pre-wrap
                    ${selectedRem.deleted || remEndDate(selectedRem) < todayStr ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {selectedRem.content}
                  </p>
                  {selectedRem.profiles?.name && <p className="text-xs text-gray-400">创建人：{selectedRem.profiles.name}</p>}
                </div>

                <div className="flex gap-2 px-6 py-4 border-t border-gray-200 flex-shrink-0 flex-wrap">
                  <button onClick={closeDetailRem}
                    className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">关闭</button>
                  {!selectedRem.deleted && (
                    <button onClick={() => startEditRem(selectedRem)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">修改</button>
                  )}
                  {!selectedRem.deleted && (
                    <button onClick={() => softDeleteReminder(selectedRem.id)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">删除</button>
                  )}
                  {selectedRem.deleted && (currentUserId === selectedRem.deleted_by || isAdmin) && (
                    <button onClick={() => restoreReminder(selectedRem.id)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">恢复</button>
                  )}
                  {selectedRem.deleted && isAdmin && (
                    <button onClick={() => hardDeleteReminder(selectedRem.id)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors">永久删除</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">类型 <span className="text-red-500">*</span></label>
                    <TypeGrid current={editType} onSet={setEditType} />
                  </div>
                  <DateTimeFields
                    startDate={editStartDate} endDate={editEndDate_}
                    startTime={editStartTime} endTime={editEndTime}
                    onStartDate={setEditStartDate} onEndDate={setEditEndDate_}
                    onStartTime={setEditStartTime} onEndTime={setEditEndTime}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">指定成员</label>
                    <MemberSelector current={editAssigned} onSet={setEditAssigned} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">内容 <span className="text-red-500">*</span></label>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      rows={3} className="input-field resize-none" />
                  </div>
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
                  <button onClick={() => setDetailMode('view')}
                    className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
                  <button onClick={saveEditRem} disabled={editSaving}
                    className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                    {editSaving ? '保存中…' : '保存'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ Personal Daily Stats Modal ════════════════════════ */}
      {showPersonalStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">个人统计</h3>
                <p className="text-xs text-gray-400 mt-0.5">{profile?.name}</p>
              </div>
              <button onClick={() => setShowPersonalStats(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            {/* Mode toggle + date inputs */}
            <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0 space-y-3">
              <div className="flex gap-2">
                {(['single', 'range'] as const).map(m => (
                  <button key={m} onClick={() => { setPersonalMode(m); setPersonalQueried(false) }}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${personalMode === m ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                    {m === 'single' ? '单日' : '区间'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {personalMode === 'single' ? (
                  <input type="date" value={personalDate}
                    onChange={e => { setPersonalDate(e.target.value); setPersonalQueried(false) }}
                    className="input-field w-44" />
                ) : (
                  <>
                    <input type="date" value={personalRangeStart}
                      onChange={e => { setPersonalRangeStart(e.target.value); setPersonalQueried(false) }}
                      className="input-field w-40" />
                    <span className="text-sm text-gray-400">至</span>
                    <input type="date" value={personalRangeEnd} min={personalRangeStart}
                      onChange={e => { setPersonalRangeEnd(e.target.value); setPersonalQueried(false) }}
                      className="input-field w-40" />
                  </>
                )}
                <button onClick={loadPersonalStats} disabled={personalLoading}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg disabled:bg-gray-200 transition-colors">
                  {personalLoading ? '查询中…' : '确认'}
                </button>
                {personalQueried && !personalLoading && (
                  <span className="text-xs text-gray-400">共 {personalRecords.length + personalTimeLogs.length + personalTodos.length} 条</span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <StatsTable loading={personalLoading} queried={personalQueried}
                records={personalRecords} timeLogs={personalTimeLogs} todos={personalTodos} showOperator={false} />
            </div>
          </div>
        </div>
      )}

      {/* ══ Group Daily Stats Modal (admin) ══════════════════ */}
      {showGroupStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">团队统计</h3>
              <button onClick={() => setShowGroupStats(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            {/* Mode toggle + date inputs */}
            <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0 space-y-3">
              <div className="flex gap-2">
                {(['single', 'range'] as const).map(m => (
                  <button key={m} onClick={() => { setGroupMode(m); setGroupQueried(false) }}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${groupMode === m ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                    {m === 'single' ? '单日' : '区间'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {groupMode === 'single' ? (
                  <input type="date" value={groupDate}
                    onChange={e => { setGroupDate(e.target.value); setGroupQueried(false) }}
                    className="input-field w-44" />
                ) : (
                  <>
                    <input type="date" value={groupRangeStart}
                      onChange={e => { setGroupRangeStart(e.target.value); setGroupQueried(false) }}
                      className="input-field w-40" />
                    <span className="text-sm text-gray-400">至</span>
                    <input type="date" value={groupRangeEnd} min={groupRangeStart}
                      onChange={e => { setGroupRangeEnd(e.target.value); setGroupQueried(false) }}
                      className="input-field w-40" />
                  </>
                )}
                <button onClick={loadGroupStats} disabled={groupLoading}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg disabled:bg-gray-200 transition-colors">
                  {groupLoading ? '查询中…' : '确认'}
                </button>
                {groupQueried && !groupLoading && (
                  <span className="text-xs text-gray-400">共 {groupRecords.length + groupTimeLogs.length + groupTodos.length} 条</span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <StatsTable loading={groupLoading} queried={groupQueried}
                records={groupRecords} timeLogs={groupTimeLogs} todos={groupTodos} showOperator={true} groupByProject={true} />
            </div>
          </div>
        </div>
      )}

      {/* ══ Calendar Show All Modal ═══════════════════════════ */}
      {showCalendarAll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">全部待处理日程 ({upcoming.length})</h3>
              <button onClick={() => setShowCalendarAll(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">暂无待处理日程</p>
              ) : (
                upcoming.map((r, i) => {
                  const isToday = remPrimaryDate(r) === todayStr
                  return (
                    <button key={r.id} onClick={() => { setShowCalendarAll(false); openDetailRem(r) }}
                      className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border transition-all cursor-pointer
                        ${isToday
                          ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
                          : `${ROW_BG[i % 2]} border-gray-200 hover:border-teal-300 hover:bg-teal-50/40`}`}>
                      <span className={`text-xs font-bold mt-0.5 flex-shrink-0 min-w-9
                        ${isToday ? 'text-amber-600' : 'text-teal-600'}`}>
                        {remDateLabel(r)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className={`text-sm leading-snug line-clamp-2 block
                          ${isToday ? 'text-amber-800 font-medium' : 'text-gray-800'}`}>
                          {r.content}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {r.type && r.type !== 'others' && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[r.type] || TYPE_COLORS.others}`}>
                              {TYPE_LABELS[r.type] || r.type}
                            </span>
                          )}
                          {r.assigned_to_name && (
                            <span className="text-[10px] text-indigo-500 font-medium">@{r.assigned_to_name}</span>
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
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
