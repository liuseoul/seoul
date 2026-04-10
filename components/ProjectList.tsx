'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import ProjectDetailPanel from './ProjectDetailPanel'

const STATUS_LABELS: Record<string, string> = {
  all: '全部',
  active: '进行中',
  delayed: '已延期',
  completed: '已完成',
  cancelled: '未启动',
}

const STATUS_ORDER = ['all', 'active', 'delayed', 'completed', 'cancelled']

// Alternating light background colors
const ROW_COLORS = ['bg-white', 'bg-blue-50']

function calcHours(logs: Array<{ started_at: string; finished_at: string | null }>) {
  return logs
    .reduce((sum, log) => {
      if (!log.finished_at) return sum
      return sum + (new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 3600000
    }, 0)
    .toFixed(1)
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ProjectList({ projects, profile }: { projects: any[]; profile: any }) {
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const router = useRouter()

  const filtered =
    filter === 'all' ? projects : projects.filter((p: any) => p.status === filter)

  const selectedProject = projects.find((p: any) => p.id === selectedId) || null

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">项目概览</h1>
          {profile?.role === 'admin' && (
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
                         text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150"
            >
              <span className="text-base leading-none">+</span>
              <span>新建项目</span>
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          {STATUS_ORDER.map(key => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150
                ${filter === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              {STATUS_LABELS[key]}
              {key !== 'all' && (
                <span className="ml-1.5 text-xs opacity-70">
                  {projects.filter((p: any) => p.status === key).length}
                </span>
              )}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400">共 {filtered.length} 个项目</span>
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
            const recordCount = project.work_records?.[0]?.count ?? 0
            const hours = calcHours(project.time_logs || [])
            const isSelected = selectedId === project.id
            const rowBg = ROW_COLORS[index % 2]

            return (
              <div
                key={project.id}
                className={`project-row ${isSelected ? 'selected' : rowBg}`}
                onClick={() => setSelectedId(isSelected ? null : project.id)}
              >
                {/* Left: name + client */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 truncate">{project.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3 truncate">
                    <span>委托方：{project.client || '—'}</span>
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

                {/* Right: status + date */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`status-tag st-${project.status}`}>
                    {STATUS_LABELS[project.status] || project.status}
                  </span>
                  <span className="text-xs text-gray-400 w-24 text-right">
                    {formatDate(project.updated_at || project.created_at)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
          profile={profile}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
