import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * Valida el header `X-API-Key` contra `MAIN_PORTAL_API_KEY` (env).
 * Comparación con timingSafeEqual para mitigar timing attacks.
 *
 * Reusable para futuros endpoints de integración server-to-server.
 */
export function validateApiKey(
  request: NextRequest,
):
  | { ok: true }
  | { ok: false; response: NextResponse } {
  const expected = process.env.MAIN_PORTAL_API_KEY

  // Config inválida — la app no está lista para servir este endpoint.
  if (!expected) {
    console.error('[external-auth] MAIN_PORTAL_API_KEY no configurada')
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Endpoint no disponible (config)' },
        { status: 503 },
      ),
    }
  }

  const provided = request.headers.get('x-api-key') ?? ''
  if (!provided) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Falta X-API-Key' },
        { status: 401 },
      ),
    }
  }

  // timingSafeEqual requiere buffers del mismo tamaño. Si difieren,
  // comparamos contra un buffer del tamaño del esperado para no filtrar
  // longitud y devolvemos false explícito.
  const expectedBuf = Buffer.from(expected, 'utf8')
  const providedBuf = Buffer.from(provided, 'utf8')

  let match = false
  if (providedBuf.length === expectedBuf.length) {
    match = timingSafeEqual(providedBuf, expectedBuf)
  } else {
    // Hace una comparación dummy para mantener tiempo constante.
    timingSafeEqual(expectedBuf, expectedBuf)
    match = false
  }

  if (!match) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'API key inválida' },
        { status: 403 },
      ),
    }
  }

  return { ok: true }
}
