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
      work_records(count),
      time_logs(started_at, finished_at)
    `)
    .order('created_at', { ascending: false })

  return (
    <ProjectList
      projects={projects || []}
      profile={profile}
    />
  )
}
