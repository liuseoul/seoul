export const runtime = 'edge'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const supabase = createServerClient()
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

  const { memberId, newPassword } = await req.json()
  if (!memberId || !newPassword) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(memberId, {
    password: newPassword,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
