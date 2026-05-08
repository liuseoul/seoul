'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'

export default function AdminDashboard({
  profile, members,
}: {
  profile: any
  members: any[]
}) {
  const router = useRouter()
  const supabase = createClient()
  // 新建成员表单
  const [memName, setMemName] = useState('')
  const [memUsername, setMemUsername] = useState('')
  const [memPassword, setMemPassword] = useState('')
  const [memRole, setMemRole] = useState('member')
  const [memSaving, setMemSaving] = useState(false)
  const [memMsg, setMemMsg] = useState('')

  // 重置密码
  const [resetId, setResetId] = useState('')
  const [resetPwd, setResetPwd] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  async function createMember() {
    if (!memName.trim() || !memUsername.trim() || !memPassword) {
      setMemMsg('❌ 姓名、用户名、密码均为必填')
      return
    }
    setMemSaving(true)
    setMemMsg('')

    const res = await fetch('/api/admin/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: memName.trim(), username: memUsername.trim(), password: memPassword, role: memRole }),
    })
    const json = await res.json()

    if (!res.ok) {
      setMemMsg(`❌ ${json.error || '创建失败'}`)
    } else {
      setMemMsg('✅ 成员已创建')
      setMemName(''); setMemUsername(''); setMemPassword(''); setMemRole('member')
      setTimeout(() => router.refresh(), 800)
    }
    setMemSaving(false)
  }

  async function resetPassword() {
    if (!resetId || !resetPwd) { setResetMsg('❌ 请选择成员并填写新密码'); return }
    if (resetPwd.length < 6) { setResetMsg('❌ 密码至少 6 位'); return }
    setResetSaving(true)
    setResetMsg('')

    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: resetId, newPassword: resetPwd }),
    })
    const json = await res.json()

    if (!res.ok) { setResetMsg(`❌ ${json.error || '操作失败'}`) }
    else { setResetMsg('✅ 密码已重置'); setResetId(''); setResetPwd('') }
    setResetSaving(false)
  }

  const domain = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'company.internal'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">管理后台</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ======== 成员管理 ======== */}
          <div className="max-w-3xl space-y-6">
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">创建成员</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">姓名 *</label>
                    <input value={memName} onChange={e => setMemName(e.target.value)} placeholder="显示名称" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">用户名 *</label>
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                      <input value={memUsername} onChange={e => setMemUsername(e.target.value)}
                        placeholder="username" className="flex-1 px-3 py-2 text-sm outline-none" />
                      <span className="bg-gray-50 border-l border-gray-300 px-3 py-2 text-xs text-gray-500 flex-shrink-0">
                        @{domain}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">初始密码 *</label>
                    <input type="text" value={memPassword} onChange={e => setMemPassword(e.target.value)}
                      placeholder="至少 6 位" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">角色</label>
                    <select value={memRole} onChange={e => setMemRole(e.target.value)} className="input-field">
                      <option value="member">团队成员</option>
                      <option value="admin">管理员</option>
                    </select>
                  </div>
                </div>
                {memMsg && <p className="mt-3 text-sm">{memMsg}</p>}
                <button onClick={createMember} disabled={memSaving} className="mt-4 btn-primary">
                  {memSaving ? '创建中…' : '创建成员'}
                </button>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">重置成员密码</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">选择成员</label>
                    <select value={resetId} onChange={e => setResetId(e.target.value)} className="input-field">
                      <option value="">— 请选择 —</option>
                      {members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">新密码</label>
                    <input type="password" value={resetPwd} onChange={e => setResetPwd(e.target.value)}
                      placeholder="至少 6 位" className="input-field" />
                  </div>
                </div>
                {resetMsg && <p className="mt-3 text-sm">{resetMsg}</p>}
                <button onClick={resetPassword} disabled={resetSaving} className="mt-4 btn-primary">
                  {resetSaving ? '处理中…' : '重置密码'}
                </button>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  成员列表 <span className="text-gray-400 font-normal text-sm">（{members.length} 人）</span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-2 text-xs font-medium text-gray-500">姓名</th>
                        <th className="pb-2 text-xs font-medium text-gray-500">用户名</th>
                        <th className="pb-2 text-xs font-medium text-gray-500">角色</th>
                        <th className="pb-2 text-xs font-medium text-gray-500">创建时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m: any) => (
                        <tr key={m.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-2.5 font-medium text-gray-900">{m.name}</td>
                          <td className="py-2.5 text-gray-500">{m.email.replace(`@${domain}`, '')}</td>
                          <td className="py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                              {m.role === 'admin' ? '管理员' : '成员'}
                            </span>
                          </td>
                          <td className="py-2.5 text-gray-400 text-xs">
                            {new Date(m.created_at).toLocaleDateString('zh-CN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
          </div>
        </div>
      </div>
    </div>
  )
}
