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
 */
export type TrackingCategory =
  | 'pending' // sin recogida (null, 0, 1)
  | 'transit' // 4, 5, 7, 8, 10, 11, 15, 18
  | 'delivered' // 2
  | 'incident' // 3
  | 'returned' // 6

export function categorize(code: string | null | undefined): TrackingCategory {
  if (!code || code === '0' || code === '1') return 'pending'
  if (code === '2') return 'delivered'
  if (code === '3') return 'incident'
  if (code === '6') return 'returned'
  return 'transit'
}
