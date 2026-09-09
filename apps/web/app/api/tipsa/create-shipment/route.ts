import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseShippingAddress } from '@/lib/tipsa/address'
import { createShipment, fetchLabel, login } from '@/lib/tipsa/client'
import { buildPublicTrackingUrl, loadTipsaConfig } from '@/lib/tipsa/services'
import { upsertAddressFromOrder } from '@/lib/address-book/upsert'

export const runtime = 'nodejs'

interface CreateShipmentBody {
  order_id: string
  service_code: string
  packages?: number
  weight_kg?: number
  content?: string
  observations?: string
  /** Si true, envio con recogida de material al destinatario (boRetorno TIPSA). */
  return_shipment?: boolean
  /** Si true, autoriza entrega en sabado (boSabado TIPSA). */
  saturday_delivery?: boolean
}

export async function POST(request: NextRequest) {
  // 1. Auth
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // 2. Role check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()
  const role = profile?.role ?? 'viewer'
  if (role !== 'hardware' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Solo hardware o admin pueden crear envíos TIPSA' },
      { status: 403 },
    )
  }

  // 3. Body
  let body: CreateShipmentBody
  try {
    body = (await request.json()) as CreateShipmentBody
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  if (!body.order_id || !body.service_code) {
    return NextResponse.json(
      { error: 'order_id y service_code son obligatorios' },
      { status: 400 },
    )
  }
  const packages = Math.max(1, Math.floor(body.packages ?? 1))
  const weightKg = Math.max(0.1, Number(body.weight_kg ?? 1))
  const returnShipment = body.return_shipment === true
  const saturdayDelivery = body.saturday_delivery === true

  // 4. Load order (admin client para evitar problemas de RLS entre roles)
  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select(
      'id, operation_id, customer_name, venue_name, contact_email, phone, shipping_address, shipping_street, shipping_cp, shipping_city, shipping_province, status, tracking_number',
    )
    .eq('id', body.order_id)
    .single()
  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  // Idempotencia: si ya tiene tracking, no crear otro envio sin explicitarlo.
  if (order.tracking_number) {
    return NextResponse.json(
      {
        error: `Este pedido ya tiene envío creado (tracking: ${order.tracking_number}).`,
      },
      { status: 409 },
    )
  }

  // 5. Resolver direccion: si las 4 columnas estructuradas estan rellenas, usarlas
  //    directamente (camino nuevo). Si no, fallback al parser regex sobre shipping_address
  //    (pedidos legacy / Typeform).
  let recipientStreet: string
  let recipientCp: string
  let recipientCity: string

  if (order.shipping_cp && order.shipping_city && order.shipping_street) {
    recipientStreet = order.shipping_street
    recipientCp = order.shipping_cp
    recipientCity = order.shipping_city
  } else {
    const shipping = (order.shipping_address ?? '').trim()
    if (shipping.length < 10) {
      return NextResponse.json(
        {
          error:
            'La dirección de envío está vacía o es demasiado corta. Completa la dirección antes de crear el envío.',
        },
        { status: 422 },
      )
    }
    const parsed = parseShippingAddress(shipping)
    if (!parsed.cp) {
      return NextResponse.json(
        {
          error:
            'No se pudo extraer código postal de la dirección. Rellena los 4 campos estructurados (calle, CP, ciudad, provincia) en la ficha del pedido.',
        },
        { status: 422 },
      )
    }
    recipientStreet = parsed.street
    recipientCp = parsed.cp
    recipientCity = parsed.city
  }

  // 6. Config TIPSA
  let config
  try {
    config = loadTipsaConfig()
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    )
  }

  try {
    // 7. Login (obtiene trackingBaseUrl para la URL publica)
    const loginInfo = await login(config)

    // 8. Crear envio
    const shipResult = await createShipment(config, {
      serviceCode: body.service_code,
      packages,
      weightKg,
      content: body.content ?? 'Productos hardware',
      observations: body.observations,
      reference: order.operation_id,
      returnShipment,
      saturdayDelivery,
      recipient: {
        // En la etiqueta TIPSA:
        //   - strNomDes (campo "name")           -> linea "DES:" del bloque destinatario
        //   - strPersContacto (campo "contactPerson") -> linea "P.C." (Persona de Contacto)
        // Para que TIPSA identifique el LOCAL al repartir (ej. "Churreria
        // Veracruz") priorizamos venue_name en el name; si no hay venue
        // (no es un local con marca), fallback al customer_name. El
        // customer_name siempre va como "P.C." porque es la persona a
        // quien preguntar dentro del local cuando el repartidor entra.
        name: order.venue_name || order.customer_name || 'Destinatario',
        address: recipientStreet,
        city: recipientCity,
        cp: recipientCp,
        phone: order.phone ?? '',
        email: order.contact_email ?? undefined,
        country: 'ES',
        contactPerson: order.customer_name ?? undefined,
      },
    })

    const publicUrl = buildPublicTrackingUrl(
      loginInfo.trackingBaseUrl,
      shipResult.guid,
      new Date(),
    )

    // 9. Descargar etiqueta PDF
    const label = await fetchLabel(config, shipResult.albaran, 'pdf')

    // 10. Subir etiqueta a Storage (bucket shipping-labels)
    const labelPath = `order_${order.id}/${shipResult.albaran}.pdf`
    const pdfBuffer = Buffer.from(label.base64, 'base64')

    const { error: uploadError } = await admin.storage
      .from('shipping-labels')
      .upload(labelPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (uploadError) {
      // Si falla Storage, seguimos: guardamos el envio sin URL local.
      console.error('[tipsa] error subiendo etiqueta:', uploadError.message)
    }

    const { data: signed } = await admin.storage
      .from('shipping-labels')
      .createSignedUrl(labelPath, 60 * 60 * 24 * 7) // 7 dias

    const shippingLabelUrl = signed?.signedUrl ?? null

    // 11. Update orders (admin client = bypass RLS)
    const now = new Date().toISOString()
    const { error: updateError } = await admin
      .from('orders')
      .update({
        carrier: 'tipsa',
        carrier_service_code: body.service_code,
        carrier_guid: shipResult.guid,
        tracking_number: shipResult.albaran,
        tracking_public_url: publicUrl,
        shipping_label_url: shippingLabelUrl,
        shipping_weight_kg: weightKg,
        shipping_packages: packages,
        shipping_content: body.content ?? 'Productos hardware',
        shipping_observations: body.observations ?? null,
        shipping_return: returnShipment,
        shipping_saturday: saturdayDelivery,
        shipped: true,
        shipped_at: now,
        tracking_last_status: '0',
        tracking_last_checked_at: now,
      })
      .eq('id', order.id)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 12. Evento inicial, para que la ficha no salga vacia hasta el primer
    // barrido del cron. Codigo 0 = DOCUMENTADO, que es exactamente lo que
    // TIPSA emite al dar de alta el envio (y lo que muestra su web como
    // "PENDIENTE DE ENTREGAR A TIPSA").
    //
    // Antes poniamos codigo 1 con etiqueta "Alta": en el catalogo oficial el 1
    // es TRANSITO, asi que estabamos marcando como "en camino" un paquete que
    // ni siquiera se habia recogido.
    await admin.from('shipping_events').insert({
      order_id: order.id,
      carrier: 'tipsa',
      event_code: '0',
      event_label: 'Documentado',
      event_date: now,
      raw_payload: { albaran: shipResult.albaran, guid: shipResult.guid },
    })

    // 12.5 A~adir destinatario al address_book (silencia errores).
    void upsertAddressFromOrder(admin, {
      name: order.customer_name || order.venue_name || 'Destinatario',
      address: recipientStreet,
      cp: recipientCp,
      city: recipientCity,
      venue_name: order.venue_name ?? null,
      province: order.shipping_province ?? null,
      phone: order.phone ?? null,
      email: order.contact_email ?? null,
      contact_person: order.customer_name ?? null,
      created_by: user.id,
    })

    // 13. Notificar Slack (fire-and-forget, no bloquea)
    fireAndForgetSlack({
      event: 'shipment_created',
      order_id: order.id,
      operation_id: order.operation_id,
      customer_name: order.customer_name,
      venue_name: order.venue_name,
      tracking_number: shipResult.albaran,
    })

    return NextResponse.json({
      ok: true,
      albaran: shipResult.albaran,
      guid: shipResult.guid,
      label_url: shippingLabelUrl,
      public_tracking_url: publicUrl,
    })
  } catch (err) {
    const error = err as Error & { rawResponse?: string; httpStatus?: number }
    console.error('[tipsa] createShipment failed:', error.message)
    if (error.rawResponse) {
      console.error('[tipsa] raw response:\n', error.rawResponse)
    }
    return NextResponse.json(
      {
        error: `TIPSA: ${error.message}`,
        detail: error.rawResponse?.slice(0, 2000),
      },
      { status: 502 },
    )
  }
}

// =========================================================
// Helpers
// =========================================================

function fireAndForgetSlack(payload: Record<string, unknown>): void {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-slack`
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    }).catch((e) => console.error('[tipsa] slack notify error:', e))
  } catch (e) {
    console.error('[tipsa] slack build error:', e)
  }
}
