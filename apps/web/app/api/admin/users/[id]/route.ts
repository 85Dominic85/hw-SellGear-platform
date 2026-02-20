import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/components/layout/SidebarNav'
import type { UserRole } from '@/types/database'

const VALID_ROLES: UserRole[] = ['creator', 'hardware', 'manager', 'admin']

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const { supabase } = auth
  const body = await request.json()

  const updates: Record<string, unknown> = {}

  if (body.full_name !== undefined) updates.full_name = body.full_name
  if (body.department !== undefined) updates.department = body.department
  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Rol no valido' }, { status: 400 })
    }
    updates.role = body.role
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ user: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const { supabase, user } = auth

  // No permitir eliminarse a si mismo
  if (id === user.id) {
    return NextResponse.json(
      { error: 'No puedes eliminar tu propia cuenta' },
      { status: 400 }
    )
  }

  // Eliminar perfil (cascadea desde auth.users si se usa service role,
  // pero desde cliente normal solo eliminamos el perfil)
  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
