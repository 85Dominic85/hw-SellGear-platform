// =============================================================
// Edge Function: sync-to-sheets
// Sincroniza un pedido de Supabase a Google Sheets (MainOperation).
// Hace append si sheet_row es null, update si ya existe.
// Guarda el sheet_row resultante en orders.
// =============================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// -----------------------------------------------
// Google Sheets API — auth con Service Account
// -----------------------------------------------

interface ServiceAccount {
  client_email: string
  private_key: string
}

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const sigInput = `${header}.${claim}`
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')

  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const encoder = new TextEncoder()
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(sigInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${sigInput}.${sigB64}`

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const tokenData = await tokenResp.json()
  if (!tokenResp.ok) throw new Error(`Auth error: ${JSON.stringify(tokenData)}`)
  return tokenData.access_token
}

// -----------------------------------------------
// Mapeo order → fila del sheet
// Orden de columnas de MainOperation (ajustar si el sheet cambia)
// -----------------------------------------------

function orderToSheetRow(order: Record<string, unknown>): unknown[] {
  return [
    order['operation_id'],
    order['created_at'],
    order['customer_name'],
    order['venue_name'] ?? '',
    order['purchase_type'] ?? '',
    order['status'] ?? '',
    order['amount'] ?? '',
    order['contact_email'] ?? '',
    order['phone'] ?? '',
    order['shipping_address'] ?? '',
    order['ae_ref'] ?? '',
    order['hubspot_ref'] ?? '',
    order['invoice_ref'] ?? '',
    order['bank_receipt_url'] ?? '',
    order['assigned_to'] ?? '',
    order['notes'] ?? '',
  ]
}

// -----------------------------------------------
// Handler principal
// -----------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const spreadsheetId = Deno.env.get('GOOGLE_SHEET_ID')

  if (!spreadsheetId) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_SHEET_ID not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Cargar Service Account
  let serviceAccount: ServiceAccount
  try {
    const saB64 = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_B64')
    if (!saB64) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 not set')
    serviceAccount = JSON.parse(atob(saB64))
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid service account config', detail: String(e) }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json().catch(() => ({}))
  const orderId: string | undefined = body.order_id

  if (!orderId) {
    return new Response(
      JSON.stringify({ error: 'order_id is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Cargar order completo
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) {
    return new Response(
      JSON.stringify({ error: 'Order not found', detail: fetchError?.message }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const sheetTab = order.sheet_tab ?? 'Pedidos'
  const rowData = orderToSheetRow(order)

  let accessToken: string
  try {
    accessToken = await getGoogleAccessToken(serviceAccount)
  } catch (e) {
    console.error('Google auth error:', e)
    return new Response(
      JSON.stringify({ error: 'Google auth failed', detail: String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const sheetsBase = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`
  const authHeader = `Bearer ${accessToken}`

  let sheetRow = order.sheet_row as number | null

  if (!sheetRow) {
    // APPEND: añadir nueva fila al final del tab
    const appendUrl = `${sheetsBase}/values/${encodeURIComponent(sheetTab)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
    const appendResp = await fetch(appendUrl, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [rowData] }),
    })

    if (!appendResp.ok) {
      const err = await appendResp.text()
      console.error('Sheets append error:', err)
      return new Response(
        JSON.stringify({ error: 'Sheets append failed', detail: err }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const appendData = await appendResp.json()
    // updatedRange: "Tab!A5:P5" → extraer número de fila
    const updatedRange: string = appendData.updates?.updatedRange ?? ''
    // Range format: "Tab!A5:P5" — extract trailing row number after last column letter
    const rowMatch = updatedRange.match(/[A-Z]+(\d+)$/)
    sheetRow = rowMatch ? parseInt(rowMatch[1], 10) : null

    // Guardar sheet_row en orders
    if (sheetRow) {
      await supabase.from('orders').update({ sheet_row: sheetRow }).eq('id', orderId)
    }

    console.log(`Appended to ${sheetTab} at row ${sheetRow}`)
  } else {
    // UPDATE: sobreescribir la fila existente
    const range = `${sheetTab}!A${sheetRow}:P${sheetRow}`
    const updateUrl = `${sheetsBase}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
    const updateResp = await fetch(updateUrl, {
      method: 'PUT',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, values: [rowData] }),
    })

    if (!updateResp.ok) {
      const err = await updateResp.text()
      console.error('Sheets update error:', err)
      return new Response(
        JSON.stringify({ error: 'Sheets update failed', detail: err }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Updated ${sheetTab} row ${sheetRow}`)
  }

  return new Response(
    JSON.stringify({ ok: true, sheet_tab: sheetTab, sheet_row: sheetRow }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
})
