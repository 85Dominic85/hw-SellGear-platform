import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/products — catálogo activo para el wizard y el modal de la ficha.
 *
 * Orden: SOLO por sort_order. Antes ordenaba primero por `category`, que es
 * TEXT y se ordena alfabéticamente (accessory, custom, kds, network, pack,
 * printer, tpv), así que los accesorios salían antes que los packs y el TPV
 * al final. ProductCatalog lo tapaba reordenando en cliente, pero
 * AddOrderItemModal no y mostraba el orden roto.
 *
 * Como el sort_order va en bandas de 100 por pestaña (Packs 100, TPV 200,
 * KDS 300, Impresoras 400, Periféricos 500, Red 600, Servicios 700,
 * Canarias 800), ordenar solo por él ya produce el orden comercial curado.
 * `code` desempata para que la respuesta sea determinista.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ products: data ?? [] })
}
