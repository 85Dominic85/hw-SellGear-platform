import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/components/layout/SidebarNav'

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado', status: 401 }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, role')
    .eq('id', user.id)
    .single()

  if (!isAdminUser(profile?.email ?? user.email, profile?.role)) {
    return { error: 'Sin permisos de administrador', status: 403 }
  }

  return { supabase, user }
}

export async function GET() {
  const auth = await verifyAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { supabase } = auth

  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users })
}
