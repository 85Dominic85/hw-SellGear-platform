import { NextRequest, NextResponse } from 'next/server'

/**
 * Setea cabeceras CORS si el header `Origin` está incluido en la lista
 * de la env var indicada (default `MAIN_PORTAL_ORIGIN`, formato CSV).
 * Para llamadas server-to-server (sin Origin) no se aplica CORS — el
 * header simplemente no estará presente.
 *
 * Soporta múltiples origins separados por coma para permitir, por ejemplo,
 * staging y producción del portal HW: "https://portal.hw,https://portal-staging.hw".
 *
 * Para endpoints con scope distinto, pasar otra env var (ej. `HWTOOLBOX_ORIGIN`).
 */
export function applyCors(
  response: NextResponse,
  request: NextRequest,
  envVarName: string = 'MAIN_PORTAL_ORIGIN',
): NextResponse {
  const origin = request.headers.get('origin')
  if (!origin) return response

  const raw = process.env[envVarName] ?? ''
  const allowed = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  if (allowed.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Vary', 'Origin')
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'X-API-Key, Content-Type')
    response.headers.set('Access-Control-Max-Age', '600')
  }

  return response
}

/**
 * Handler para preflight OPTIONS. Devuelve 204 con cabeceras CORS si el
 * origin es válido, 403 en caso contrario.
 *
 * Acepta env var custom para diferentes endpoints (default `MAIN_PORTAL_ORIGIN`).
 */
export function handlePreflight(
  request: NextRequest,
  envVarName: string = 'MAIN_PORTAL_ORIGIN',
): NextResponse {
  const empty = new NextResponse(null, { status: 204 })
  return applyCors(empty, request, envVarName)
}
