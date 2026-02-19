import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // 2. Verify order exists
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, operation_id')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  // 3. Call sync-to-sheets Edge Function
  try {
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-to-sheets`
    const res = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ order_id: id }),
    })

    if (!res.ok) {
      let errorText = `HTTP ${res.status}`
      try {
        const errorData = await res.json()
        errorText = errorData.error ?? errorText
      } catch {
        // ignore parse errors
      }
      return NextResponse.json(
        { error: `Error al sincronizar con Google Sheets: ${errorText}` },
        { status: 502 }
      )
    }

    const result = await res.json()
    return NextResponse.json({
      ok: true,
      message: result.message ?? 'Sincronizado correctamente con Google Sheets',
      data: result,
    })
  } catch (err) {
    console.error('Error calling sync-to-sheets edge function:', err)
    return NextResponse.json(
      { error: 'Error de conexión con el servicio de sincronización' },
      { status: 502 }
    )
  }
}
