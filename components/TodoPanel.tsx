'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Abbreviation → email mapping (used for parsing input)
const ABBREV_EMAIL: Record<string, string> = {
  '刘': 'liupeng1@dehenglaw.com',
  '金': 'seoul@dehenglaw.com',
  '汤': 'tangzy@dehenglaw.com',
  '祝': 'zhucuiying@dehenglaw.com',
}
const ABBREVS = Object.keys(ABBREV_EMAIL)

type Todo = {
  id: string
  content: string
  assignee_abbrev: string
  completed: boolean
  completed_at: string | null
  completed_by_name: string | null
  position: number
  created_at: string
}

function parseItems(raw: string): { content: string; abbrev: string }[] {
  return raw
    .split(/[;；]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      // Strip leading "1," etc.
      const cleaned = s.replace(/^\d+\s*[,，.、:：]\s*/, '').trim()
      // Last character as assignee abbreviation
      const last = cleaned.slice(-1)
      if (ABBREVS.includes(last)) {
        return { content: cleaned.slice(0, -1).trim(), abbrev: last }
      }
      return { content: cleaned, abbrev: '' }
    })
    .filter(item => Boolean(item.content))
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}`
}

export default function TodoPanel({ isAdmin }: { isAdmin: boolean }) {
  const supabase = createClient()
  const [todos,   setTodos]   = useState<Todo[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [input,   setInput]   = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    loadTodos()
  }, [])

  async function loadTodos() {
    const { data } = await supabase
      .from('todos')
      .select('id, content, assignee_abbrev, completed, completed_at, completed_by_name, position, created_at')
      .order('position', { ascending: true })
    setTodos(data || [])
  }

  async function saveTodos() {
    const items = parseItems(input)
    if (items.length === 0) { alert('未检测到有效条目'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const maxPos = todos.length > 0 ? Math.max(...todos.map(t => t.position)) : -1
    const { error } = await supabase.from('todos').insert(
      items.map((item, i) => ({
        content: item.content,
        assignee_abbrev: item.abbrev,
        created_by: user!.id,
        position: maxPos + 1 + i,
      }))
    )
    if (error) { alert('保存失败：' + error.message) }
    else { setInput(''); setShowAdd(false); await loadTodos() }
    setSaving(false)
  }

  async function toggleDone(todo: Todo) {
    const nowDone = !todo.completed
    const now = new Date().toISOString()

    if (nowDone) {
      // Look up current user's name to record who completed it
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user!.id)
        .single()
      const name = profileData?.name || ''
      await supabase.from('todos').update({
        completed: true,
        completed_at: now,
        completed_by_name: name,
      }).eq('id', todo.id)
    } else {
      await supabase.from('todos').update({
        completed: false,
        completed_at: null,
        completed_by_name: null,
      }).eq('id', todo.id)
    }
    await loadTodos()
  }

  const uncompleted = todos.filter(t => !t.completed).sort((a, b) => a.position - b.position)
  const completed   = todos.filter(t =>  t.completed).sort((a, b) =>
    new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
  )

  // ── Row renderer ───────────────────────────────────────────
  function TodoRow({ todo }: { todo: Todo }) {
    const done = todo.completed
    return (
      <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100">
        {/* Completion circle — clickable by all */}
        <button
          onClick={() => toggleDone(todo)}
          title={done ? '取消完成' : '标记完成'}
          className={`flex-shrink-0 w-3.5 h-3.5 rounded-full transition-colors
            ${done
              ? 'bg-teal-500 flex items-center justify-center hover:bg-gray-400'
              : 'border-2 border-gray-400 hover:border-teal-500'
            }`}
        >
          {done && (
            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={3.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content + assignee + date/completer — all on one line */}
        <div className="flex-1 min-w-0 flex items-baseline gap-1 flex-wrap">
          <span className={`text-sm leading-snug break-words
            ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {todo.content}
          </span>
          {todo.assignee_abbrev && (
            <span className={`text-[10px] font-bold px-1 rounded flex-shrink-0
              ${done ? 'text-gray-400 bg-gray-100' : 'text-teal-600 bg-teal-50'}`}>
              {todo.assignee_abbrev}
            </span>
          )}
          {done && todo.completed_by_name ? (
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              ✓ {todo.completed_by_name}
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              {fmtDate(todo.created_at)}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-[480px] bg-gray-50 border-l border-gray-200 flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 flex-shrink-0 bg-white">
        <h2 className="text-sm font-semibold text-gray-800">To Do</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium
                     px-3 py-1.5 rounded-lg transition-colors"
        >
          + 添加
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {uncompleted.length === 0 && completed.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">暂无待办事项</p>
        )}

        {uncompleted.map(todo => <TodoRow key={todo.id} todo={todo} />)}

        {completed.length > 0 && (
          <div className="pt-3 pb-1 flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-300" />
            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
              已完成 {completed.length}
            </span>
            <div className="flex-1 h-px bg-gray-300" />
          </div>
        )}

        {completed.map(todo => <TodoRow key={todo.id} todo={todo} />)}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">添加待办事项</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <p className="text-xs text-gray-500 mb-1 leading-relaxed">
              格式：编号,内容+姓名缩写；分号分隔多条
            </p>
            <p className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded mb-3">
              1,联系客户刘;2,准备材料金;3,更新进度汤
            </p>
            <p className="text-[11px] text-gray-400 mb-3">
              姓名缩写：刘（liupeng1）· 金（seoul）· 汤（tangzy）· 祝（zhucuiying）
            </p>

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="1,联系客户确认合同刘;2,准备庭审材料金"
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
                         focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                         placeholder:text-gray-300"
              autoFocus
            />

            {input.trim() && (
              <div className="mt-3 p-3 bg-teal-50 rounded-lg">
                <p className="text-xs text-teal-600 font-medium mb-1.5">
                  预览（{parseItems(input).length} 条）：
                </p>
                <ul className="space-y-1">
                  {parseItems(input).map((item, i) => (
                    <li key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                      <span className="text-teal-400">○</span>
                      <span>{item.content}</span>
                      {item.abbrev && (
                        <span className="text-[10px] font-bold text-teal-600 bg-teal-50
                                         px-1 rounded border border-teal-200">{item.abbrev}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300
                           rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={saveTodos} disabled={saving || !input.trim()}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600
                           hover:bg-teal-700 rounded-lg disabled:bg-gray-200
                           disabled:text-gray-400 transition-colors">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
