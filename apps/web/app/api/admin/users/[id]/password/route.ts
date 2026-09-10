import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth'

/** El mismo mínimo que exige la creación de usuarios (y el de Supabase Auth). */
const MIN_PASSWORD_LENGTH = 6

/**
 * bcrypt trunca a 72 bytes y GoTrue rechaza lo que pase de ahi con un mensaje
 * opaco. Lo cortamos aquí para poder explicarlo. Son bytes, no caracteres: una
 * ñ o una vocal acentuada cuentan dos.
 */
const MAX_PASSWORD_BYTES = 72

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

/**
 * Fija directamente la contraseña de un usuario. Es la vía para desbloquear a
 * alguien sin depender del email de recuperación.
 *
 * No revoca las sesiones que el usuario ya tenga abiertas: auth.admin.signOut()
 * necesita el JWT del propio usuario, que aquí no tenemos. Lo que se consigue es
 * que la contraseña vieja deje de servir para entrar; una sesión ya iniciada
 * sigue viva hasta que caduque su refresh token.
 */
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
  const { password } = body

  if (typeof password !== 'string' || password.length === 0) {
    return NextResponse.json(
      { error: 'La contraseña es obligatoria' },
      { status: 400 }
    )
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
      { status: 400 }
    )
  }

  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return NextResponse.json(
      { error: `La contraseña no puede pasar de ${MAX_PASSWORD_BYTES} bytes (la ñ y los acentos cuentan dos)` },
      { status: 400 }
    )
  }

  // El destinatario tiene que ser un usuario de la app. Da un 404 claro y evita
  // tocar cuentas de auth.users que no tengan perfil aquí.
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('id', id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.updateUserById(id, { password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Contraseña actualizada para ${profile.email ?? 'el usuario'}`,
  })
}
