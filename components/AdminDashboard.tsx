'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  delayed: '已取消',
  completed: '已完成',
  cancelled: '未启动',
}

export default function AdminDashboard({
  profile, projects, members,
}: {
  profile: any
  projects: any[]
  members: any[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'projects' | 'members'>('projects')

  // 新建项目表单
  const [projName, setProjName] = useState('')
  const [projClient, setProjClient] = useState('')
  const [projDesc, setProjDesc] = useState('')
  const [projStatus, setProjStatus] = useState('active')
  const [projAgreement, setProjAgreement] = useState('Deheng Beijing')
  const [projCurrency, setProjCurrency] = useState('CNY')
  const [projAmount, setProjAmount] = useState('')
  const [collabParties, setCollabParties] = useState([''])
  const [projSaving, setProjSaving] = useState(false)
  const [projMsg, setProjMsg] = useState('')

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

  function addCollabParty() {
    setCollabParties([...collabParties, ''])
  }

  function updateCollabParty(index: number, value: string) {
    const updated = [...collabParties]
    updated[index] = value
    setCollabParties(updated)
  }

  function removeCollabParty(index: number) {
    if (collabParties.length === 1) return
    setCollabParties(collabParties.filter((_, i) => i !== index))
  }

  async function createProject() {
    if (!projName.trim() || !projClient.trim()) {
      setProjMsg('❌ 项目名称和委托方为必填')
      return
    }
    setProjSaving(true)
    setProjMsg('')

    const { data: { user } } = await supabase.auth.getUser()
    const parties = collabParties.map(p => p.trim()).filter(Boolean)

    const { error } = await supabase.from('projects').insert({
      name: projName.trim(),
      client: projClient.trim(),
      description: projDesc.trim(),
      status: projStatus,
      agreement_party: projAgreement,
      service_fee_currency: projCurrency,
      service_fee_amount: projAmount ? parseFloat(projAmount) : null,
      collaboration_parties: parties,
      created_by: user!.id,
    })

    if (error) {
      setProjMsg(`❌ 创建失败：${error.message}`)
    } else {
      setProjMsg('✅ 项目已创建')
      setProjName(''); setProjClient(''); setProjDesc('')
      setProjStatus('active'); setProjAgreement('Deheng Beijing')
      setProjCurrency('CNY'); setProjAmount(''); setCollabParties([''])
      setTimeout(() => router.refresh(), 800)
    }
    setProjSaving(false)
  }

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

        <div className="flex border-b border-gray-200 bg-white px-6 flex-shrink-0">
          {(['projects', 'members'] as const).map(key => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {key === 'projects' ? '项目管理' : '成员管理'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ======== 项目管理 ======== */}
          {tab === 'projects' && (
            <div className="max-w-3xl space-y-6">
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">新建项目</h2>
                <div className="grid grid-cols-2 gap-4">

                  {/* 项目名称 */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm text-gray-700 mb-1">项目名称 *</label>
                    <input value={projName} onChange={e => setProjName(e.target.value)}
                      placeholder="请输入项目名称" className="input-field" />
                  </div>

                  {/* 委托方 */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm text-gray-700 mb-1">委托方 *</label>
                    <input value={projClient} onChange={e => setProjClient(e.target.value)}
                      placeholder="委托方名称" className="input-field" />
                  </div>

                  {/* 项目描述 */}
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">项目描述</label>
                    <textarea value={projDesc} onChange={e => setProjDesc(e.target.value)}
                      placeholder="简要描述（可选）" rows={2} className="input-field resize-none" />
                  </div>

                  {/* 初始状态 */}
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">初始状态</label>
                    <select value={projStatus} onChange={e => setProjStatus(e.target.value)} className="input-field">
                      <option value="active">进行中</option>
                      <option value="cancelled">未启动</option>
                    </select>
                  </div>

                  {/* 签约方 */}
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">签约方</label>
                    <select value={projAgreement} onChange={e => setProjAgreement(e.target.value)} className="input-field">
                      <option value="Deheng Beijing">Deheng Beijing</option>
                      <option value="Deheng Seoul">Deheng Seoul</option>
                    </select>
                  </div>

                  {/* 服务费币种 + 金额 */}
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">服务费币种</label>
                    <select value={projCurrency} onChange={e => setProjCurrency(e.target.value)} className="input-field">
                      <option value="CNY">CNY（人民币）</option>
                      <option value="KRW">KRW（韩元）</option>
                      <option value="USD">USD（美元）</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">服务费金额</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={projAmount}
                      onChange={e => setProjAmount(e.target.value)}
                      placeholder="可选"
                      className="input-field"
                    />
                  </div>

                  {/* 协作方 */}
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">协作方</label>
                    <div className="space-y-2">
                      {collabParties.map((party, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={party}
                            onChange={e => updateCollabParty(i, e.target.value)}
                            placeholder={`协作方 ${i + 1}`}
                            className="input-field flex-1"
                          />
                          {collabParties.length > 1 && (
                            <button
                              onClick={() => removeCollabParty(i)}
                              className="text-gray-400 hover:text-red-500 text-lg leading-none px-1"
                              title="移除"
                            >×</button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={addCollabParty}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <span className="text-lg leading-none">+</span> 添加协作方
                      </button>
                    </div>
                  </div>
                </div>

                {projMsg && <p className="mt-3 text-sm">{projMsg}</p>}
                <button onClick={createProject} disabled={projSaving} className="mt-4 btn-primary">
                  {projSaving ? '创建中…' : '创建项目'}
                </button>
              </section>

              {/* 现有项目列表 */}
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  现有项目 <span className="text-gray-400 font-normal text-sm">（{projects.length} 个）</span>
                </h2>
                <div className="space-y-2">
                  {projects.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500">委托方：{p.client}</div>
                      </div>
                      <span className={`status-tag st-${p.status}`}>{STATUS_LABELS[p.status]}</span>
                    </div>
                  ))}
                  {projects.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">暂无项目</p>}
                </div>
              </section>
            </div>
          )}

          {/* ======== 成员管理 ======== */}
          {tab === 'members' && (
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
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                      <input value={memUsername} onChange={e => setMemUsername(e.target.value)}
                        placeholder="username" className="flex-1 px-3 py-2 text-sm outline-none" />
                      <span className="bg-gray-50 border-l border-gray-300 px-3 py-2 text-xs text-gray-500 flex-shrink-0">
                        @{domain}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">初始密码 *</label>
                    <input type="password" value={memPassword} onChange={e => setMemPassword(e.target.value)}
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
          )}
        </div>
      </div>
    </div>
  )
}
