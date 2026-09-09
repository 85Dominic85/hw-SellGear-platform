import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchTracking } from '@/lib/tipsa/client'
import { isTerminalEvent, loadTipsaConfig, resolveOfficialStatus } from '@/lib/tipsa/services'

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

    // Estado oficial, no "el ultimo evento": TIPSA sigue emitiendo lecturas
    // despues de entregar (vimos un 14 tras un 3), y sin esta regla una de esas
    // degradaba un envio ya entregado.
    const officialEvent = resolveOfficialStatus(tracking.events, (e) => e.code)
    const now = new Date().toISOString()

    const updates: Record<string, unknown> = {
      tracking_last_status: officialEvent?.code ?? null,
      tracking_last_checked_at: now,
    }
    // Aqui si escribimos delivered_at: en shipments esa columna es de TIPSA
    // (no tiene el trigger que si gobierna orders.delivered_at).
    if (officialEvent && isTerminalEvent(officialEvent.code)) {
      updates.delivered_at = officialEvent.date
    }

    // Auto-sync del estado manual SOLO si sigue en 'pendiente' (no tocado por
    // usuario). Catalogo oficial de codigos (ver TIPSA_EVENT_LABELS):
    //   3 ENTREGADO -> 'entregado'
    //   5 DEVUELTO  -> 'devuelto'
    //   4 INCIDENCIA-> 'incidencia'
    //   1 TRANSITO / 2 REPARTO / 7 RECANALIZADO / 14 DISPONIBLE -> 'en_curso'
    //   0 DOCUMENTADO no mueve nada: aun no lo ha recogido el transportista.
    //
    // OJO: hasta 2026-09-09 este mapa usaba el catalogo equivocado y marcaba
    // 'entregado' con el codigo 2, que es REPARTO — o sea, daba por entregado un
    // paquete que seguia en la furgoneta, y encima lo dejaba escrito en
    // status_history. Lo que quedo mal se revisa a mano (ver migracion
    // 20260909000004, apartado 3b).
    const currentStatus = shipment.status as string | undefined
    if (currentStatus === 'pendiente' && officialEvent) {
      const map: Record<string, string> = {
        '1': 'en_curso',
        '2': 'en_curso',
        '3': 'entregado',
        '4': 'incidencia',
        '5': 'devuelto',
        '7': 'en_curso',
        '14': 'en_curso',
      }
      const newManualStatus = map[officialEvent.code]
      if (newManualStatus && newManualStatus !== currentStatus) {
        updates.status = newManualStatus
        // Auditoria del cambio automatico.
        await admin.from('status_history').insert({
          shipment_id: shipment.id,
          shipment_from_status: 'pendiente',
          shipment_to_status: newManualStatus,
          changed_by: null,
          changed_at: now,
          comment: `Auto-sync desde TIPSA evento ${officialEvent.code}`,
        })
      }
    }

    await admin.from('shipments').update(updates).eq('id', shipment.id)

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
