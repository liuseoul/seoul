'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ABBREVS = ['刘', '金', '汤', '祝']
const MAX_TOTAL = 25
const PENDING_BG = ['bg-white', 'bg-gray-50']

type Member = { id: string; name: string }

type Todo = {
  id: string
  content: string
  assignee_abbrev: string
  assignee_abbrev_2: string | null
  due_date: string | null
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

// ── Helpers ──────────────────────────────────────────────────
function parseItems(raw: string): { content: string; abbrev: string }[] {
  return raw
    .split(/[;；]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const cleaned = s.replace(/^\d+\s*[,，.、:：]\s*/, '').trim()
      const last = cleaned.slice(-1)
      if (ABBREVS.includes(last)) return { content: cleaned.slice(0, -1).trim(), abbrev: last }
      return { content: cleaned, abbrev: '' }
    })
    .filter(item => Boolean(item.content))
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

/** First char of name used as the display abbreviation */
function nameToAbbrev(name: string) { return name ? name.slice(0, 1) : '' }

// ── MemberPicker — module-level to avoid remount on re-render ─
function MemberPicker({ label, value, members, onChange }: {
  label: string; value: string; members: Member[]; onChange: (name: string) => void
}) {
  return (
    <div>
      <span className="text-[11px] text-gray-400 mr-1">{label}</span>
      <div className="inline-flex flex-wrap gap-1 mt-0.5">
        <button type="button" onClick={() => onChange('')}
          className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors
            ${value === '' ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
          无
        </button>
        {members.map(m => (
          <button key={m.id} type="button" onClick={() => onChange(m.name)}
            className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors
              ${value === m.name ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {m.name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── TodoRow — module-level to keep stable DOM identity ────────
interface TodoRowProps {
  todo: Todo
  index: number
  isPending: boolean
  members: Member[]
  currentUserId: string | null
  isAdmin: boolean
  profileName: string | null
  editingId: string | null
  editContent: string
  editAssignee1: string   // member name ('' = unassigned)
  editAssignee2: string
  editSaving: boolean
  onSetEditContent:   (v: string) => void
  onSetEditAssignee1: (v: string) => void
  onSetEditAssignee2: (v: string) => void
  onMarkDone:         (todo: Todo) => void
  onStartEdit:        (todo: Todo) => void
  onCancelEdit:       () => void
  onSaveEdit:         (id: string) => void
  onSoftDelete:       (id: string) => void
  onRestoreCompleted: (todo: Todo) => void
  onRestoreTodo:      (id: string) => void
  onHardDelete:       (id: string) => void
}

function TodoRow({
  todo, index, isPending, members,
  currentUserId, isAdmin, profileName,
  editingId, editContent, editAssignee1, editAssignee2, editSaving,
  onSetEditContent, onSetEditAssignee1, onSetEditAssignee2,
  onMarkDone, onStartEdit, onCancelEdit, onSaveEdit,
  onSoftDelete, onRestoreCompleted, onRestoreTodo, onHardDelete,
}: TodoRowProps) {
  const done      = todo.completed
  const rowBg     = isPending ? PENDING_BG[index % 2] : ''
  const isEditing = editingId === todo.id

  const canDelete           = isPending && !todo.deleted
  const canRevise           = isPending && !todo.deleted && currentUserId === todo.created_by
  const canRestore          = todo.deleted && (currentUserId === todo.deleted_by || isAdmin)
  const canHardDel          = todo.deleted && isAdmin
  const canHardDelCompleted = done && !todo.deleted && isAdmin
  const canUncomplete       = done && !todo.deleted &&
    ((profileName && profileName === todo.completed_by_name) || isAdmin)

  return (
    <div className={`flex items-start gap-2 px-2 py-2 rounded-lg border transition-colors
      ${isPending
        ? `${rowBg} border-gray-200 hover:border-teal-300 hover:bg-teal-50/40`
        : 'border-transparent hover:bg-gray-100'}`}
    >
      {/* Circle / tick / deleted marker */}
      {!todo.deleted && !done && (
        <button onClick={() => onMarkDone(todo)} title="标记完成"
          className="flex-shrink-0 mt-1 w-3.5 h-3.5 rounded-full border-2 border-gray-400 hover:border-teal-500 transition-colors" />
      )}
      {!todo.deleted && done && (
        <span className="flex-shrink-0 mt-1 w-3.5 h-3.5 rounded-full bg-teal-500 flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
      {todo.deleted && (
        <span className="flex-shrink-0 mt-1 w-3.5 h-3.5 text-[10px] text-red-300 flex items-center justify-center">✕</span>
      )}

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          /* ── Inline edit mode ── */
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={e => onSetEditContent(e.target.value)}
              rows={2}
              autoFocus
              className="w-full text-sm border border-teal-400 rounded px-2 py-1 resize-none
                         focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <MemberPicker label="负责人1：" value={editAssignee1} members={members} onChange={onSetEditAssignee1} />
            <MemberPicker label="负责人2：" value={editAssignee2} members={members} onChange={onSetEditAssignee2} />
            <div className="flex gap-2">
              <button onClick={() => onSaveEdit(todo.id)} disabled={editSaving}
                className="text-xs font-medium text-white bg-teal-600 hover:bg-teal-700
                           px-2.5 py-1 rounded transition-colors disabled:opacity-50">
                {editSaving ? '保存…' : '保存'}
              </button>
              <button onClick={onCancelEdit}
                className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1 transition-colors">
                取消
              </button>
            </div>
          </div>
        ) : (
          /* ── Normal display mode ── */
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
            {todo.assignee_abbrev_2 && (
              <span className={`text-[10px] font-bold px-1 rounded flex-shrink-0
                ${todo.deleted || done ? 'text-gray-400 bg-gray-100' : 'text-indigo-600 bg-indigo-50'}`}>
                {todo.assignee_abbrev_2}
              </span>
            )}
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              {todo.deleted && todo.deleted_by_name
                ? `已删除 · ${todo.deleted_by_name}`
                : done && todo.completed_by_name
                ? `✓ ${todo.completed_by_name}`
                : fmtDate(todo.created_at)}
            </span>
            {!todo.deleted && !done && todo.due_date && (
              <span className="text-[10px] text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded flex-shrink-0">
                截止 {fmtDate(todo.due_date + 'T00:00:00')}
              </span>
            )}
            {canRevise && (
              <button onClick={() => onStartEdit(todo)}
                className="text-[10px] text-blue-500 hover:text-blue-700 transition-colors flex-shrink-0">修改</button>
            )}
            {canDelete && (
              <button onClick={() => onSoftDelete(todo.id)}
                className="text-[10px] text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">删除</button>
            )}
            {canUncomplete && (
              <button onClick={() => onRestoreCompleted(todo)}
                className="text-[10px] text-teal-500 hover:text-teal-700 transition-colors font-medium flex-shrink-0">恢复</button>
            )}
            {canHardDelCompleted && (
              <button onClick={() => onHardDelete(todo.id)}
                className="text-[10px] text-red-500 hover:text-red-700 transition-colors font-medium flex-shrink-0">永久删除</button>
            )}
            {canRestore && (
              <button onClick={() => onRestoreTodo(todo.id)}
                className="text-[10px] text-teal-500 hover:text-teal-700 transition-colors font-medium flex-shrink-0">恢复</button>
            )}
            {canHardDel && (
              <button onClick={() => onHardDelete(todo.id)}
                className="text-[10px] text-red-500 hover:text-red-700 transition-colors font-medium flex-shrink-0">永久删除</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────
export default function TodoPanel({ profile }: { profile: any }) {
  const supabase = createClient()
  const [todos,            setTodos]            = useState<Todo[]>([])
  const [members,          setMembers]          = useState<Member[]>([])
  const [showAdd,          setShowAdd]          = useState(false)
  const [input,            setInput]            = useState('')
  const [saving,           setSaving]           = useState(false)
  const [showAllCompleted, setShowAllCompleted] = useState(false)
  const [currentUserId,    setCurrentUserId]    = useState<string | null>(null)
  const [editingId,        setEditingId]        = useState<string | null>(null)
  const [editContent,      setEditContent]      = useState('')
  const [editAssignee1,    setEditAssignee1]    = useState('')  // member name
  const [editAssignee2,    setEditAssignee2]    = useState('')  // member name
  const [editSaving,       setEditSaving]       = useState(false)
  const [showAllPending,   setShowAllPending]   = useState(false)

  // ── Add modal mode ─────────────────────────────────────────
  const [addMode,        setAddMode]        = useState<'single' | 'multi'>('single')
  const [singleContent,  setSingleContent]  = useState('')
  const [singleAssignee1,setSingleAssignee1]= useState('')   // member name
  const [singleAssignee2,setSingleAssignee2]= useState('')   // member name
  const [singleDueDate,  setSingleDueDate]  = useState('')

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null))
    loadTodos()
    loadMembers()
  }, [])

  async function loadMembers() {
    const { data } = await supabase.from('profiles').select('id, name').order('name')
    setMembers(data || [])
  }

  async function loadTodos() {
    const { data, error } = await supabase
      .from('todos')
      .select('id, content, assignee_abbrev, assignee_abbrev_2, due_date, completed, completed_at, completed_by_name, position, created_at, created_by, deleted, deleted_by, deleted_by_name, deleted_at')
      .order('created_at', { ascending: false })

    if (error) {
      // Fallback: older migrations not yet applied
      const { data: fallback } = await supabase
        .from('todos')
        .select('id, content, assignee_abbrev, completed, completed_at, completed_by_name, position, created_at, created_by, deleted, deleted_by, deleted_by_name, deleted_at')
        .order('created_at', { ascending: false })
      setTodos((fallback || []).map(t => ({ ...t, assignee_abbrev_2: null, due_date: null })))
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
      ? Math.max(...todos.filter(t => !t.deleted).map(t => t.position)) : -1
    const { error } = await supabase.from('todos').insert(
      items.map((item, i) => ({
        content: item.content, assignee_abbrev: item.abbrev,
        created_by: user!.id, position: maxPos + 1 + i,
      }))
    )
    if (error) { alert('保存失败：' + error.message) }
    else { setInput(''); setShowAdd(false); await loadTodos() }
    setSaving(false)
  }

  async function saveSingleTodo() {
    if (!singleContent.trim()) { alert('内容不能为空'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const maxPos = todos.filter(t => !t.deleted).length > 0
      ? Math.max(...todos.filter(t => !t.deleted).map(t => t.position)) : -1
    const { error } = await supabase.from('todos').insert({
      content:           singleContent.trim(),
      assignee_abbrev:   nameToAbbrev(singleAssignee1),
      assignee_abbrev_2: nameToAbbrev(singleAssignee2) || null,
      due_date:          singleDueDate || null,
      created_by:        user!.id,
      position:          maxPos + 1,
    })
    if (error) { alert('保存失败：' + error.message) }
    else {
      setSingleContent(''); setSingleAssignee1(''); setSingleAssignee2(''); setSingleDueDate('')
      setShowAdd(false); await loadTodos()
    }
    setSaving(false)
  }

  async function markDone(todo: Todo) {
    if (todo.deleted || todo.completed) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', user!.id).single()
    await supabase.from('todos').update({
      completed: true, completed_at: new Date().toISOString(), completed_by_name: prof?.name || '',
    }).eq('id', todo.id)
    await loadTodos()
  }

  async function restoreCompleted(todo: Todo) {
    await supabase.from('todos').update({ completed: false, completed_at: null, completed_by_name: null }).eq('id', todo.id)
    await loadTodos()
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id)
    setEditContent(todo.content)
    // Reverse-map abbrev → member name (first member whose name starts with the abbrev)
    const toName = (abbrev: string) =>
      members.find(m => m.name.slice(0, 1) === abbrev)?.name || ''
    setEditAssignee1(toName(todo.assignee_abbrev))
    setEditAssignee2(toName(todo.assignee_abbrev_2 || ''))
  }

  function cancelEdit() { setEditingId(null); setEditContent(''); setEditAssignee1(''); setEditAssignee2('') }

  async function saveEdit(id: string) {
    if (!editContent.trim()) { alert('内容不能为空'); return }
    setEditSaving(true)
    const { error } = await supabase.from('todos').update({
      content:           editContent.trim(),
      assignee_abbrev:   nameToAbbrev(editAssignee1),
      assignee_abbrev_2: nameToAbbrev(editAssignee2) || null,
    }).eq('id', id)
    if (error) { alert('修改失败：' + error.message); setEditSaving(false); return }
    setEditingId(null); setEditContent(''); setEditAssignee1(''); setEditAssignee2('')
    setEditSaving(false)
    await loadTodos()
  }

  async function softDeleteTodo(id: string) {
    if (!confirm('确认删除该待办事项？')) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', user!.id).single()
    const { error } = await supabase.from('todos').update({
      deleted: true, deleted_by: user!.id,
      deleted_by_name: prof?.name || '未知', deleted_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    await loadTodos()
  }

  async function restoreTodo(id: string) {
    const { error } = await supabase.from('todos').update({
      deleted: false, deleted_by: null, deleted_by_name: null, deleted_at: null,
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
  const uncompleted = todos
    .filter(t => !t.completed && !t.deleted)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const completed = todos
    .filter(t => t.completed && !t.deleted)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())

  const deletedTodos = todos
    .filter(t => t.deleted)
    .sort((a, b) => new Date(b.deleted_at ?? b.created_at).getTime() - new Date(a.deleted_at ?? a.created_at).getTime())

  const completedSlots   = Math.max(0, MAX_TOTAL - uncompleted.length)
  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, completedSlots)
  const hasMore          = !showAllCompleted && completed.length > completedSlots

  const rowProps = {
    members, currentUserId, isAdmin, profileName: profile?.name || null,
    editingId, editContent, editAssignee1, editAssignee2, editSaving,
    onSetEditContent:   setEditContent,
    onSetEditAssignee1: setEditAssignee1,
    onSetEditAssignee2: setEditAssignee2,
    onMarkDone:         markDone,
    onStartEdit:        startEdit,
    onCancelEdit:       cancelEdit,
    onSaveEdit:         saveEdit,
    onSoftDelete:       softDeleteTodo,
    onRestoreCompleted: restoreCompleted,
    onRestoreTodo:      restoreTodo,
    onHardDelete:       hardDeleteTodo,
  }

  return (
    <div className="w-[480px] bg-gray-50 border-l border-gray-200 flex flex-col h-full flex-shrink-0">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 flex-shrink-0 bg-white">
        <h2 className="text-sm font-semibold text-gray-800">工作安排</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAllPending(true)}
            className="text-xs text-gray-500 hover:text-teal-600 px-2 py-1 rounded border border-gray-300 hover:border-teal-400 transition-colors">
            全部
          </button>
          <button onClick={() => setShowAdd(true)}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
            + 添加
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {uncompleted.length === 0 && completed.length === 0 && deletedTodos.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">暂无待办事项</p>
        )}

        {uncompleted.map((todo, idx) => (
          <TodoRow key={todo.id} todo={todo} index={idx} isPending={true} {...rowProps} />
        ))}

        {completed.length > 0 && (
          <div className="pt-3 pb-1 flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-300" />
            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">已完成 {completed.length}</span>
            <div className="flex-1 h-px bg-gray-300" />
          </div>
        )}

        {visibleCompleted.map((todo, idx) => (
          <TodoRow key={todo.id} todo={todo} index={idx} isPending={false} {...rowProps} />
        ))}

        {hasMore && (
          <button onClick={() => setShowAllCompleted(true)}
            className="w-full mt-1 py-2 text-xs text-gray-500 hover:text-teal-600
                       border border-dashed border-gray-300 hover:border-teal-400 rounded-lg transition-colors">
            查看更多（还有 {completed.length - completedSlots} 条）
          </button>
        )}
        {showAllCompleted && completed.length > completedSlots && (
          <button onClick={() => setShowAllCompleted(false)}
            className="w-full mt-1 py-2 text-xs text-gray-400 hover:text-gray-600
                       border border-dashed border-gray-200 rounded-lg transition-colors">
            收起
          </button>
        )}

        {deletedTodos.length > 0 && (
          <>
            <div className="pt-3 pb-1 flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">已删除 {deletedTodos.length}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            {deletedTodos.map((todo, idx) => (
              <TodoRow key={todo.id} todo={todo} index={idx} isPending={false} {...rowProps} />
            ))}
          </>
        )}
      </div>

      {/* Show All Pending Modal */}
      {showAllPending && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">全部待处理事项 ({uncompleted.length})</h3>
              <button onClick={() => setShowAllPending(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {uncompleted.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">暂无待处理事项</p>
              ) : (
                uncompleted.map((todo, idx) => (
                  <div key={todo.id} className={`flex items-baseline gap-1.5 px-2 py-2 rounded-lg border border-gray-200 ${PENDING_BG[idx % 2]}`}>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(todo.created_at)}</span>
                    <span className="text-sm text-gray-800 leading-snug flex-1">{todo.content}</span>
                    {todo.assignee_abbrev && (
                      <span className="text-[10px] font-bold px-1 rounded text-teal-600 bg-teal-50 flex-shrink-0">{todo.assignee_abbrev}</span>
                    )}
                    {todo.assignee_abbrev_2 && (
                      <span className="text-[10px] font-bold px-1 rounded text-indigo-600 bg-indigo-50 flex-shrink-0">{todo.assignee_abbrev_2}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <h3 className="text-base font-semibold text-gray-900">添加工作安排</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-2 px-6 pb-4 border-b border-gray-100">
              {(['single', 'multi'] as const).map(m => (
                <button key={m} onClick={() => setAddMode(m)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                    ${addMode === m ? 'bg-teal-600 text-white border-teal-600' : 'text-gray-600 hover:bg-gray-100 border-gray-200'}`}>
                  {m === 'single' ? '添加单项' : '添加多项'}
                </button>
              ))}
            </div>

            {addMode === 'single' ? (
              /* ── Single item form ── */
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">内容 <span className="text-red-500">*</span></label>
                  <textarea value={singleContent} onChange={e => setSingleContent(e.target.value)}
                    placeholder="工作内容…" rows={3} autoFocus
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
                               focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-300" />
                </div>
                <MemberPicker label="负责人1：" value={singleAssignee1} members={members} onChange={setSingleAssignee1} />
                <MemberPicker label="负责人2：" value={singleAssignee2} members={members} onChange={setSingleAssignee2} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">截止日期 <span className="text-gray-400 text-xs font-normal">（选填）</span></label>
                  <input type="date" value={singleDueDate} onChange={e => setSingleDueDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowAdd(false)}
                    className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
                  <button onClick={saveSingleTodo} disabled={saving || !singleContent.trim()}
                    className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                               rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                    {saving ? '保存中…' : '保存'}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Multi item form ── */
              <div className="px-6 py-4 space-y-3">
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-medium">
                  使用分号（；）分项内容
                </p>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="1,联系客户确认合同刘;2,准备庭审材料金"
                  rows={5}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
                             focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                             placeholder:text-gray-300"
                  autoFocus
                />
                {input.trim() && (
                  <div className="p-3 bg-teal-50 rounded-lg">
                    <p className="text-xs text-teal-600 font-medium mb-1.5">预览（{parseItems(input).length} 条）：</p>
                    <ul className="space-y-1">
                      {parseItems(input).map((item, i) => (
                        <li key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                          <span className="text-teal-400">○</span>
                          <span>{item.content}</span>
                          {item.abbrev && (
                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1 rounded border border-teal-200">{item.abbrev}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowAdd(false)}
                    className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
                  <button onClick={saveTodos} disabled={saving || !input.trim()}
                    className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                               rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                    {saving ? '保存中…' : '保存'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
