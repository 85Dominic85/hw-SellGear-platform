import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchTracking } from '@/lib/tipsa/client'
import { loadTipsaConfig, resolveOfficialStatus } from '@/lib/tipsa/services'

export const runtime = 'nodejs'

/**
 * POST /api/tipsa/refresh-tracking
 * Body: { order_id: string }
 *
 * Consulta TIPSA ConsEnvEstados para el albaran del pedido, upsertea los eventos
 * en shipping_events y actualiza tracking_last_status / tracking_last_checked_at.
 */
export async function POST(request: NextRequest) {
  // Auth
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
  const role = profile?.role ?? 'viewer'
  if (role === 'viewer') {
    return NextResponse.json(
      { error: 'Sin permisos para refrescar seguimiento' },
      { status: 403 },
    )
  }

  let body: { order_id?: string }
  try {
    body = (await request.json()) as { order_id?: string }
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  if (!body.order_id) {
    return NextResponse.json({ error: 'order_id obligatorio' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select('id, operation_id, tracking_number, carrier, status')
    .eq('id', body.order_id)
    .single()
  if (error || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  if (!order.tracking_number) {
    return NextResponse.json(
      { error: 'El pedido no tiene tracking_number asignado' },
      { status: 422 },
    )
  }

  try {
    const config = loadTipsaConfig()
    const tracking = await fetchTracking(config, order.tracking_number)

    let inserted = 0
    for (const ev of tracking.events) {
      const { error: insertError } = await admin.from('shipping_events').insert({
        order_id: order.id,
        carrier: order.carrier ?? 'tipsa',
        event_code: ev.code,
        event_label: ev.label,
        event_date: ev.date,
        raw_payload: ev.rawAttributes,
      })
      // Ignoramos violaciones de unique (evento ya registrado)
      if (insertError && insertError.code !== '23505') {
        console.error('[tipsa] insert shipping_event error:', insertError.message)
      }
      if (!insertError) inserted++
    }

    // Estado "oficial": ignora codigo 3 (Incidencia) cuando viene tras codigo 2 (Entregado).
    // Asumimos que tracking.events viene ordenado cronologicamente ascendente.
    const officialEvent = resolveOfficialStatus(tracking.events, (e) => e.code)
    const now = new Date().toISOString()

    // NO tocamos orders.delivered_at. Esa columna es del flujo del pedido: la
    // pone el trigger orders_auto_delivered_at cuando pasa a 'completado' y de
    // ahi comen las metricas de SLA. Escribir aqui la fecha de TIPSA era pisar
    // el dato de otro dueño. La fecha de entrega del transportista se deriva de
    // shipping_events cuando hace falta.
    const updates: Record<string, unknown> = {
      tracking_last_status: officialEvent?.code ?? null,
      tracking_last_checked_at: now,
    }

    await admin.from('orders').update(updates).eq('id', order.id)

    return NextResponse.json({
      ok: true,
      events_count: tracking.events.length,
      inserted,
      last_status: officialEvent?.code ?? null,
    })
  } catch (err) {
    const error = err as Error
    return NextResponse.json(
      { error: 'Error consultando TIPSA', detail: error.message },
      { status: 502 },
    )
  }
}
