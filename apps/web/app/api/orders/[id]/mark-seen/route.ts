import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Solo cambiar si el estado actual es 'nuevo'
  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!order || order.status !== 'nuevo') {
    return NextResponse.json({ ok: true, changed: false })
  }

  // Cambiar a pendiente
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'pendiente', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Registrar en historial
  await supabase.from('status_history').insert({
    order_id: id,
    from_status: 'nuevo',
    to_status: 'pendiente',
    changed_by: user.id,
    comment: 'Marcado como pendiente al visualizar la ficha',
  })

  return NextResponse.json({ ok: true, changed: true })
}
