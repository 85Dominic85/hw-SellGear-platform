import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const { supabase } = auth

  // Obtener el email del usuario
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('id', id)
    .single()

  if (profileError || !profile?.email) {
    return NextResponse.json(
      { error: 'No se pudo encontrar el email del usuario' },
      { status: 404 }
    )
  }

  // Enviar email de reset via Supabase Auth
  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/callback`,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Email de recuperacion enviado a ${profile.email}`,
  })
}
