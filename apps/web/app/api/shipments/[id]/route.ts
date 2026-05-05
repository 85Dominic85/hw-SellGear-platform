import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canDeleteFreeShipment } from '@/lib/auth'
import type { Shipment, UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

const SELECT =
  'id, shipment_id, created_at, updated_at, created_by, sender_name, sender_address, sender_cp, sender_city, sender_phone, recipient_name, recipient_address, recipient_cp, recipient_city, recipient_phone, recipient_email, recipient_contact_person, service_code, packages, weight_kg, content, observations, return_shipment, saturday_delivery, reference, albaran, tracking_number, tracking_public_url, carrier_guid, tracking_last_status, tracking_last_checked_at, shipped_at, delivered_at, shipping_label_url, notes'

interface Ctx {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('shipments')
    .select(SELECT)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Envio no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ shipment: data as Shipment })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canDeleteFreeShipment(profile?.role as UserRole | undefined)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()

  // 1. Cargar shipment para conocer albaran (path de la etiqueta).
  const { data: shipment } = await admin
    .from('shipments')
    .select('id, albaran')
    .eq('id', id)
    .single()

  if (!shipment) {
    return NextResponse.json({ error: 'Envio no encontrado' }, { status: 404 })
  }

  // 2. Borrar etiqueta del bucket si existe.
  if (shipment.albaran) {
    const path = `shipment_${shipment.id}/${shipment.albaran}.pdf`
    const { error: removeError } = await admin.storage
      .from('shipping-labels')
      .remove([path])
    if (removeError) {
      console.warn('[shipments] remove label error (non-fatal):', removeError.message)
    }
  }

  // 3. Borrar shipping_events asociados (CASCADE deberia hacerlo, pero
  //    explicito por seguridad en caso de constraint distinta).
  await admin.from('shipping_events').delete().eq('shipment_id', shipment.id)

  // 4. Borrar shipment.
  const { error: deleteError } = await admin
    .from('shipments')
    .delete()
    .eq('id', shipment.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
