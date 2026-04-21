import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/tipsa/label/[orderId]
 * Devuelve una signed URL corta (5 min) a la etiqueta PDF almacenada en
 * el bucket shipping-labels. Usado por el componente ShippingLabelViewer.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select('id, tracking_number, shipping_label_url')
    .eq('id', orderId)
    .single()
  if (error || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  if (!order.tracking_number) {
    return NextResponse.json({ error: 'Pedido sin envío' }, { status: 404 })
  }

  const path = `order_${order.id}/${order.tracking_number}.pdf`
  const { data: signed, error: signError } = await admin.storage
    .from('shipping-labels')
    .createSignedUrl(path, 300) // 5 min

  if (signError || !signed) {
    // Fallback: si hay shipping_label_url guardada y todavia valida, devolverla
    if (order.shipping_label_url) {
      return NextResponse.json({ url: order.shipping_label_url })
    }
    return NextResponse.json(
      { error: 'No se pudo generar URL de etiqueta', detail: signError?.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ url: signed.signedUrl })
}
