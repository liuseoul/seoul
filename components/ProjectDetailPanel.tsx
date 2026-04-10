'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  delayed: '已延期',
  completed: '已完成',
  cancelled: '未启动',
}

function formatElapsed(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}时 ${m}分 ${sec}秒`
  if (m > 0) return `${m}分 ${sec}秒`
  return `${sec} 秒`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
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
  const [records, setRecords] = useState<any[]>([])
  const [timeLogs, setTimeLogs] = useState<any[]>([])
  const [newRecord, setNewRecord] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTimer, setActiveTimer] = useState<any>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)

  async function loadRecords() {
    const { data } = await supabase
      .from('work_records')
      .select('*, profiles(name)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    setRecords(data || [])
  }

  async function loadTimeLogs() {
    const { data } = await supabase
      .from('time_logs')
      .select('*, profiles(name)')
      .eq('project_id', project.id)
      .order('started_at', { ascending: false })
    setTimeLogs(data || [])

    // 检查当前用户是否有未结束的计时
    const { data: { user } } = await supabase.auth.getUser()
    const running = data?.find((l: any) => !l.finished_at && l.member_id === user?.id)
    if (running) {
      setActiveTimer(running)
      setElapsed(Math.floor((Date.now() - new Date(running.started_at).getTime()) / 1000))
    } else {
      setActiveTimer(null)
      setElapsed(0)
    }
  }

  useEffect(() => {
    loadRecords()
    loadTimeLogs()

    // Realtime 订阅工作记录变更
    const channel = supabase
      .channel(`project-${project.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'work_records',
        filter: `project_id=eq.${project.id}`,
      }, () => loadRecords())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [project.id])

  // 计时器 tick
  useEffect(() => {
    if (activeTimer) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activeTimer])

  async function saveRecord() {
    if (!newRecord.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('work_records').insert({
      project_id: project.id,
      content: newRecord.trim(),
      author_id: user!.id,
    })
    if (error) {
      alert('保存失败：' + error.message)
      setSaving(false)
      return
    }
    setNewRecord('')
    setSaving(false)
    loadRecords() // 主动刷新，不依赖 Realtime
  }

  async function softDeleteRecord(id: string) {
    if (!confirm('确认标记该记录为已删除？此操作不可撤销。')) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('work_records').update({
      deleted: true,
      deleted_by: user!.id,
      deleted_at: new Date().toISOString(),
    }).eq('id', id)
  }

  async function startTimer() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('time_logs').insert({
      project_id: project.id,
      member_id: user!.id,
      started_at: new Date().toISOString(),
    }).select().single()
    setActiveTimer(data)
    setElapsed(0)
  }

  async function stopTimer() {
    const desc = prompt('请填写本次工作内容（可留空）：') ?? ''
    await supabase.from('time_logs').update({
      finished_at: new Date().toISOString(),
      description: desc,
    }).eq('id', activeTimer.id)
    setActiveTimer(null)
    setElapsed(0)
    loadTimeLogs()
  }

  async function changeStatus(newStatus: string) {
    setStatusChanging(true)
    await supabase.from('projects').update({ status: newStatus }).eq('id', project.id)
    setStatusChanging(false)
    // 刷新页面以更新列表
    window.location.reload()
  }

  return (
    <div className="detail-panel">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-900 text-sm truncate">{project.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            委托方：{project.client || '—'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0 p-1"
          title="关闭"
        >
          ✕
        </button>
      </div>

      {/* Status + admin controls */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <span className={`status-tag st-${project.status}`}>
          {STATUS_LABELS[project.status] || project.status}
        </span>
        {profile?.role === 'admin' && (
          <select
            defaultValue={project.status}
            disabled={statusChanging}
            onChange={e => changeStatus(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white
                       focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="active">进行中</option>
            <option value="delayed">已延期</option>
            <option value="completed">已完成</option>
            <option value="cancelled">未启动</option>
          </select>
        )}
      </div>

      {/* Timer bar */}
      {activeTimer && (
        <div className="timer-bar flex-shrink-0">
          <span>⏱ 计时中 — {formatElapsed(elapsed)}</span>
          <button
            onClick={stopTimer}
            className="bg-white text-blue-700 text-xs font-medium px-3 py-1 rounded-full hover:bg-blue-50"
          >
            停止
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        {(['records', 'time'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${tab === t
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {t === 'records' ? '工作记录' : '工时记录'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === 'records' && (
          <>
            {records.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">暂无工作记录</p>
            )}
            {records.map((r: any) => (
              <div key={r.id} className={`record-entry ${r.deleted ? 'deleted' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">
                    {r.profiles?.name || '未知'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">
                      {formatDateTime(r.created_at)}
                    </span>
                    {r.deleted && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                        已删除
                      </span>
                    )}
                  </div>
                </div>
                <p className={`text-sm text-gray-800 leading-relaxed ${r.deleted ? 'line-through text-gray-400' : ''}`}>
                  {r.content}
                </p>
                {!r.deleted && (
                  <button
                    onClick={() => softDeleteRecord(r.id)}
                    className="mt-1.5 text-xs text-red-400 hover:text-red-600"
                  >
                    标记删除
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'time' && (
          <>
            {timeLogs.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">暂无工时记录</p>
            )}
            {timeLogs.map((l: any) => {
              const dur = l.finished_at
                ? ((new Date(l.finished_at).getTime() - new Date(l.started_at).getTime()) / 3600000).toFixed(1) + ' 小时'
                : '进行中…'
              return (
                <div key={l.id} className="time-entry">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-700">
                      {l.profiles?.name || '未知'}
                    </span>
                    <span className={`text-xs font-semibold ${l.finished_at ? 'text-blue-600' : 'text-amber-500'}`}>
                      {dur}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDateTime(l.started_at)}
                    {l.finished_at && ` — ${new Date(l.finished_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                  {l.description && (
                    <p className="text-sm text-gray-600 mt-1">{l.description}</p>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Add record + timer */}
      <div className="flex-shrink-0 border-t border-gray-200 px-4 py-3 bg-gray-50">
        <textarea
          value={newRecord}
          onChange={e => setNewRecord(e.target.value)}
          placeholder="添加工作记录…"
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400 bg-white"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveRecord()
          }}
        />
        <div className="flex items-center justify-between mt-2 gap-2">
          <button
            onClick={activeTimer ? stopTimer : startTimer}
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors
              ${activeTimer
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
          >
            {activeTimer ? '⏹ 停止计时' : '▶ 开始计时'}
          </button>
          <button
            onClick={saveRecord}
            disabled={saving || !newRecord.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400
                       text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? '保存中…' : '保存记录'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Ctrl+Enter 快速保存</p>
      </div>
    </div>
  )
}
