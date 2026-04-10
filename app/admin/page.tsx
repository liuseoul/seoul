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

  const [{ data: projects }, { data: members }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, client, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false }),
  ])

  return (
    <AdminDashboard
      profile={profile}
      projects={projects || []}
      members={members || []}
    />
  )
}
