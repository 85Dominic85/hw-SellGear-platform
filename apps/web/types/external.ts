// =============================================================
// Tipos públicos del endpoint /api/external/metrics
// Consumido por HW Main Portal (dashboard agregador read-only).
// =============================================================

import type { OrderStatus, PurchaseType, ShipmentStatus } from './database'

export interface ExternalMetricsKpis {
  total_orders: number
  total_revenue: number
  avg_order_value: number
  /** Porcentaje 0-100 de pedidos completados sobre activos (excluye 'bloqueado'). */
  completed_rate: number
}

export interface ExternalMetricsComparison {
  prev_total_orders: number
  prev_total_revenue: number
  prev_avg_order_value: number
  prev_completed_rate: number
}

export interface ExternalOrdersByDate {
  date: string
  count: number
  revenue: number
}

export interface ExternalBreakdownByPurchaseType {
  purchase_type: string
  count: number
  revenue: number
}

export interface ExternalBreakdownByStatus {
  status: string
  count: number
}

export interface ExternalBreakdownByProduct {
  product_name: string
  total_qty: number
  order_count: number
}

export interface ExternalSlaByWeek {
  week_start: string
  count: number
  avg_days: number
  on_time_pct: number
}

export interface ExternalSla {
  total_delivered: number
  avg_delivery_days: number
  on_time_pct: number
  breached_count: number
  active_at_risk: number
  sla_by_week: ExternalSlaByWeek[]
}

export interface ExternalRecentOrder {
  operation_id: string
  created_at: string
  customer_name: string
  venue_name: string | null
  purchase_type: PurchaseType | null
  amount: number | null
  status: OrderStatus
  tracking_number: string | null
}

export interface ExternalThroughputWeek {
  week_start: string
  created: number
  shipped: number
  delivered: number
}

export interface ExternalMetricsOps {
  total_shipped: number
  total_completed: number
  /** Días promedio created → shipped (envíos físicos). */
  avg_handling_days: number
  /** Días promedio shipped → delivered (transportista). */
  avg_transit_days: number
  /** Porcentaje 0-100 de envíos físicos despachados en ≤ 5 días. */
  on_time_shipping_pct: number
  throughput_by_week: ExternalThroughputWeek[]
  blocked_count: number
  /** Pedidos SaaS/otro completados, excluidos del SLA físico (transparencia). */
  excluded_admin: number
}

export interface ExternalMetricsResponse {
  generated_at: string
  range: { from: string; to: string }
  kpis: ExternalMetricsKpis
  comparison: ExternalMetricsComparison | null
  time_series: {
    orders_by_date: ExternalOrdersByDate[]
  }
  breakdowns: {
    by_purchase_type: ExternalBreakdownByPurchaseType[]
    by_status: ExternalBreakdownByStatus[]
    by_product: ExternalBreakdownByProduct[]
  }
  sla: ExternalSla
  recent_orders: ExternalRecentOrder[]
  /** KPIs operativos del departamento Hardware (opcional, opt-in). */
  ops?: ExternalMetricsOps
}

// =============================================================
// Tipos públicos del endpoint /api/external/hwtoolbox/orders
// Consumido por HWToolbox (gestión de inventario read-only).
// Solo expone pedidos en estados de envío:
//   preparado | enviado | enviado_proveedor | completado | bloqueado
// =============================================================

export interface HwToolboxOrderListItem {
  operation_id: string
  customer_name: string
  venue_name: string | null
  purchase_type: PurchaseType | null
  status: OrderStatus
  /** Importe total con IVA en EUR (puede ser null para pedidos legacy sin items). */
  amount: number | null
  created_at: string
}

export interface HwToolboxListPagination {
  total: number
  limit: number
  offset: number
}

export interface HwToolboxListResponse {
  generated_at: string
  pagination: HwToolboxListPagination
  orders: HwToolboxOrderListItem[]
}

export interface HwToolboxAe {
  full_name: string | null
  email: string | null
  /** Referencia AE manual (texto libre en el pedido). */
  ae_ref: string | null
}

export interface HwToolboxOrderItem {
  product_code: string | null
  product_name: string
  qty: number
  unit_price_cents: number
  vat_rate: number
  discount_pct: number
  /** Base imponible (subtotal sin IVA, descuento aplicado). */
  subtotal_cents: number
  vat_amount_cents: number
  /** Total con IVA. */
  total_cents: number
  currency: 'EUR'
}

export interface HwToolboxOrderTotals {
  /** Suma de qty * unit_price antes de descuentos. */
  subtotal_cents: number
  /** Suma de descuentos aplicados. */
  discount_cents: number
  /** Base imponible (subtotal - descuento). */
  taxable_cents: number
  vat_amount_cents: number
  /** Total con IVA. */
  total_cents: number
  currency: 'EUR'
}

export interface HwToolboxOrderDetail {
  operation_id: string
  customer_name: string
  venue_name: string | null
  purchase_type: PurchaseType | null
  /** Etiqueta humana en es-ES (ej. "Hardware One Off"). */
  purchase_type_label: string | null
  status: OrderStatus
  created_at: string
  /** Null si el pedido no tiene created_by (legacy Typeform). */
  ae: HwToolboxAe | null
  items: HwToolboxOrderItem[]
  totals: HwToolboxOrderTotals
}

export interface HwToolboxDetailResponse {
  generated_at: string
  order: HwToolboxOrderDetail
}

// =============================================================
// Tipos públicos del endpoint /api/external/hwtoolbox/shipments
//
// Envíos TIPSA LIBRES (tabla `shipments`, id SH-YYYYMM-NNNN): etiquetas que
// no cuelgan de un pedido — cliente a cliente, o material que vuelve a
// nosotros. Son movimientos de almacén reales, así que HWToolbox los necesita
// igual que los pedidos, pero NO son pedidos: no tienen estado del enum de
// `orders`, ni tipo de compra, ni importe, ni líneas de producto.
//
// Lo que salió está en `content`, texto libre que escribe quien crea la
// etiqueta ("PACK PREMIUM: TPV, 2 PRINTER WIFI...", "TPV PARA REPARACIÓN").
// No hay forma de derivar SKU de ahí, así que se entrega tal cual y HWToolbox
// decide qué hacer con él.
//
// Tampoco se inventa un estado: se exponen los hechos crudos (`shipped_at`,
// `delivered_at`, `tracking_last_status` de TIPSA) y el consumidor concluye.
// =============================================================

export interface HwToolboxShipmentListItem {
  /** Formato SH-YYYYMM-NNNN. */
  shipment_id: string
  /**
   * Estado MANUAL que fija el equipo (`shipments.status`, enum propio de
   * envíos — no el de pedidos). Es la columna «Estado» de la pestaña de
   * envíos y manda sobre el tracking automático de TIPSA.
   * `devuelto`, `cancelado` e `incidencia` cambian lo que un inventario debe
   * concluir, así que va también en el listado.
   */
  status: ShipmentStatus
  sender_name: string
  recipient_name: string
  recipient_city: string
  /** Descripción libre de lo que va dentro. Puede ser null. */
  content: string | null
  packages: number
  /**
   * `true` = material que VUELVE (recogida / RMA). Para un inventario es la
   * diferencia entre una entrada y una salida, así que va también en el
   * listado y no solo en el detalle.
   */
  return_shipment: boolean
  /** Albarán TIPSA. Null si la etiqueta aún no se generó. */
  albaran: string | null
  tracking_number: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
}

export interface HwToolboxShipmentsListResponse {
  generated_at: string
  pagination: HwToolboxListPagination
  shipments: HwToolboxShipmentListItem[]
}

/** Quién creó el envío en MainOps. Null si la fila no tiene created_by. */
export interface HwToolboxShipmentCreator {
  full_name: string | null
  email: string | null
}

export interface HwToolboxShipmentParty {
  name: string
  address: string
  cp: string
  city: string
  phone: string | null
}

export interface HwToolboxShipmentRecipient extends HwToolboxShipmentParty {
  email: string | null
  contact_person: string | null
}

export interface HwToolboxShipmentDetail {
  shipment_id: string
  /** Estado manual del equipo. Ver HwToolboxShipmentListItem.status. */
  status: ShipmentStatus
  sender: HwToolboxShipmentParty
  recipient: HwToolboxShipmentRecipient
  /** Código de servicio TIPSA con el que se contrató. */
  service_code: string
  packages: number
  weight_kg: number
  content: string | null
  /** Observaciones que viajan en la etiqueta. */
  observations: string | null
  /** Notas internas de MainOps. */
  notes: string | null
  /** Referencia libre del envío. */
  reference: string | null
  return_shipment: boolean
  albaran: string | null
  tracking_number: string | null
  tracking_public_url: string | null
  /** Último código de estado que devolvió TIPSA, tal cual ('1', '2'...). */
  tracking_last_status: string | null
  /**
   * El mismo código traducido con `tipsaEventLabel`, la tabla que usa la app
   * ('1' → «En tránsito», '2' → «En reparto», '3' → «Entregado»...). Un código
   * suelto no dice nada, y duplicar la tabla en el consumidor la condena a
   * desincronizarse — que es justo lo que pasó: hasta 2026-09-09 la app usaba
   * un catálogo equivocado en el que el 2 era «Entregado» y el 3 «Incidencia».
   * Si un consumidor guardó esa interpretación, tiene que revisarla.
   */
  tracking_last_status_label: string | null
  tracking_last_checked_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  shipping_label_url: string | null
  created_at: string
  updated_at: string
  created_by: HwToolboxShipmentCreator | null
}

export interface HwToolboxShipmentDetailResponse {
  generated_at: string
  shipment: HwToolboxShipmentDetail
}
