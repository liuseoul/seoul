'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  delayed: '已取消',
  completed: '已完成',
  cancelled: '未签约',
}

type EditForm = {
  name: string; client: string; description: string
  agreement_party: string; service_fee_currency: string
  service_fee_amount: string; collaboration_parties: string; status: string
}

const EMPTY_FORM: EditForm = {
  name: '', client: '', description: '', agreement_party: '',
  service_fee_currency: '', service_fee_amount: '', collaboration_parties: '', status: 'active',
}

const STATUS_EDIT = [
  { value: 'active',    label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '未签约' },
  { value: 'delayed',   label: '已取消' },
]

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
  return `${totalMin} 分钟`
}

function durMinutes(started: string, finished: string | null): string {
  if (!finished) return '—'
  const mins = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 60000)
  if (mins <= 0) return '—'
  return `${mins} 分钟`
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
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
  const [showTimeStats,  setShowTimeStats]  = useState(false)
  const [showExport,     setShowExport]     = useState(false)
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set())

  // ── Edit project modal ────────────────────────────────────
  const [showEdit,   setShowEdit]   = useState(false)
  const [editForm,   setEditForm]   = useState<EditForm>(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)

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
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', user!.id).single()
    const { error } = await supabase.from('work_records').update({
      deleted: true, deleted_by: user!.id,
      deleted_by_name: prof?.name || '未知',
      deleted_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
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
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', user!.id).single()
    const { error } = await supabase.from('time_logs').update({
      deleted: true, deleted_by: user!.id,
      deleted_by_name: prof?.name || '未知',
      deleted_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    loadTimeLogs()
  }

  async function hardDeleteTimeLog(id: string) {
    if (!confirm('确认永久删除该工时记录？此操作不可恢复。')) return
    const { error } = await supabase.from('time_logs').delete().eq('id', id)
    if (error) alert('删除失败：' + error.message)
    else loadTimeLogs()
  }

  function openProjectEdit() {
    setEditForm({
      name:                  project.name || '',
      client:                project.client || '',
      description:           project.description || '',
      agreement_party:       project.agreement_party || '',
      service_fee_currency:  project.service_fee_currency || '',
      service_fee_amount:    project.service_fee_amount != null ? String(project.service_fee_amount) : '',
      collaboration_parties: (project.collaboration_parties as string[] | null)?.join('，') || '',
      status:                project.status || 'active',
    })
    setShowEdit(true)
  }

  function setEditField(key: keyof EditForm, val: string) {
    setEditForm(prev => ({ ...prev, [key]: val }))
  }

  async function saveProjectEdit() {
    if (!editForm.name.trim()) { alert('项目名称不能为空'); return }
    setEditSaving(true)
    const { error } = await supabase.from('projects').update({
      name:                  editForm.name.trim(),
      client:                editForm.client.trim() || null,
      description:           editForm.description.trim() || null,
      agreement_party:       editForm.agreement_party.trim() || null,
      service_fee_currency:  editForm.service_fee_currency.trim() || null,
      service_fee_amount:    editForm.service_fee_amount ? parseFloat(editForm.service_fee_amount) : null,
      collaboration_parties: editForm.collaboration_parties
        ? editForm.collaboration_parties.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
        : [],
      status:                editForm.status,
    }).eq('id', project.id)
    setEditSaving(false)
    if (error) { alert('保存失败：' + error.message); return }
    setShowEdit(false)
    window.location.reload()
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
            <option value="cancelled">未签约</option>
          </select>
        )}
        {isAdmin && (
          <button onClick={openProjectEdit}
            className="text-xs text-teal-600 hover:text-teal-800 border border-teal-400 hover:border-teal-600
                       rounded px-2 py-1 transition-colors font-medium ml-auto">
            修改
          </button>
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
              const canSoftDelete = !r.deleted
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
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                          已删除{r.deleted_by_name ? ` · ${r.deleted_by_name}` : ''}
                        </span>
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
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setShowAddTime(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
                           border border-teal-300 text-teal-600 text-sm font-medium
                           hover:bg-teal-50 transition-colors"
              >
                + 添加
              </button>
              <button
                onClick={() => setShowTimeStats(true)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium
                           hover:bg-gray-50 transition-colors"
              >
                统计
              </button>
              <button
                onClick={() => {
                  setExportSelected(new Set(timeLogs.filter((l: any) => !l.deleted).map((l: any) => l.id)))
                  setShowExport(true)
                }}
                className="px-4 py-2 rounded-lg border border-teal-300 text-teal-600 text-sm font-medium
                           hover:bg-teal-50 transition-colors"
              >
                导出
              </button>
            </div>

            {timeLogs.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">暂无工时记录</p>
            )}

            {timeLogs.map((l: any) => {
              const canSoftDelete = !l.deleted
              const canHardDelete = l.deleted && isAdmin
              const dur = durMinutes(l.started_at, l.finished_at)

              return (
                <div key={l.id} className={`time-entry ${l.deleted ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-700">{l.profiles?.name || '未知'}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-teal-600">{dur}</span>
                      {l.deleted && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                          已删除{l.deleted_by_name ? ` · ${l.deleted_by_name}` : ''}
                        </span>
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

      {/* ── Time Log Statistics Modal ── */}
      {showTimeStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">工时统计</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{project.name}</p>
              </div>
              <button onClick={() => setShowTimeStats(false)}
                className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* Summary bar */}
            {(() => {
              const nonDeleted = timeLogs.filter((l: any) => !l.deleted)
              const totalMins = nonDeleted.reduce((sum: number, l: any) => {
                if (!l.finished_at) return sum
                return sum + Math.round((new Date(l.finished_at).getTime() - new Date(l.started_at).getTime()) / 60000)
              }, 0)
              return (
                <div className="px-6 py-2.5 bg-teal-50 border-b border-teal-100 flex-shrink-0 flex items-center gap-4 text-sm">
                  <span className="text-teal-700">共 <strong>{nonDeleted.length}</strong> 条有效记录</span>
                  <span className="text-teal-700">合计 <strong>{totalMins}</strong> 分钟</span>
                </div>
              )
            })()}

            <div className="flex-1 overflow-y-auto">
              {timeLogs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">暂无工时记录</p>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-gray-500">
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium w-20">日期</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium w-16">开始</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium w-16">结束</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium w-16">时长</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium">内容</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium w-14">操作人</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...timeLogs]
                      .sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                      .map((l: any) => {
                        const dur = durMinutes(l.started_at, l.finished_at)
                        const dateStr = new Date(l.started_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                        const startStr = new Date(l.started_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                        const endStr = l.finished_at
                          ? new Date(l.finished_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                          : '—'
                        return (
                          <tr key={l.id} className={`hover:bg-gray-50 ${l.deleted ? 'opacity-40' : ''}`}>
                            <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{dateStr}</td>
                            <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{startStr}</td>
                            <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{endStr}</td>
                            <td className="px-3 py-2 border-b border-gray-100 text-teal-600 font-semibold">{dur}</td>
                            <td className="px-3 py-2 border-b border-gray-100 text-gray-800 whitespace-pre-wrap">
                              {l.description || '—'}
                              {l.deleted && <span className="ml-1 text-red-400">[已删除]</span>}
                            </td>
                            <td className="px-3 py-2 border-b border-gray-100 text-gray-500">
                              {l.profiles?.name || '—'}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Project Modal ── */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">修改项目信息</h3>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">项目名称 <span className="text-red-500">*</span></label>
                <input type="text" value={editForm.name} onChange={e => setEditField('name', e.target.value)}
                  className="input-field" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">委托方</label>
                <input type="text" value={editForm.client} onChange={e => setEditField('client', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">协议方</label>
                <input type="text" value={editForm.agreement_party} onChange={e => setEditField('agreement_party', e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务费币种</label>
                  <input type="text" value={editForm.service_fee_currency}
                    onChange={e => setEditField('service_fee_currency', e.target.value)}
                    placeholder="CNY / USD / KRW…" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务费金额</label>
                  <input type="number" value={editForm.service_fee_amount}
                    onChange={e => setEditField('service_fee_amount', e.target.value)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">协作方</label>
                <input type="text" value={editForm.collaboration_parties}
                  onChange={e => setEditField('collaboration_parties', e.target.value)}
                  placeholder="多个协作方用逗号分隔" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_EDIT.map(s => (
                    <button key={s.value} type="button" onClick={() => setEditField('status', s.value)}
                      className={`py-1.5 px-3 text-sm rounded-lg border transition-colors text-left
                        ${editForm.status === s.value
                          ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea value={editForm.description} onChange={e => setEditField('description', e.target.value)}
                  rows={3} className="input-field resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button onClick={() => setShowEdit(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={saveProjectEdit} disabled={editSaving}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {editSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export Time Logs Modal ── */}
      {showExport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">导出工时记录 — {project.name}</h3>
              <button onClick={() => setShowExport(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* Select all / deselect all */}
            <div className="px-6 py-2 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
              <button onClick={() => setExportSelected(new Set(timeLogs.filter((l: any) => !l.deleted).map((l: any) => l.id)))}
                className="text-xs text-teal-600 hover:text-teal-800 transition-colors">全选</button>
              <button onClick={() => setExportSelected(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">取消全选</button>
              <span className="ml-auto text-xs text-gray-400">已选 {exportSelected.size} 条</span>
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
              {timeLogs.filter((l: any) => !l.deleted).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">暂无工时记录</p>
              ) : (
                timeLogs.filter((l: any) => !l.deleted).map((l: any) => {
                  const checked = exportSelected.has(l.id)
                  const dur = durMinutes(l.started_at, l.finished_at)
                  return (
                    <label key={l.id}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors
                        ${checked ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={checked} onChange={e => {
                        const next = new Set(exportSelected)
                        e.target.checked ? next.add(l.id) : next.delete(l.id)
                        setExportSelected(next)
                      }} className="mt-0.5 accent-teal-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{l.profiles?.name || '未知'}</span>
                          <span className="text-xs text-teal-600 font-semibold">{dur}</span>
                          <span className="text-xs text-gray-400">{formatDateTime(l.started_at)}
                            {l.finished_at && ` — ${new Date(l.finished_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                          </span>
                        </div>
                        {l.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{l.description}</p>
                        )}
                      </div>
                    </label>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button onClick={() => setShowExport(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button
                disabled={exportSelected.size === 0}
                onClick={() => {
                  const rows: string[][] = [['成员', '开始时间', '结束时间', '时长(分钟)', '说明']]
                  timeLogs
                    .filter((l: any) => !l.deleted && exportSelected.has(l.id))
                    .forEach((l: any) => {
                      const mins = l.finished_at
                        ? String(Math.round((new Date(l.finished_at).getTime() - new Date(l.started_at).getTime()) / 60000))
                        : ''
                      rows.push([
                        l.profiles?.name || '',
                        formatDateTime(l.started_at),
                        l.finished_at ? formatDateTime(l.finished_at) : '',
                        mins,
                        l.description || '',
                      ])
                    })
                  downloadCSV(`${project.name}_工时记录.csv`, rows)
                }}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                导出 CSV ({exportSelected.size} 条)
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
