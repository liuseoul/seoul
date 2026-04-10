'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Todo = {
  id: string
  content: string
  completed: boolean
  completed_at: string | null
  position: number
  created_at: string
}

function parseItems(raw: string): string[] {
  return raw
    .split(/[;；]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^\d+\s*[,，.、:：]\s*/, '').trim())
    .filter(Boolean)
}

export default function TodoPanel() {
  const supabase = createClient()
  const [todos, setTodos]       = useState<Todo[]>([])
  const [showAdd, setShowAdd]   = useState(false)
  const [input, setInput]       = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => { loadTodos() }, [])

  async function loadTodos() {
    const { data } = await supabase
      .from('todos')
      .select('id, content, completed, completed_at, position, created_at')
      .order('position', { ascending: true })
    setTodos(data || [])
  }

  async function saveTodos() {
    const items = parseItems(input)
    if (items.length === 0) { alert('未检测到有效条目，请按格式输入'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Find current max position
    const maxPos = todos.length > 0
      ? Math.max(...todos.map(t => t.position))
      : -1

    const { error } = await supabase.from('todos').insert(
      items.map((content, i) => ({
        content,
        created_by: user!.id,
        position: maxPos + 1 + i,
      }))
    )
    if (error) { alert('保存失败：' + error.message) }
    else {
      setInput('')
      setShowAdd(false)
      await loadTodos()
    }
    setSaving(false)
  }

  async function toggleDone(todo: Todo) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('todos').update({
      completed:    !todo.completed,
      completed_at: !todo.completed ? now : null,
    }).eq('id', todo.id)
    if (error) { console.error(error.message); return }
    await loadTodos()
  }

  // Sort: uncompleted by position asc, completed by completed_at desc
  const uncompleted = todos.filter(t => !t.completed).sort((a, b) => a.position - b.position)
  const completed   = todos.filter(t => t.completed).sort((a, b) =>
    new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
  )

  return (
    <div className="w-60 bg-gray-50 border-l border-gray-200 flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 flex-shrink-0 bg-white">
        <h2 className="text-sm font-semibold text-gray-800">To Do</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium
                     px-3 py-1.5 rounded-lg transition-colors"
        >
          + 添加
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">

        {/* Uncompleted */}
        {uncompleted.length === 0 && completed.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">暂无待办事项</p>
        )}

        {uncompleted.map(todo => (
          <div key={todo.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-100 group">
            <button
              onClick={() => toggleDone(todo)}
              className="flex-shrink-0 mt-0.5 w-4.5 h-4.5 rounded-full border-2 border-gray-400
                         hover:border-blue-500 transition-colors"
              title="标记完成"
            />
            <span className="text-sm text-gray-800 leading-snug break-words flex-1">{todo.content}</span>
          </div>
        ))}

        {/* Divider between uncompleted and completed */}
        {completed.length > 0 && (
          <div className="pt-3 pb-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-300" />
              <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">已完成 {completed.length}</span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>
          </div>
        )}

        {completed.map(todo => (
          <div key={todo.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-100 group">
            <button
              onClick={() => toggleDone(todo)}
              className="flex-shrink-0 mt-0.5 w-4.5 h-4.5 rounded-full bg-green-500
                         flex items-center justify-center transition-colors hover:bg-gray-400"
              title="取消完成"
            >
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <span className="text-sm text-gray-400 line-through leading-snug break-words flex-1">{todo.content}</span>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">添加待办事项</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              按格式输入，以分号分隔：<br />
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                1,事项A;2,事项B;3,事项C
              </span>
            </p>

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="1,联系客户确认合同;2,准备庭审材料;3,更新项目进度"
              rows={5}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder:text-gray-300"
              autoFocus
            />

            {input.trim() && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-1.5">预览（{parseItems(input).length} 条）：</p>
                <ul className="space-y-1">
                  {parseItems(input).map((item, i) => (
                    <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                      <span className="text-blue-400 flex-shrink-0">○</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={saveTodos} disabled={saving || !input.trim()}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
