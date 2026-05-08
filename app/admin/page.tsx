export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/projects')

  const { data: members } = await supabase
    .from('profiles')
    .select('id, name, email, role, created_at')
    .order('created_at', { ascending: false })

  return (
    <AdminDashboard
      profile={profile}
      members={members || []}
    />
  )
}
