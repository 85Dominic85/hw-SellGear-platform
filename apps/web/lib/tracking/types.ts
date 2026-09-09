// =============================================================================
// Tipo unificado que consume la vista /tracking.
// -----------------------------------------------------------------------------
// Combina orders (con carrier=tipsa) y shipments (envios libres SH-*) en un
// shape comun que las tarjetas del kanban y las filas del timeline pintan
// sin conocer la tabla de origen.
// =============================================================================

export type TrackingEntryKind = 'order' | 'shipment'

export interface TrackingEntry {
  kind: TrackingEntryKind
  /** UUID interno de la fila padre (orders.id o shipments.id). */
  id: string
  /** ID publico legible: operation_id (HW-YYYYMM-NNNN) o shipment_id (SH-*). */
  publicId: string
  /** URL a la ficha. */
  href: string

  /** Nombre principal (cliente del pedido o destinatario del envio libre). */
  displayName: string
  /** Subtitulo opcional (venue, ciudad, ruta...). */
  subtitle: string | null

  /** Datos TIPSA. */
  albaran: string | null
  trackingPublicUrl: string | null
  trackingLastStatus: string | null
  trackingLastCheckedAt: string | null
  deliveredAt: string | null
  shippedAt: string | null

  /** Autor (para filtro "solo mios"). */
  createdBy: string | null
  createdByName: string | null

  /** Eventos ordenados cronologicamente ASCENDENTE. */
  events: Array<{ event_code: string; event_date: string }>
}

/**
 * Categoria para agrupar en el kanban. Derivada de tracking_last_status.
 *
 * Codigos segun el catalogo oficial de TIPSA (ver TIPSA_EVENT_LABELS en
 * lib/tipsa/services.ts). OJO al leer codigo antiguo: hasta 2026-09-09 esta
 * funcion usaba un mapa equivocado en el que el 2 era "entregado" y el 3
 * "incidencia", con lo que el kanban metia las entregas reales en la columna
 * de incidencias y daba por entregado lo que solo iba en reparto.
 */
export type TrackingCategory =
  | 'pending' // sin recoger: null, 0 DOCUMENTADO
  | 'transit' // 1 TRANSITO, 2 REPARTO, 7 RECANALIZADO, 14 DISPONIBLE, 15 ENTREGA PARCIAL, y desconocidos
  | 'delivered' // 3 ENTREGADO
  | 'incident' // 4 INCIDENCIA, 6 FALTA DE EXPEDICION, 9 FALTA EXPED. ADMIN
  | 'returned' // 5 DEVUELTO, 10 DESTRUIDO

export function categorize(code: string | null | undefined): TrackingCategory {
  if (!code || code === '0') return 'pending'
  if (code === '3') return 'delivered'
  if (code === '4' || code === '6' || code === '9') return 'incident'
  if (code === '5' || code === '10') return 'returned'
  return 'transit'
}
