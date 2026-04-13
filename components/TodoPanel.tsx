'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Valid assignee abbreviations (used when parsing batch input)
const ABBREVS = ['刘', '金', '汤', '祝']

// Max visible before "show more" kicks in for the completed section
const MAX_TOTAL = 25

// Alternating backgrounds for pending items
const PENDING_BG = ['bg-white', 'bg-gray-50']

type Todo = {
  id: string
  content: string
  assignee_abbrev: string
  completed: boolean
  completed_at: string | null
  completed_by_name: string | null
  position: number
  created_at: string
  created_by: string | null
  deleted: boolean
  deleted_by: string | null
  deleted_by_name: string | null
  deleted_at: string | null
}

function parseItems(raw: string): { content: string; abbrev: string }[] {
  return raw
    .split(/[;；]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const cleaned = s.replace(/^\d+\s*[,，.、:：]\s*/, '').trim()
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
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function TodoPanel({ profile }: { profile: any }) {
  const supabase = createClient()
  const [todos,            setTodos]            = useState<Todo[]>([])
  const [showAdd,          setShowAdd]          = useState(false)
  const [input,            setInput]            = useState('')
  const [saving,           setSaving]           = useState(false)
  const [showAllCompleted, setShowAllCompleted] = useState(false)
  const [currentUserId,    setCurrentUserId]    = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null))
    loadTodos()
  }, [])

  async function loadTodos() {
    const { data, error } = await supabase
      .from('todos')
      .select('id, content, assignee_abbrev, completed, completed_at, completed_by_name, position, created_at, created_by, deleted, deleted_by, deleted_by_name, deleted_at')
      .order('created_at', { ascending: false })

    if (error) {
      // Migration 015 not yet applied — fall back to pre-soft-delete columns
      const { data: fallback } = await supabase
        .from('todos')
        .select('id, content, assignee_abbrev, completed, completed_at, completed_by_name, position, created_at, created_by')
        .order('created_at', { ascending: false })
      setTodos((fallback || []).map(t => ({
        ...t,
        deleted: false, deleted_by: null, deleted_by_name: null, deleted_at: null,
      })))
      return
    }
    setTodos(data || [])
  }

  async function saveTodos() {
    const items = parseItems(input)
    if (items.length === 0) { alert('未检测到有效条目'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const maxPos = todos.filter(t => !t.deleted).length > 0
      ? Math.max(...todos.filter(t => !t.deleted).map(t => t.position))
      : -1
    const { error } = await supabase.from('todos').insert(
      items.map((item, i) => ({
        content:         item.content,
        assignee_abbrev: item.abbrev,
        created_by:      user!.id,
        position:        maxPos + 1 + i,
      }))
    )
    if (error) { alert('保存失败：' + error.message) }
    else { setInput(''); setShowAdd(false); await loadTodos() }
    setSaving(false)
  }

  async function markDone(todo: Todo) {
    if (todo.deleted || todo.completed) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase
      .from('profiles').select('name').eq('id', user!.id).single()
    await supabase.from('todos').update({
      completed:          true,
      completed_at:       new Date().toISOString(),
      completed_by_name:  prof?.name || '',
    }).eq('id', todo.id)
    await loadTodos()
  }

  async function restoreCompleted(todo: Todo) {
    await supabase.from('todos').update({
      completed:         false,
      completed_at:      null,
      completed_by_name: null,
    }).eq('id', todo.id)
    await loadTodos()
  }

  async function softDeleteTodo(id: string) {
    if (!confirm('确认删除该待办事项？')) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase
      .from('profiles').select('name').eq('id', user!.id).single()
    const { error } = await supabase.from('todos').update({
      deleted:          true,
      deleted_by:       user!.id,
      deleted_by_name:  prof?.name || '未知',
      deleted_at:       new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    await loadTodos()
  }

  async function restoreTodo(id: string) {
    const { error } = await supabase.from('todos').update({
      deleted:          false,
      deleted_by:       null,
      deleted_by_name:  null,
      deleted_at:       null,
    }).eq('id', id)
    if (error) { alert('恢复失败：' + error.message); return }
    await loadTodos()
  }

  async function hardDeleteTodo(id: string) {
    if (!confirm('确认永久删除该待办？此操作不可恢复。')) return
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    await loadTodos()
  }

  // ── Partitions ─────────────────────────────────────────────
  // pending: not completed, not deleted — sorted newest-first
  const uncompleted = todos
    .filter(t => !t.completed && !t.deleted)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // completed: not deleted
  const completed = todos
    .filter(t => t.completed && !t.deleted)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())

  // deleted (soft-deleted)
  const deletedTodos = todos
    .filter(t => t.deleted)
    .sort((a, b) => {
      const ta = a.deleted_at ?? a.created_at
      const tb = b.deleted_at ?? b.created_at
      return new Date(tb).getTime() - new Date(ta).getTime()
    })

  const completedSlots   = Math.max(0, MAX_TOTAL - uncompleted.length)
  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, completedSlots)
  const hasMore          = !showAllCompleted && completed.length > completedSlots

  // ── Row ────────────────────────────────────────────────────
  function TodoRow({ todo, index, isPending }: { todo: Todo; index: number; isPending: boolean }) {
    const done  = todo.completed
    const rowBg = isPending ? PENDING_BG[index % 2] : ''

    // Soft-delete: any pending non-deleted item
    const canDelete  = isPending && !todo.deleted
    // Restore from soft-delete: deleter or admin
    const canRestore = todo.deleted && (currentUserId === todo.deleted_by || isAdmin)
    // Hard-delete: admin only
    const canHardDel = todo.deleted && isAdmin
    // Restore from completed: completer (by name) or admin
    const canUncomplete = done && !todo.deleted &&
      ((profile?.name && profile.name === todo.completed_by_name) || isAdmin)

    return (
      <div className={`flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors
        ${isPending
          ? `${rowBg} border-gray-200 hover:border-teal-300 hover:bg-teal-50/40`
          : 'border-transparent hover:bg-gray-100'
        }`}
      >
        {/* Circle — marks pending items as done; completed items show static tick */}
        {!todo.deleted && !done && (
          <button
            onClick={() => markDone(todo)}
            title="标记完成"
            className="flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 border-gray-400 hover:border-teal-500 transition-colors"
          />
        )}
        {!todo.deleted && done && (
          <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-teal-500 flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={3.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
        {todo.deleted && (
          <span className="flex-shrink-0 w-3.5 h-3.5 text-[10px] text-red-300 flex items-center justify-center">✕</span>
        )}

        {/* Content row */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className={`text-sm leading-snug break-words
              ${todo.deleted ? 'line-through text-gray-400'
              : done ? 'text-gray-400 line-through'
              : 'text-gray-800'}`}>
              {todo.content}
            </span>
            {todo.assignee_abbrev && (
              <span className={`text-[10px] font-bold px-1 rounded flex-shrink-0
                ${todo.deleted || done ? 'text-gray-400 bg-gray-100' : 'text-teal-600 bg-teal-50'}`}>
                {todo.assignee_abbrev}
              </span>
            )}
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              {todo.deleted && todo.deleted_by_name
                ? `已删除 · ${todo.deleted_by_name}`
                : done && todo.completed_by_name
                ? `✓ ${todo.completed_by_name}`
                : fmtDate(todo.created_at)
              }
            </span>
          </div>

          {/* Action buttons */}
          {(canDelete || canRestore || canHardDel || canUncomplete) && (
            <div className="flex gap-2 mt-0.5">
              {canDelete && (
                <button
                  onClick={() => softDeleteTodo(todo.id)}
                  className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                >
                  删除
                </button>
              )}
              {canUncomplete && (
                <button
                  onClick={() => restoreCompleted(todo)}
                  className="text-[10px] text-teal-500 hover:text-teal-700 transition-colors font-medium"
                >
                  恢复
                </button>
              )}
              {canRestore && (
                <button
                  onClick={() => restoreTodo(todo.id)}
                  className="text-[10px] text-teal-500 hover:text-teal-700 transition-colors font-medium"
                >
                  恢复
                </button>
              )}
              {canHardDel && (
                <button
                  onClick={() => hardDeleteTodo(todo.id)}
                  className="text-[10px] text-red-500 hover:text-red-700 transition-colors font-medium"
                >
                  永久删除
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-[480px] bg-gray-50 border-l border-gray-200 flex flex-col h-full flex-shrink-0">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 flex-shrink-0 bg-white">
        <h2 className="text-sm font-semibold text-gray-800">工作安排</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium
                     px-3 py-1.5 rounded-lg transition-colors"
        >
          + 添加
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {uncompleted.length === 0 && completed.length === 0 && deletedTodos.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">暂无待办事项</p>
        )}

        {uncompleted.map((todo, idx) => (
          <TodoRow key={todo.id} todo={todo} index={idx} isPending={true} />
        ))}

        {completed.length > 0 && (
          <div className="pt-3 pb-1 flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-300" />
            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
              已完成 {completed.length}
            </span>
            <div className="flex-1 h-px bg-gray-300" />
          </div>
        )}

        {visibleCompleted.map((todo, idx) => (
          <TodoRow key={todo.id} todo={todo} index={idx} isPending={false} />
        ))}

        {hasMore && (
          <button
            onClick={() => setShowAllCompleted(true)}
            className="w-full mt-1 py-2 text-xs text-gray-500 hover:text-teal-600
                       border border-dashed border-gray-300 hover:border-teal-400
                       rounded-lg transition-colors"
          >
            查看更多（还有 {completed.length - completedSlots} 条）
          </button>
        )}

        {showAllCompleted && completed.length > completedSlots && (
          <button
            onClick={() => setShowAllCompleted(false)}
            className="w-full mt-1 py-2 text-xs text-gray-400 hover:text-gray-600
                       border border-dashed border-gray-200 rounded-lg transition-colors"
          >
            收起
          </button>
        )}

        {/* ── Deleted section ── */}
        {deletedTodos.length > 0 && (
          <>
            <div className="pt-3 pb-1 flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                已删除 {deletedTodos.length}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            {deletedTodos.map((todo, idx) => (
              <TodoRow key={todo.id} todo={todo} index={idx} isPending={false} />
            ))}
          </>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">添加工作安排</h3>
              <button onClick={() => setShowAdd(false)}
                className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <p className="text-xs text-gray-500 mb-1 leading-relaxed">
              格式：编号,内容+姓名缩写；分号分隔多条
            </p>
            <p className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded mb-3">
              1,联系客户刘;2,准备材料金;3,更新进度汤
            </p>
            <p className="text-[11px] text-gray-400 mb-3">
              姓名缩写：刘（刘鹏）· 金（金某）· 汤（汤某）· 祝（祝某）
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
                                         px-1 rounded border border-teal-200">
                          {item.abbrev}
                        </span>
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
