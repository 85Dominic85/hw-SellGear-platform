import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Get all orders with status 'nuevo'
  const { data: nuevoOrders } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'nuevo')

  if (!nuevoOrders || nuevoOrders.length === 0) {
    return NextResponse.json({ success: true, cleared: 0 })
  }

  const ids = nuevoOrders.map((o) => o.id)

  // Bulk transition nuevo → pendiente
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'pendiente', updated_at: new Date().toISOString() })
    .in('id', ids)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Insert status_history entries for traceability
  const historyEntries = ids.map((orderId) => ({
    order_id: orderId,
    from_status: 'nuevo',
    to_status: 'pendiente',
    changed_by: user.id,
    comment: 'Marcado como pendiente (limpiar notificaciones)',
  }))

  await supabase.from('status_history').insert(historyEntries)

  return NextResponse.json({ success: true, cleared: ids.length })
}
