import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/components/layout/SidebarNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, role')
    .eq('id', user.id)
    .single()

  const email = profile?.email ?? user.email
  const role = profile?.role

  if (!isAdminUser(email, role)) {
    redirect('/orders')
  }

  return <>{children}</>
}
