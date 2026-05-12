import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SHIPMENT_STATUS_TRANSITIONS } from '@/lib/utils'
import type { ShipmentStatus, UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set<ShipmentStatus>([
  'pendiente', 'en_curso', 'entregado', 'incidencia', 'devuelto', 'cancelado',
])

interface Ctx {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Solo hardware/admin pueden cambiar estado de envios libres.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()
  const role = (profile?.role as UserRole | undefined) ?? 'viewer'
  if (!(['hardware', 'admin'] as UserRole[]).includes(role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  let body: { status?: string; comment?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const newStatus = body.status as ShipmentStatus | undefined
  const comment = body.comment ?? null

  if (!newStatus || !VALID_STATUSES.has(newStatus)) {
    return NextResponse.json(
      { error: 'status invalido. Valores: pendiente, en_curso, entregado, incidencia, devuelto, cancelado.' },
      { status: 400 },
    )
  }

  // Cargar el shipment para conocer el estado actual.
  const admin = createAdminClient()
  const { data: shipment, error: loadError } = await admin
    .from('shipments')
    .select('id, status')
    .eq('id', id)
    .single()
  if (loadError || !shipment) {
    return NextResponse.json({ error: 'Envio no encontrado' }, { status: 404 })
  }

  const currentStatus = shipment.status as ShipmentStatus

  // Validar transicion permitida (consistente con el patron de orders).
  if (currentStatus === newStatus) {
    return NextResponse.json(
      { error: 'El envio ya esta en ese estado.' },
      { status: 422 },
    )
  }
  const allowed = SHIPMENT_STATUS_TRANSITIONS[currentStatus] ?? []
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Transicion no permitida: ${currentStatus} -> ${newStatus}` },
      { status: 422 },
    )
  }

  // Update estado del shipment.
  const { error: updateError } = await admin
    .from('shipments')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Auditoria en status_history (campos shipment_*).
  const { error: historyError } = await admin.from('status_history').insert({
    shipment_id: id,
    shipment_from_status: currentStatus,
    shipment_to_status: newStatus,
    changed_by: user.id,
    changed_at: new Date().toISOString(),
    comment,
  })
  if (historyError) {
    // Non-fatal: el update del estado ya se hizo. Loggear y seguir.
    console.error('[shipments/status] status_history insert error:', historyError.message)
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
