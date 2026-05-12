import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchTracking } from '@/lib/tipsa/client'
import { isTerminalEvent, loadTipsaConfig } from '@/lib/tipsa/services'

export const runtime = 'nodejs'

interface Ctx {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: Ctx) {
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
  const role = profile?.role ?? 'viewer'
  if (role === 'viewer') {
    return NextResponse.json(
      { error: 'Sin permisos para refrescar seguimiento' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()
  const { data: shipment, error } = await admin
    .from('shipments')
    .select('id, shipment_id, tracking_number, status')
    .eq('id', id)
    .single()
  if (error || !shipment) {
    return NextResponse.json({ error: 'Envio no encontrado' }, { status: 404 })
  }
  if (!shipment.tracking_number) {
    return NextResponse.json(
      { error: 'El envio no tiene tracking_number asignado' },
      { status: 422 },
    )
  }

  try {
    const config = loadTipsaConfig()
    const tracking = await fetchTracking(config, shipment.tracking_number)

    let inserted = 0
    for (const ev of tracking.events) {
      const { error: insertError } = await admin.from('shipping_events').insert({
        shipment_id: shipment.id,
        carrier: 'tipsa',
        event_code: ev.code,
        event_label: ev.label,
        event_date: ev.date,
        raw_payload: ev.rawAttributes,
      })
      if (insertError && insertError.code !== '23505') {
        console.error('[shipments] insert event error:', insertError.message)
      }
      if (!insertError) inserted++
    }

    const lastEvent = tracking.events[tracking.events.length - 1]
    const now = new Date().toISOString()

    const updates: Record<string, unknown> = {
      tracking_last_status: lastEvent?.code ?? null,
      tracking_last_checked_at: now,
    }
    if (lastEvent && isTerminalEvent(lastEvent.code)) {
      updates.delivered_at = lastEvent.date
    }

    // Auto-sync del estado manual SOLO si sigue en 'pendiente' (no tocado por usuario):
    //   - TIPSA 2 (Entregado) -> 'entregado'
    //   - TIPSA 6 (Devuelto origen) -> 'devuelto'
    //   - TIPSA 3 (Incidencia) -> 'incidencia'
    //   - TIPSA 4 (En transito) o 5 (En reparto) -> 'en_curso'
    // Si el usuario ya cambio el estado manualmente, NO se pisa.
    const currentStatus = shipment.status as string | undefined
    if (currentStatus === 'pendiente' && lastEvent) {
      const map: Record<string, string> = {
        '2': 'entregado',
        '3': 'incidencia',
        '4': 'en_curso',
        '5': 'en_curso',
        '6': 'devuelto',
      }
      const newManualStatus = map[lastEvent.code]
      if (newManualStatus && newManualStatus !== currentStatus) {
        updates.status = newManualStatus
        // Auditoria del cambio automatico.
        await admin.from('status_history').insert({
          shipment_id: shipment.id,
          shipment_from_status: 'pendiente',
          shipment_to_status: newManualStatus,
          changed_by: null,
          changed_at: now,
          comment: `Auto-sync desde TIPSA evento ${lastEvent.code}`,
        })
      }
    }

    await admin.from('shipments').update(updates).eq('id', shipment.id)

    return NextResponse.json({
      ok: true,
      events_count: tracking.events.length,
      inserted,
      last_status: lastEvent?.code ?? null,
    })
  } catch (err) {
    const error = err as Error
    return NextResponse.json(
      { error: 'Error consultando TIPSA', detail: error.message },
      { status: 502 },
    )
  }
}
