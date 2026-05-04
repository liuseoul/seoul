'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'
import ProjectDetailPanel from './ProjectDetailPanel'
import TodoPanel from './TodoPanel'

const STATUS_LABELS: Record<string, string> = {
  all:       '全部',
  active:    '进行中',
  delayed:   '已取消',
  completed: '已完成',
  cancelled: '未签约',
}

const STATUS_ORDER = ['all', 'active', 'delayed', 'completed', 'cancelled']

const ROW_COLORS = ['bg-white', 'bg-teal-50']

function calcHours(logs: Array<{ started_at: string; finished_at: string | null; deleted?: boolean }>) {
  return logs
    .reduce((sum, log) => {
      if (!log.finished_at || log.deleted) return sum
      return sum + (new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 3600000
    }, 0)
    .toFixed(1)
}

function formatShortDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function getLatestActivity(project: any): { label: string; operator: string } | null {
  const activities: { ts: number; label: string; operator: string }[] = []
  for (const r of project.work_records || []) {
    if (r.deleted) continue
    activities.push({ ts: new Date(r.created_at).getTime(), label: formatShortDate(r.created_at), operator: r.profiles?.name || '' })
  }
  for (const l of project.time_logs || []) {
    if (l.deleted) continue
    activities.push({ ts: new Date(l.started_at).getTime(), label: formatShortDate(l.started_at), operator: l.profiles?.name || '' })
  }
  if (activities.length === 0) return null
  activities.sort((a, b) => b.ts - a.ts)
  return { label: activities[0].label, operator: activities[0].operator }
}

// ── Edit-form field type ──────────────────────────────────────
type EditForm = {
  name: string
  client: string
  description: string
  agreement_party: string
  service_fee_currency: string
  service_fee_amount: string
  collaboration_parties: string   // comma-separated
  status: string
}

const EMPTY_FORM: EditForm = {
  name: '', client: '', description: '', agreement_party: '',
  service_fee_currency: '', service_fee_amount: '', collaboration_parties: '', status: 'active',
}

export default function ProjectList({ projects, profile }: { projects: any[]; profile: any }) {
  const supabase   = createClient()
  const router     = useRouter()
  const isAdmin    = profile?.role === 'admin'
  const todayStr   = new Date().toISOString().split('T')[0]

  const [filter,     setFilter]     = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ── Revise modal ───────────────────────────────────────────
  const [editProject, setEditProject] = useState<any | null>(null)
  const [form,        setForm]        = useState<EditForm>(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)

  // ── Project statistics ─────────────────────────────────────
  const [showStats,      setShowStats]      = useState(false)
  const [statsStartDate, setStatsStartDate] = useState(todayStr.slice(0, 7) + '-01')  // first of current month
  const [statsEndDate,   setStatsEndDate]   = useState(todayStr)
  const [statsResult,    setStatsResult]    = useState<{ total: number; assigned: number; finished: number } | null>(null)

  // ── Project sort ───────────────────────────────────────────
  const [showSortPicker, setShowSortPicker] = useState(false)
  const [sortMode,       setSortMode]       = useState<'activity' | 'created'>('activity')
  const [pendingSort,    setPendingSort]    = useState<'activity' | 'created'>('activity')

  function openEdit(e: React.MouseEvent, project: any) {
    e.stopPropagation()   // don't select the row
    setEditProject(project)
    setForm({
      name:                  project.name || '',
      client:                project.client || '',
      description:           project.description || '',
      agreement_party:       project.agreement_party || '',
      service_fee_currency:  project.service_fee_currency || '',
      service_fee_amount:    project.service_fee_amount != null ? String(project.service_fee_amount) : '',
      collaboration_parties: (project.collaboration_parties as string[] | null)?.join('，') || '',
      status:                project.status || 'active',
    })
  }

  function closeEdit() { setEditProject(null); setForm(EMPTY_FORM) }

  function computeStats() {
    if (statsEndDate < statsStartDate) { alert('结束日期不能早于开始日期'); return }
    const range = projects.filter(p => {
      const ca = (p.created_at as string).split('T')[0]
      return ca >= statsStartDate && ca <= statsEndDate
    })
    const total      = range.length
    const unstarted  = range.filter(p => p.status === 'cancelled').length  // 未签约
    const cancelled  = range.filter(p => p.status === 'delayed').length    // 已取消
    const assigned   = total - unstarted - cancelled
    const finished   = range.filter(p => p.status === 'completed').length
    setStatsResult({ total, assigned, finished })
  }

  function setField(key: keyof EditForm, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function saveEdit() {
    if (!form.name.trim()) { alert('项目名称不能为空'); return }
    setSaving(true)
    const { error } = await supabase.from('projects').update({
      name:                  form.name.trim(),
      client:                form.client.trim() || null,
      description:           form.description.trim() || null,
      agreement_party:       form.agreement_party.trim() || null,
      service_fee_currency:  form.service_fee_currency.trim() || null,
      service_fee_amount:    form.service_fee_amount ? parseFloat(form.service_fee_amount) : null,
      collaboration_parties: form.collaboration_parties
        ? form.collaboration_parties.split(/[,，]/).map(s => s.trim()).filter(Boolean)
        : [],
      status:                form.status,
    }).eq('id', editProject.id)
    setSaving(false)
    if (error) { alert('保存失败：' + error.message); return }
    closeEdit()
    router.refresh()
  }

  // ── Layout helpers ─────────────────────────────────────────
  // Sort: 1st by most-recent non-deleted activity DESC, 2nd by created_at DESC
  // 已取消 (delayed) always sink to bottom
  function getMaxActivityTs(p: any): number {
    let maxTs = 0
    for (const r of p.work_records || []) {
      if (r.deleted) continue
      const ts = new Date(r.created_at).getTime()
      if (ts > maxTs) maxTs = ts
    }
    for (const l of p.time_logs || []) {
      if (l.deleted) continue
      const ts = new Date(l.started_at).getTime()
      if (ts > maxTs) maxTs = ts
    }
    return maxTs
  }

  const sorted = (list: any[]) => {
    const active  = list.filter((p: any) => p.status !== 'delayed')
    const delayed = list.filter((p: any) => p.status === 'delayed')
    if (sortMode === 'activity') {
      active.sort((a: any, b: any) => {
        const ta = getMaxActivityTs(a), tb = getMaxActivityTs(b)
        if (ta !== tb) return tb - ta
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    } else {
      // sort by created_at DESC
      active.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }
    return [...active, ...delayed]
  }

  const filtered    = sorted(filter === 'all' ? projects : projects.filter((p: any) => p.status === filter))
  const selectedProject = projects.find((p: any) => p.id === selectedId) || null

  // Label map for the form status select
  const STATUS_EDIT = [
    { value: 'active',    label: '进行中' },
    { value: 'completed', label: '已完成' },
    { value: 'cancelled', label: '未签约' },
    { value: 'delayed',   label: '已取消' },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header + filter bar — single unified row */}
        <div className="flex items-center gap-1.5 px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          {/* Title */}
          <h1 className="text-base font-semibold text-gray-900 mr-2 flex-shrink-0">项目概览</h1>
          <span className="w-px h-5 bg-gray-200 flex-shrink-0 mx-1" />

          {/* Status filter buttons with dividers */}
          {STATUS_ORDER.map((key, i) => (
            <div key={key} className="flex items-center gap-1.5">
              {i > 0 && <span className="w-px h-4 bg-gray-200 flex-shrink-0" />}
              <button onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 whitespace-nowrap
                  ${filter === key ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                {STATUS_LABELS[key]}
                <span className="ml-1 text-xs opacity-70">
                  {key === 'all'
                    ? projects.length
                    : projects.filter((p: any) => p.status === key).length}
                </span>
              </button>
            </div>
          ))}

          {/* Divider before utility buttons */}
          <span className="w-px h-5 bg-gray-200 flex-shrink-0 mx-1" />

          {/* Utility buttons */}
          <button onClick={() => { setShowStats(true); setStatsResult(null) }}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 whitespace-nowrap
                       bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex-shrink-0">
            项目统计
          </button>
          <button onClick={() => { setPendingSort(sortMode); setShowSortPicker(true) }}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 whitespace-nowrap
                       bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm flex-shrink-0">
            项目排序
          </button>

          {/* Right: new project */}
          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            {isAdmin && (
              <button onClick={() => router.push('/admin')}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white
                           text-sm font-medium px-3 py-1.5 rounded-lg transition-colors duration-150">
                <span className="text-base leading-none">+</span>
                <span>新建项目</span>
              </button>
            )}
          </div>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📂</div>
              <div className="text-sm">暂无项目</div>
            </div>
          )}

          {filtered.map((project: any, index: number) => {
            const isCancelled = project.status === 'delayed'
            const recordCount = (project.work_records || []).filter((r: any) => !r.deleted).length
            const hours       = calcHours(project.time_logs || [])
            const isSelected  = selectedId === project.id
            const rowBg       = ROW_COLORS[index % 2]
            const latestAct   = getLatestActivity(project)

            return (
              <div
                key={project.id}
                className={`project-row ${isSelected ? 'selected' : rowBg} ${isCancelled ? 'opacity-50' : ''}`}
                onClick={() => setSelectedId(isSelected ? null : project.id)}
              >
                {/* Left: name + revise button + client */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-gray-900 truncate ${isCancelled ? 'line-through' : ''}`}>
                      {project.name}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={e => openEdit(e, project)}
                        className="flex-shrink-0 text-[11px] text-gray-400 hover:text-teal-600
                                   border border-gray-200 hover:border-teal-400 rounded px-1.5 py-0.5
                                   transition-colors leading-none"
                      >
                        修改
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3 truncate">
                    <span className={isCancelled ? 'line-through' : ''}>
                      委托方：{project.client || '—'}
                    </span>
                    {project.agreement_party && (
                      <span className="text-xs text-indigo-500 font-medium">{project.agreement_party}</span>
                    )}
                  </div>
                </div>

                {/* Middle: stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500 flex-shrink-0">
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">📝</span>
                    {recordCount} 条记录
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">⏱</span>
                    {hours} 小时
                  </span>
                </div>

                {/* Right: status + latest activity */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`status-tag st-${project.status}`}>
                    {STATUS_LABELS[project.status] || project.status}
                  </span>
                  {latestAct ? (
                    <div className="text-right w-28">
                      <div className="text-xs text-gray-500">{latestAct.label}</div>
                      <div className="text-[10px] text-gray-400">{latestAct.operator}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 w-28 text-right">暂无记录</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedProject && (
        <ProjectDetailPanel project={selectedProject} profile={profile} onClose={() => setSelectedId(null)} />
      )}

      <TodoPanel profile={profile} />

      {/* ══ Revise Project Modal ════════════════════════════════ */}
      {editProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">修改项目信息</h3>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  项目名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  className="input-field"
                  autoFocus
                />
              </div>

              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">委托方</label>
                <input
                  type="text"
                  value={form.client}
                  onChange={e => setField('client', e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Agreement party */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">协议方</label>
                <input
                  type="text"
                  value={form.agreement_party}
                  onChange={e => setField('agreement_party', e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Service fee */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务费币种</label>
                  <input
                    type="text"
                    value={form.service_fee_currency}
                    onChange={e => setField('service_fee_currency', e.target.value)}
                    placeholder="CNY / USD / KRW…"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务费金额</label>
                  <input
                    type="number"
                    value={form.service_fee_amount}
                    onChange={e => setField('service_fee_amount', e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Collaboration parties */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">协作方</label>
                <input
                  type="text"
                  value={form.collaboration_parties}
                  onChange={e => setField('collaboration_parties', e.target.value)}
                  placeholder="多个协作方用逗号分隔"
                  className="input-field"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_EDIT.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setField('status', s.value)}
                      className={`py-1.5 px-3 text-sm rounded-lg border transition-colors text-left
                        ${form.status === s.value
                          ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={closeEdit}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Project Sort Picker Modal ═══════════════════════════ */}
      {showSortPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">项目排序</h3>
              <button onClick={() => setShowSortPicker(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-2 mb-6">
              {([
                { value: 'activity', label: '按最近操作时间', desc: '有工作/工时记录的项目优先' },
                { value: 'created',  label: '按项目建立日期', desc: '最新创建的项目排在前面' },
              ] as const).map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setPendingSort(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors
                    ${pendingSort === opt.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                  <div className={`text-sm font-medium ${pendingSort === opt.value ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => { setSortMode(pendingSort); setShowSortPicker(false) }}
              className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
              确认
            </button>
          </div>
        </div>
      )}

      {/* ══ Project Statistics Modal ════════════════════════════ */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">项目统计</h3>
              <button onClick={() => setShowStats(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                  <input type="date" value={statsStartDate}
                    onChange={e => { setStatsStartDate(e.target.value); setStatsResult(null) }}
                    className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                  <input type="date" value={statsEndDate} min={statsStartDate}
                    onChange={e => { setStatsEndDate(e.target.value); setStatsResult(null) }}
                    className="input-field" />
                </div>
              </div>
              <button onClick={computeStats}
                className="w-full py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                统计
              </button>
              {statsResult && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="text-sm text-gray-600">新增项目数</span>
                    <span className="text-2xl font-bold text-gray-900">{statsResult.total}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-teal-50">
                    <div>
                      <span className="text-sm text-gray-700">已签协议项目数</span>
                      <p className="text-[10px] text-gray-400 mt-0.5">新增 − 未签约 − 已取消</p>
                    </div>
                    <span className="text-2xl font-bold text-teal-600">{statsResult.assigned}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-gray-600">已完成项目数</span>
                    <span className="text-2xl font-bold text-indigo-600">{statsResult.finished}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
