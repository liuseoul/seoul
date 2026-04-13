export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProjectList from '@/components/ProjectList'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single()

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, name, client, description, status, created_at, updated_at,
      agreement_party, service_fee_currency, service_fee_amount, collaboration_parties,
      work_records(id, created_at, deleted, profiles!work_records_author_id_fkey(name)),
      time_logs(id, started_at, finished_at, deleted, profiles!time_logs_member_id_fkey(name))
    `)
    .order('created_at', { ascending: false })

  return (
    <ProjectList
      projects={projects || []}
      profile={profile}
    />
  )
}
