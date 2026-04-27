import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canCreateOrder } from '@/lib/auth'
import type { UserRole } from '@/types/database'

export default async function NewOrderLayout({
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
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as UserRole | undefined
  if (!canCreateOrder(role)) {
    redirect('/orders')
  }

  return <>{children}</>
}
