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
 * Catalogo por defecto de servicios TIPSA Dinapaq.
 * Extraido de docs/integrations/tipsa/extracted/Documentacion/Documentacion WebServices 64.0_resumen_ES.pdf.
 * Son todos los codigos disponibles en el contrato QR Payments; TIPSA aplica las
 * restricciones propias de cada codigo (ej. 10h no disponible a Peninsula/Baleares).
 * Si se intenta un codigo no admisible para el destino, TIPSA devuelve error 28.
 *
 * Se puede sobreescribir via env var TIPSA_SERVICES_CATALOG (JSON array).
 */
export const DEFAULT_SERVICES_CATALOG: Array<{ code: string; label: string }> = [
  // Mas habituales primero (el primero es el default del selector)
  { code: '48', label: 'Economy (24h)' },
  // Codigo 49 ("Standard") retirado: TIPSA confirmo que no lo reconoce
  // su plataforma. El estandar 24h se gestiona con el codigo 48.
  { code: '24', label: 'Premium' },
  { code: '14', label: '14 Horas' },
  { code: '10', label: '10 Horas' },
  { code: '12', label: 'Mediodía' },
  { code: '19', label: '19 Horas' },
  // Especificos / menos habituales
  { code: '06', label: 'Aérea/Marítima (Canarias/Baleares)' },
  { code: '20', label: 'En Delegación' },
  { code: '50', label: 'Pickup (Puntos Conveniencia)' },
  { code: '15', label: 'Farma 15' },
  { code: '25', label: 'Farma 25' },
  // Internacional / especiales
  { code: '90', label: 'Int-Express' },
  { code: '91', label: 'Int-Economy' },
  { code: '92', label: 'DPD - Classic' },
  { code: '96', label: 'Marítima' },
  { code: 'MV', label: 'Masivo' },
]

/**
 * Mapeo de codigos de evento TIPSA a etiqueta humana.
 * Source: docs/integrations/tipsa/extracted/Ejemplos/ConsEnvEstados y web publica TIPSA.
 * Los codigos 0, 7, 8, 10, 11, 15, 18 son mapeo "educado" deducido de la web
 * publica TIPSA para envios reales; sustituir por labels oficiales cuando
 * TIPSA nos pase el catalogo completo.
 * Si aparece un codigo desconocido se devuelve "Estado {code}".
 */
export const TIPSA_EVENT_LABELS: Record<string, string> = {
  '0': 'Documentado',
  '1': 'Alta',
  '2': 'Entregado',
  '3': 'Incidencia',
  '4': 'En tránsito',
  '5': 'En reparto',
  '6': 'Devuelto al origen',
  '7': 'Lectura en agencia',
  '8': 'En reparto',
  '10': 'En delegación destino',
  '11': 'En reparto',
  '15': 'Pendiente de llegada',
  '18': 'En tránsito interno',
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
 * Codigo TIPSA que representa una "anotacion" (no un cambio de estado real).
 * Codigo 3 = "Incidencia" pero TIPSA lo emite tambien para anotaciones
 * post-entrega (ej. "entregado al portero", "ausente y dejado en buzon").
 */
const NOTE_CODE = '3'

/**
 * Calcula el "estado oficial" del envio entre una lista cronologica de eventos.
 * El codigo 3 (Incidencia) DESPUES de un codigo 2 (Entregado) NO altera el estado:
 * TIPSA usa el codigo 3 tambien para anotaciones post-entrega del repartidor.
 * Devuelve el ultimo evento que NO sea solo una anotacion.
 *
 * Si todos los eventos son codigo 3 (incidencia previa real), devuelve el ultimo.
 * Si la lista esta vacia devuelve null.
 *
 * Generico: acepta cualquier objeto via funcion `getCode` extractora. Asi sirve
 * tanto para `TipsaShippingEvent` (parser SOAP) como para `ShippingEvent` (DB).
 *
 * Asume que `events` esta ordenado cronologicamente ascendente (del mas antiguo al mas reciente).
 */
export function resolveOfficialStatus<T>(
  events: T[],
  getCode: (e: T) => string,
): T | null {
  if (events.length === 0) return null

  // Un envio no se "des-entrega". Si en algun momento llego un evento terminal
  // (2 Entregado / 6 Devuelto) ese es el estado final: lo que venga despues son
  // anotaciones. Vale para el codigo 3 del repartidor y, sobre todo, para
  // codigos que TIPSA emite y aun no tenemos catalogados — en produccion
  // aparece un 14 despues del 2 que sin esta regla degradaba un "Entregado" a
  // "Estado 14". Ante un codigo desconocido, no pisar una entrega confirmada.
  for (let i = events.length - 1; i >= 0; i--) {
    if (TIPSA_TERMINAL_CODES.has(getCode(events[i]))) return events[i]
  }

  for (let i = events.length - 1; i >= 0; i--) {
    if (getCode(events[i]) !== NOTE_CODE) return events[i]
  }
  return events[events.length - 1]
}

/**
 * Devuelve true si el evento `events[index]` es una "anotacion post-entrega"
 * (codigo 3 que vino despues de un codigo 2). En ese caso debe renderizarse
 * con estilo secundario (no como incidencia real).
 *
 * Asume `events` ordenado cronologicamente ascendente.
 */
export function isPostDeliveryNote<T>(
  events: T[],
  index: number,
  getCode: (e: T) => string,
): boolean {
  if (!events[index] || getCode(events[index]) !== NOTE_CODE) return false
  for (let i = 0; i < index; i++) {
    if (getCode(events[i]) === '2') return true
  }
  return false
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
