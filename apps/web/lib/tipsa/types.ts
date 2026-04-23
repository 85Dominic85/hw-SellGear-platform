/**
 * Tipos TIPSA (Dinapaq SOAP WS).
 * Reflejan los payloads relevantes para el MVP de integracion.
 */

export type TipsaEnv = 'test' | 'prod'

export interface TipsaCredentials {
  agencyCode: string
  clientCode: string
  password: string
}

export interface TipsaSession {
  id: string
  createdAt: number
  trackingBaseUrl: string | null
}

export interface TipsaLoginResult {
  sessionId: string
  clientName: string
  version: string
  trackingBaseUrl: string | null
}

export interface TipsaSender {
  name: string
  address: string
  city: string
  cp: string
  phone: string
}

export interface TipsaRecipient {
  name: string
  address: string
  city: string
  cp: string
  phone?: string
  email?: string
  country?: string
  /**
   * Persona de contacto en el destino (ej. "Juan Garcia").
   * Se envia a TIPSA como strPersContacto (WSDL GrabaEnvio24 linea 2362).
   */
  contactPerson?: string
}

export interface TipsaCreateShipmentInput {
  serviceCode: string
  packages: number
  weightKg: number
  content?: string
  observations?: string
  /**
   * Referencia libre que TIPSA guarda para este envio.
   * Usaremos el operation_id del pedido (ej: HW-202604-0012).
   */
  reference?: string
  recipient: TipsaRecipient
  /**
   * Fecha del envio (YYYY-MM-DD). Por defecto hoy.
   */
  date?: string
  /**
   * Si true, activa boRetorno en GrabaEnvio24 para que TIPSA recoja material
   * del destinatario tras la entrega (envio con retorno / recogida).
   * Por defecto false.
   */
  returnShipment?: boolean
}

export interface TipsaCreateShipmentResult {
  /** N albaran que usamos como tracking_number */
  albaran: string
  /** GUID TIPSA para construir URL publica */
  guid: string
  deliveryDate: string | null
  packagesCount: number
  rawResponse: string
}

export type TipsaLabelFormat = 'pdf' | 'zpl'

export interface TipsaLabelResult {
  format: TipsaLabelFormat
  /** Contenido en base64 */
  base64: string
  rawResponse: string
}

/**
 * Codigos de estado TIPSA (V_COD_TIPO_EST) mapeados a texto humano.
 * Source: docs/integrations/tipsa/extracted/Documentacion/*.pdf
 */
export type TipsaEventCode =
  | '1'   // Alta
  | '2'   // Entregado
  | '3'   // Incidencia
  | '4'   // En transito
  | '5'   // En reparto
  | '6'   // Devuelto origen
  | string

export interface TipsaShippingEvent {
  code: TipsaEventCode
  label: string
  date: string // ISO
  rawAttributes: Record<string, string>
}

export interface TipsaTrackingResult {
  albaran: string
  events: TipsaShippingEvent[]
  rawResponse: string
}

export interface TipsaConfig {
  env: TipsaEnv
  credentials: TipsaCredentials
  sender: TipsaSender
  servicesCatalog: Array<{ code: string; label: string }>
}

export interface TipsaError extends Error {
  code?: string
  rawResponse?: string
  httpStatus?: number
}
