import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth'
import type { UserRole } from '@/types/database'

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

const EDITOR_ROLES: UserRole[] = ['admin', 'manager', 'hardware']

async function verifyEditor() {
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

  const role = profile?.role as UserRole | undefined
  const isEditor =
    isAdminUser(profile?.email ?? user.email, role) ||
    (role && EDITOR_ROLES.includes(role))

  if (!isEditor) {
    return { error: 'Sin permisos de edicion', status: 403 }
  }

  return { supabase, user, role }
}

const EDITABLE_FIELDS = new Set([
  'customer_name',
  'venue_name',
  'purchase_type',
  'amount',
  'contact_email',
  'phone',
  'source_department',
  'requester_name',
  'requester_email',
  'bank_receipt_url',
  'ae_ref',
  'hubspot_ref',
  'invoice_ref',
  'shipping_address',
  'notes',
  'tracking_number',
  'shipping_label_url',
])

const VALID_PURCHASE_TYPES = new Set([
  'kit_digital',
  'hardware_one_off',
  'hardware_financiacion',
  'transferencias_saas',
  'otro',
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyEditor()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalido' }, { status: 400 })
  }

  // Expect exactly one field
  const entries = Object.entries(body)
  if (entries.length !== 1) {
    return NextResponse.json({ error: 'Enviar exactamente un campo' }, { status: 400 })
  }

  const [field, rawValue] = entries[0]

  if (!EDITABLE_FIELDS.has(field)) {
    return NextResponse.json({ error: `Campo '${field}' no editable` }, { status: 400 })
  }

  // Validate value by field
  let value: string | number | null = rawValue as string | number | null

  if (field === 'customer_name') {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return NextResponse.json({ error: 'customer_name no puede estar vacio' }, { status: 400 })
    }
    value = (value as string).trim()
  } else if (field === 'purchase_type') {
    if (value !== null && !VALID_PURCHASE_TYPES.has(value as string)) {
      return NextResponse.json({ error: 'purchase_type invalido' }, { status: 400 })
    }
  } else if (field === 'amount') {
    if (value !== null) {
      const num = Number(value)
      if (isNaN(num)) {
        return NextResponse.json({ error: 'amount debe ser un numero' }, { status: 400 })
      }
      value = num
    }
  } else if (field === 'contact_email' || field === 'requester_email') {
    if (value !== null && typeof value === 'string' && value.trim()) {
      // Basic email validation
      if (!value.includes('@')) {
        return NextResponse.json({ error: `${field} debe ser un email valido` }, { status: 400 })
      }
      value = value.trim()
    } else {
      value = null
    }
  } else if (field === 'bank_receipt_url' || field === 'shipping_label_url') {
    if (value !== null && typeof value === 'string' && value.trim()) {
      try {
        new URL(value)
      } catch {
        return NextResponse.json({ error: `${field} debe ser una URL valida` }, { status: 400 })
      }
      value = value.trim()
    } else {
      value = null
    }
  } else {
    // String fields: trim or null
    if (typeof value === 'string') {
      value = value.trim() || null
    }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('orders')
    .update({ [field]: value })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, field, value })
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
  const { supabase } = auth

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
