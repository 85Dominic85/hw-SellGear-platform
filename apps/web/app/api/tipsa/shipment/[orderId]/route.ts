import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * DELETE /api/tipsa/shipment/[orderId]
 *
 * Borra de NUESTRA BD los datos de envio asociados a un pedido:
 *   - Campos tracking_*, carrier_*, shipped_*, shipping_* en orders.
 *   - Filas en shipping_events.
 *   - Etiqueta PDF en Storage (bucket shipping-labels).
 *
 * NO borra el envio en TIPSA — si era real, alli sigue existiendo.
 * Util para: envios de prueba (sandbox) que ensucian la BD, o errores humanos.
 * Solo admin puede invocarlo.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params

  // 1. Auth + rol
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
  if (profile?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Solo admin puede borrar envíos' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()

  // 2. Cargar el pedido para tener el tracking_number (para borrar el PDF correspondiente)
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, tracking_number, shipping_label_url')
    .eq('id', orderId)
    .single()
  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const hadShipment = Boolean(order.tracking_number)

  // 3. Borrar etiqueta del bucket (si existe)
  if (order.tracking_number) {
    const labelPath = `order_${order.id}/${order.tracking_number}.pdf`
    const { error: storageError } = await admin.storage
      .from('shipping-labels')
      .remove([labelPath])
    if (storageError) {
      // No fatal: igual el PDF nunca se subio, o ya estaba borrado
      console.warn('[tipsa] storage remove warning:', storageError.message, 'path:', labelPath)
    }
  }

  // 4. Borrar shipping_events
  const { error: eventsError } = await admin
    .from('shipping_events')
    .delete()
    .eq('order_id', order.id)
  if (eventsError) {
    return NextResponse.json(
      { error: 'Error borrando eventos', detail: eventsError.message },
      { status: 500 },
    )
  }

  // 5. Reset de campos en orders
  const { error: updateError } = await admin
    .from('orders')
    .update({
      carrier: null,
      carrier_service_code: null,
      carrier_guid: null,
      tracking_number: null,
      tracking_public_url: null,
      tracking_last_status: null,
      tracking_last_checked_at: null,
      shipping_label_url: null,
      shipped_at: null,
      shipped: false,
      shipping_weight_kg: null,
      shipping_packages: null,
      shipping_content: null,
      shipping_observations: null,
    })
    .eq('id', order.id)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, had_shipment: hadShipment })
}
