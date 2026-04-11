'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  delayed: '已取消',
  completed: '已完成',
  cancelled: '未启动',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

function calcTotal(start: string, end: string): string {
  if (!start || !end) return '—'
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const totalMin = (eh * 60 + em) - (sh * 60 + sm)
  if (totalMin <= 0) return '—'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0 && m > 0) return `${h} 小时 ${m} 分钟`
  if (h > 0) return `${h} 小时`
  return `${m} 分钟`
}

function localDatetime(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi]    = timeStr.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi, 0).toISOString()
}

export default function ProjectDetailPanel({
  project, profile, onClose,
}: {
  project: any
  profile: any
  onClose: () => void
}) {
  const supabase = createClient()
  const [tab, setTab] = useState<'records' | 'time'>('records')
  const [records, setRecords]         = useState<any[]>([])
  const [timeLogs, setTimeLogs]       = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  // ── Add Work Record modal ──────────────────────────────────
  const [showAddRecord,  setShowAddRecord]  = useState(false)
  const [recordDate,     setRecordDate]     = useState(today)
  const [recordContent,  setRecordContent]  = useState('')
  const [savingRecord,   setSavingRecord]   = useState(false)

  // ── Add Time Log modal ────────────────────────────────────
  const [showAddTime,  setShowAddTime]  = useState(false)
  const [timeDate,     setTimeDate]     = useState(today)
  const [timeStart,    setTimeStart]    = useState('09:00')
  const [timeEnd,      setTimeEnd]      = useState('10:00')
  const [timeContent,  setTimeContent]  = useState('')
  const [savingTime,   setSavingTime]   = useState(false)

  async function loadRecords() {
    const { data, error } = await supabase
      .from('work_records')
      .select('*, profiles!work_records_author_id_fkey(name)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    if (error) console.error('loadRecords error:', error.message)
    setRecords(data || [])
  }

  async function loadTimeLogs() {
    const { data, error } = await supabase
      .from('time_logs')
      .select('*, profiles!time_logs_member_id_fkey(name)')
      .eq('project_id', project.id)
      .order('started_at', { ascending: false })
    if (error) console.error('loadTimeLogs error:', error.message)
    setTimeLogs(data || [])
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null))
    loadRecords()
    loadTimeLogs()

    const channel = supabase
      .channel(`project-${project.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'work_records',
        filter: `project_id=eq.${project.id}`,
      }, () => loadRecords())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [project.id])

  // ── Work records ──────────────────────────────────────────
  async function saveRecord() {
    if (!recordContent.trim()) return
    setSavingRecord(true)
    const { data: { user } } = await supabase.auth.getUser()
    // Use noon on the chosen date so ordering by created_at reflects user's date
    const [y, mo, d] = recordDate.split('-').map(Number)
    const createdAt = new Date(y, mo - 1, d, 12, 0, 0).toISOString()
    const { error } = await supabase.from('work_records').insert({
      project_id: project.id,
      content:    recordContent.trim(),
      author_id:  user!.id,
      created_at: createdAt,
    })
    if (error) {
      alert('保存失败：' + error.message)
      setSavingRecord(false)
      return
    }
    await loadRecords()
    setRecordContent('')
    setRecordDate(today)
    setSavingRecord(false)
    setShowAddRecord(false)
  }

  async function softDeleteRecord(id: string) {
    if (!confirm('确认标记该记录为已删除？')) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('work_records').update({
      deleted: true, deleted_by: user!.id, deleted_at: new Date().toISOString(),
    }).eq('id', id)
    loadRecords()
  }

  async function hardDeleteRecord(id: string) {
    if (!confirm('确认永久删除该记录？此操作不可恢复。')) return
    const { error } = await supabase.from('work_records').delete().eq('id', id)
    if (error) alert('删除失败：' + error.message)
    else loadRecords()
  }

  // ── Time logs ─────────────────────────────────────────────
  async function addTimeLog() {
    if (!timeDate || !timeStart || !timeEnd) { alert('请填写日期和时间'); return }
    if (timeEnd <= timeStart) { alert('结束时间必须晚于开始时间'); return }
    setSavingTime(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('time_logs').insert({
      project_id:  project.id,
      member_id:   user!.id,
      started_at:  localDatetime(timeDate, timeStart),
      finished_at: localDatetime(timeDate, timeEnd),
      description: timeContent.trim(),
    })
    if (error) {
      alert('保存失败：' + error.message)
      setSavingTime(false)
      return
    }
    await loadTimeLogs()
    setTimeContent('')
    setTimeDate(today)
    setTimeStart('09:00')
    setTimeEnd('10:00')
    setSavingTime(false)
    setShowAddTime(false)
  }

  async function softDeleteTimeLog(id: string) {
    if (!confirm('确认标记该工时记录为已删除？')) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('time_logs').update({
      deleted: true, deleted_by: user!.id, deleted_at: new Date().toISOString(),
    }).eq('id', id)
    loadTimeLogs()
  }

  async function hardDeleteTimeLog(id: string) {
    if (!confirm('确认永久删除该工时记录？此操作不可恢复。')) return
    const { error } = await supabase.from('time_logs').delete().eq('id', id)
    if (error) alert('删除失败：' + error.message)
    else loadTimeLogs()
  }

  async function changeStatus(newStatus: string) {
    setStatusChanging(true)
    await supabase.from('projects').update({ status: newStatus }).eq('id', project.id)
    setStatusChanging(false)
    window.location.reload()
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="detail-panel">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900 text-sm truncate">{project.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate">委托方：{project.client || '—'}</p>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {project.agreement_party && (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                {project.agreement_party}
              </span>
            )}
            {project.service_fee_currency && (
              <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                {project.service_fee_currency}
                {project.service_fee_amount != null && (
                  <> {Number(project.service_fee_amount).toLocaleString()}</>
                )}
              </span>
            )}
          </div>
          {project.collaboration_parties?.length > 0 && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              协作：{(project.collaboration_parties as string[]).join(' · ')}
            </p>
          )}
        </div>
        <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0 p-1">✕</button>
      </div>

      {/* Status + admin controls */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <span className={`status-tag st-${project.status}`}>
          {STATUS_LABELS[project.status] || project.status}
        </span>
        {isAdmin && (
          <select
            defaultValue={project.status}
            disabled={statusChanging}
            onChange={e => changeStatus(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white
                       focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="active">进行中</option>
            <option value="delayed">已取消</option>
            <option value="completed">已完成</option>
            <option value="cancelled">未启动</option>
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        {(['records', 'time'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${tab === t ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'records' ? '工作记录' : '工时记录'}
          </button>
        ))}
      </div>

      {/* Content — fills remaining height */}
      <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* ── Work Records Tab ── */}
        {tab === 'records' && (
          <>
            {/* Add button */}
            <div className="mb-3">
              <button
                onClick={() => setShowAddRecord(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                           border border-teal-300 text-teal-600 text-sm font-medium
                           hover:bg-teal-50 transition-colors"
              >
                + 添加
              </button>
            </div>

            {records.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">暂无工作记录</p>
            )}
            {records.map((r: any) => {
              const isOwner       = r.author_id === currentUserId
              const canSoftDelete = !r.deleted && (isOwner || isAdmin)
              const canHardDelete = r.deleted && isAdmin

              return (
                <div key={r.id} className={`record-entry ${r.deleted ? 'deleted' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      {r.profiles?.name || '未知'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{formatDateOnly(r.created_at)}</span>
                      {r.deleted && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">已删除</span>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm text-gray-800 leading-relaxed ${r.deleted ? 'line-through text-gray-400' : ''}`}>
                    {r.content}
                  </p>
                  <div className="flex gap-2 mt-1.5">
                    {canSoftDelete && (
                      <button onClick={() => softDeleteRecord(r.id)} className="text-xs text-amber-500 hover:text-amber-700">
                        标记删除
                      </button>
                    )}
                    {canHardDelete && (
                      <button onClick={() => hardDeleteRecord(r.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                        永久删除
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── Time Logs Tab ── */}
        {tab === 'time' && (
          <>
            <div className="mb-3">
              <button
                onClick={() => setShowAddTime(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                           border border-teal-300 text-teal-600 text-sm font-medium
                           hover:bg-teal-50 transition-colors"
              >
                + 添加
              </button>
            </div>

            {timeLogs.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">暂无工时记录</p>
            )}

            {timeLogs.map((l: any) => {
              const isOwner       = l.member_id === currentUserId
              const canSoftDelete = !l.deleted && (isOwner || isAdmin)
              const canHardDelete = l.deleted && isAdmin
              const dur = l.finished_at
                ? ((new Date(l.finished_at).getTime() - new Date(l.started_at).getTime()) / 3600000).toFixed(1) + ' 小时'
                : '—'

              return (
                <div key={l.id} className={`time-entry ${l.deleted ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-700">{l.profiles?.name || '未知'}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-teal-600">{dur}</span>
                      {l.deleted && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">已删除</span>
                      )}
                    </div>
                  </div>
                  <div className={`text-xs text-gray-400 ${l.deleted ? 'line-through' : ''}`}>
                    {formatDateTime(l.started_at)}
                    {l.finished_at && ` — ${new Date(l.finished_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                  {l.description && (
                    <p className={`text-sm text-gray-600 mt-1 ${l.deleted ? 'line-through' : ''}`}>{l.description}</p>
                  )}
                  <div className="flex gap-2 mt-1.5">
                    {canSoftDelete && (
                      <button onClick={() => softDeleteTimeLog(l.id)} className="text-xs text-amber-500 hover:text-amber-700">
                        删除
                      </button>
                    )}
                    {canHardDelete && (
                      <button onClick={() => hardDeleteTimeLog(l.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                        永久删除
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* ── Add Work Record Modal ── */}
      {showAddRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">添加工作记录</h3>
              <button
                onClick={() => setShowAddRecord(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                <input
                  type="date"
                  value={recordDate}
                  onChange={e => setRecordDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <textarea
                  value={recordContent}
                  onChange={e => setRecordContent(e.target.value)}
                  placeholder="工作内容…"
                  rows={4}
                  className="input-field resize-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddRecord(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveRecord}
                disabled={savingRecord || !recordContent.trim()}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {savingRecord ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Time Log Modal ── */}
      {showAddTime && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">添加工时记录</h3>
              <button
                onClick={() => setShowAddTime(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                <input
                  type="date"
                  value={timeDate}
                  onChange={e => setTimeDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                  <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                  <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="bg-teal-50 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-sm text-gray-600">合计时长</span>
                <span className="text-sm font-semibold text-teal-700">{calcTotal(timeStart, timeEnd)}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">工作内容</label>
                <textarea
                  value={timeContent}
                  onChange={e => setTimeContent(e.target.value)}
                  placeholder="本次工作内容（可留空）…"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddTime(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={addTimeLog}
                disabled={savingTime}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {savingTime ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
