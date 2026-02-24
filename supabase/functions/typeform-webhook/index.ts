// =============================================================
// Edge Function: typeform-webhook
// Recibe el payload de Typeform, valida la firma HMAC,
// normaliza los campos y crea la order + order_items en Supabase.
// También dispara sync-to-sheets y notify-slack de forma async.
// =============================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// -----------------------------------------------
// Tipos Typeform
// -----------------------------------------------

interface TypeformAnswer {
  field: { id: string; ref: string; type: string }
  type: string
  text?: string
  email?: string
  phone_number?: string
  number?: number
  choice?: { label: string }
  choices?: { labels: string[] }
  file_url?: string
  date?: string
}

interface TypeformPayload {
  event_id: string
  event_type: string
  form_response: {
    form_id: string
    token: string
    submitted_at: string
    answers: TypeformAnswer[]
    hidden?: Record<string, string>
  }
}

// -----------------------------------------------
// Mapeo de fields Typeform → columnas Supabase
// Ajusta los ref según los IDs reales del form
// -----------------------------------------------

const FIELD_MAP: Record<string, string> = {
  customer_name:    'customer_name',
  venue_name:       'venue_name',
  contact_email:    'contact_email',
  phone:            'phone',
  purchase_type:    'purchase_type',
  amount:           'amount',
  shipping_address: 'shipping_address',
  ae_ref:           'ae_ref',
  hubspot_ref:      'hubspot_ref',
  notes:            'notes',
  product_name:     'product_name',
  product_qty:      'product_qty',
}

// -----------------------------------------------
// Utilidades
// -----------------------------------------------

function getAnswerValue(answer: TypeformAnswer): string | number | null {
  switch (answer.type) {
    case 'text':         return answer.text ?? null
    case 'email':        return answer.email ?? null
    case 'phone_number': return answer.phone_number ?? null
    case 'number':       return answer.number ?? null
    case 'short_text':   return answer.text ?? null
    case 'long_text':    return answer.text ?? null
    case 'choice':       return answer.choice?.label ?? null
    case 'file_url':     return answer.file_url ?? null
    default:             return null
  }
}

function normalizeString(s: string | number | null): string | null {
  if (s == null) return null
  return String(s).trim() || null
}

function normalizePurchaseType(raw: string | null): string | null {
  if (!raw) return null
  const map: Record<string, string> = {
    'kit digital':           'kit_digital',
    'kit_digital':           'kit_digital',
    'hardware one off':      'hardware_one_off',
    'hardware_one_off':      'hardware_one_off',
    'hardware financiación': 'hardware_financiacion',
    'hardware financiacion': 'hardware_financiacion',
    'hardware_financiacion': 'hardware_financiacion',
    'transferencias saas':   'transferencias_saas',
    'transferencias_saas':   'transferencias_saas',
  }
  return map[raw.toLowerCase()] ?? 'otro'
}

// -----------------------------------------------
// Verificar firma HMAC (Typeform usa SHA-256)
// -----------------------------------------------

async function verifyTypeformSignature(
  body: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const computed = 'sha256=' + btoa(String.fromCharCode(...new Uint8Array(sig)))
  return computed === signatureHeader
}

// -----------------------------------------------
// Handler principal
// -----------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const bodyText = await req.text()

  // Verificar firma si hay secret configurado
  const webhookSecret = Deno.env.get('TYPEFORM_WEBHOOK_SECRET')
  if (webhookSecret) {
    const signature = req.headers.get('Typeform-Signature')
    const valid = await verifyTypeformSignature(bodyText, signature, webhookSecret)
    if (!valid) {
      console.error('Invalid Typeform signature')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let payload: TypeformPayload
  try {
    payload = JSON.parse(bodyText)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (payload.event_type !== 'form_response') {
    // Ignorar otros eventos (ej: test pings)
    return new Response('OK', { status: 200 })
  }

  const { form_response } = payload
  const answers = form_response.answers ?? []
  const responseToken = form_response.token

  // Inicializar cliente Supabase con service role (bypass RLS)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Deduplicar: si ya existe esta respuesta de Typeform, ignorar
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('typeform_response_id', responseToken)
    .maybeSingle()

  if (existing) {
    console.log(`Duplicate Typeform response: ${responseToken}`)
    return new Response('Already processed', { status: 200 })
  }

  // Mapear respuestas
  const mapped: Record<string, string | number | null> = {}
  for (const answer of answers) {
    const ref = answer.field?.ref
    if (ref && FIELD_MAP[ref]) {
      mapped[FIELD_MAP[ref]] = getAnswerValue(answer)
    }
  }

  // Validar campo obligatorio
  const customerName = normalizeString(mapped['customer_name'] as string)
  if (!customerName) {
    console.error('Missing required field: customer_name')
    return new Response(
      JSON.stringify({ error: 'customer_name is required' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Determinar pestaña del sheet según tipo de compra
  const purchaseTypeRaw = normalizeString(mapped['purchase_type'] as string)
  const purchaseType = normalizePurchaseType(purchaseTypeRaw)
  const sheetTabMap: Record<string, string> = {
    kit_digital:           'KIT Digital',
    hardware_one_off:      'Hardware One Off',
    hardware_financiacion: 'Hardware Financiación',
    transferencias_saas:   'Transferencias SaaS',
    otro:                  'Pedidos',
  }
  const sheetTab = purchaseType ? sheetTabMap[purchaseType] ?? 'Pedidos' : 'Pedidos'

  // Crear order
  const orderData = {
    customer_name:       customerName,
    venue_name:          normalizeString(mapped['venue_name'] as string),
    contact_email:       normalizeString(mapped['contact_email'] as string),
    phone:               normalizeString(mapped['phone'] as string),
    purchase_type:       purchaseType,
    amount:              mapped['amount'] ? Number(mapped['amount']) : null,
    shipping_address:    normalizeString(mapped['shipping_address'] as string),
    ae_ref:              normalizeString(mapped['ae_ref'] as string),
    hubspot_ref:         normalizeString(mapped['hubspot_ref'] as string),
    notes:               normalizeString(mapped['notes'] as string),
    source:              'typeform',
    sheet_tab:           sheetTab,
    typeform_response_id: responseToken,
    status:              'nuevo',
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single()

  if (orderError || !order) {
    console.error('Error creating order:', orderError)
    return new Response(
      JSON.stringify({ error: 'Failed to create order', detail: orderError?.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  console.log(`Order created: ${order.operation_id}`)

  // Crear order_item si viene product_name
  const productName = normalizeString(mapped['product_name'] as string)
  if (productName) {
    const qty = mapped['product_qty'] ? Number(mapped['product_qty']) : 1
    const { error: itemError } = await supabase
      .from('order_items')
      .insert({
        order_id:     order.id,
        product_name: productName,
        qty:          qty > 0 ? qty : 1,
      })

    if (itemError) {
      console.error('Error creating order_item:', itemError)
      // No bloqueamos: el pedido ya existe
    }
  }

  // Registro inicial en status_history
  await supabase.from('status_history').insert({
    order_id:   order.id,
    from_status: null,
    to_status:  'nuevo',
    comment:    'Creado desde Typeform',
  })

  // Disparar sync-to-sheets y notify-slack de forma async (fire & forget)
  const appUrl = Deno.env.get('SUPABASE_URL')
  const syncUrl = `${appUrl}/functions/v1/sync-to-sheets`
  const slackUrl = `${appUrl}/functions/v1/notify-slack`
  const authHeader = `Bearer ${supabaseServiceKey}`

  EdgeRuntime.waitUntil(
    Promise.all([
      fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ order_id: order.id }),
      }).catch((e) => console.error('sync-to-sheets error:', e)),
      fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          event: 'new_order',
          order_id: order.id,
          operation_id: order.operation_id,
          customer_name: order.customer_name,
          venue_name: order.venue_name,
          status: order.status,
        }),
      }).catch((e) => console.error('notify-slack error:', e)),
    ])
  )

  return new Response(
    JSON.stringify({ ok: true, operation_id: order.operation_id, order_id: order.id }),
    { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
})
