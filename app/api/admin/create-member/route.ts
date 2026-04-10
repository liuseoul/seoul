export const runtime = 'edge'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // 运行时按需创建，避免构建时缺少环境变量报错
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 })
  }

  const { name, username, password, role } = await req.json()
  if (!name || !username || !password) {
    return NextResponse.json({ error: '姓名、用户名、密码均为必填' }, { status: 400 })
  }

  const domain = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'company.internal'
  const email = `${username.trim()}@${domain}`

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: role || 'member' },
  })

  if (error) {
    return NextResponse.json(
      { error: error.message.includes('already') ? '该用户名已存在' : error.message },
      { status: 400 }
    )
  }

  await supabaseAdmin.from('profiles').upsert({
    id: data.user.id,
    name,
    email,
    role: role || 'member',
  })

  return NextResponse.json({ success: true })
}
