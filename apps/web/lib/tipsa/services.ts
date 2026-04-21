import type { TipsaConfig, TipsaEnv, TipsaEventCode } from './types'

/**
 * URLs SOAP de TIPSA por entorno.
 */
export const TIPSA_URLS = {
  test: {
    login: 'https://wsval.tipsa-dinapaq.com/SOAP?service=LoginWSService',
    webserv: 'https://wsval.tipsa-dinapaq.com/SOAP?service=WebServService',
  },
  prod: {
    login: 'https://ws.tipsa-dinapaq.com/SOAP?service=LoginWSService',
    webserv: 'https://ws.tipsa-dinapaq.com/SOAP?service=WebServService',
  },
} as const satisfies Record<TipsaEnv, { login: string; webserv: string }>

/**
 * Catalogo por defecto de servicios TIPSA (fallback si TIPSA_SERVICES_CATALOG no esta seteado).
 * Codigos habituales; el cliente puede ajustar via env var.
 */
export const DEFAULT_SERVICES_CATALOG: Array<{ code: string; label: string }> = [
  { code: '48', label: '24h estándar' },
  { code: '10', label: '48h' },
  { code: '52', label: 'Sábado' },
  { code: '40', label: '14h (next day)' },
  { code: '01', label: 'Económico' },
]

/**
 * Mapeo de codigos de evento TIPSA a etiqueta humana.
 * Source: docs/integrations/tipsa/extracted/Ejemplos/ConsEnvEstados y docs PDFs.
 * Si aparece un codigo desconocido se devuelve "Estado {code}".
 */
export const TIPSA_EVENT_LABELS: Record<string, string> = {
  '1': 'Alta',
  '2': 'Entregado',
  '3': 'Incidencia',
  '4': 'En tránsito',
  '5': 'En reparto',
  '6': 'Devuelto al origen',
}

export function tipsaEventLabel(code: TipsaEventCode): string {
  return TIPSA_EVENT_LABELS[code] ?? `Estado ${code}`
}

/**
 * Estados "finales" que indican que ya no hay que seguir polleando.
 */
export const TIPSA_TERMINAL_CODES = new Set<string>(['2', '6'])

export function isTerminalEvent(code: TipsaEventCode): boolean {
  return TIPSA_TERMINAL_CODES.has(code)
}

/**
 * Lee TipsaConfig desde process.env.
 * Separa credenciales por entorno para poder flipar sin code deploy.
 */
/**
 * Carga solo el catalogo de servicios desde env (sin requerir credenciales).
 * Util para componentes server que muestran el selector en la UI.
 */
export function loadServicesCatalog(): Array<{ code: string; label: string }> {
  return parseServicesCatalog(process.env.TIPSA_SERVICES_CATALOG)
}

export function loadTipsaConfig(): TipsaConfig {
  const env = (process.env.TIPSA_ENV ?? 'test') as TipsaEnv

  const credentials = env === 'prod'
    ? {
        agencyCode: required('TIPSA_PROD_AGENCY_CODE'),
        clientCode: required('TIPSA_PROD_CLIENT_CODE'),
        password: required('TIPSA_PROD_PASSWORD'),
      }
    : {
        agencyCode: required('TIPSA_TEST_AGENCY_CODE'),
        clientCode: required('TIPSA_TEST_CLIENT_CODE'),
        password: required('TIPSA_TEST_PASSWORD'),
      }

  const sender = {
    name: required('TIPSA_SENDER_NAME'),
    address: required('TIPSA_SENDER_ADDRESS'),
    city: required('TIPSA_SENDER_CITY'),
    cp: required('TIPSA_SENDER_CP'),
    phone: required('TIPSA_SENDER_PHONE'),
  }

  const servicesCatalog = parseServicesCatalog(process.env.TIPSA_SERVICES_CATALOG)

  return { env, credentials, sender, servicesCatalog }
}

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

function parseServicesCatalog(raw: string | undefined): Array<{ code: string; label: string }> {
  if (!raw) return DEFAULT_SERVICES_CATALOG
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_SERVICES_CATALOG
    const cleaned = parsed
      .filter((it: unknown): it is { code: unknown; label: unknown } =>
        typeof it === 'object' && it !== null && 'code' in it && 'label' in it,
      )
      .map((it) => ({ code: String(it.code), label: String(it.label) }))
      .filter((it) => it.code.length > 0 && it.label.length > 0)
    return cleaned.length > 0 ? cleaned : DEFAULT_SERVICES_CATALOG
  } catch {
    return DEFAULT_SERVICES_CATALOG
  }
}

/**
 * URL publica de seguimiento TIPSA para un envio.
 * Segun doc oficial "Documentacion Construccion URL" pag. 4:
 *   - GUID sin llaves {}, solo el UUID
 *   - FECHA en formato DD/MM/YYYY (literal, sin URL-encode)
 * Ejemplo esperado: ?servicio=16C85B1E-648B-46BD-87CC-B93792BAAF5E&fecha=21/02/2019
 */
export function buildPublicTrackingUrl(
  trackingBaseUrl: string | null,
  guid: string,
  date: Date,
): string | null {
  if (!trackingBaseUrl) return null
  const cleanGuid = guid.replace(/^\{/, '').replace(/\}$/, '')
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear())
  const fecha = `${dd}/${mm}/${yyyy}`
  return trackingBaseUrl
    .replace('{GUID}', cleanGuid)
    .replace('{FECHA}', fecha)
}
