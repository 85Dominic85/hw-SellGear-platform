// =============================================================
// Tipos TypeScript generados del schema Supabase
// Actualizar con: npx supabase gen types typescript --project-id <ref>
// =============================================================

export type OrderStatus =
  | 'nuevo'
  | 'pendiente'
  | 'enviado_proveedor'
  | 'enviado'
  | 'pagado'
  | 'falta_informacion'
  | 'bloqueado'
  | 'completado'

export type PurchaseType =
  | 'kit_digital'
  | 'hardware_one_off'
  | 'hardware_financiacion'
  | 'transferencias_saas'
  | 'otro'

export type UserRole = 'viewer' | 'commercial' | 'hardware' | 'manager' | 'admin'

export type ProductCategory =
  | 'pack'
  | 'tpv'
  | 'kds'
  | 'printer'
  | 'accessory'
  | 'network'
  | 'custom'

export interface Product {
  id: string
  code: string
  name: string
  description: string | null
  category: ProductCategory
  price_cents: number
  vat_rate: number
  package_count: number
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
  department: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  operation_id: string
  created_at: string
  updated_at: string
  created_by: string | null
  source: string
  source_department: string | null
  customer_name: string
  venue_name: string | null
  contact_email: string | null
  phone: string | null
  purchase_type: PurchaseType | null
  sheet_tab: string | null
  amount: number | null
  bank_receipt_url: string | null
  requester_name: string | null
  requester_email: string | null
  ae_ref: string | null
  hubspot_ref: string | null
  invoice_ref: string | null
  shipping_address: string | null
  status: OrderStatus
  assigned_to: string | null
  notes: string | null
  sheet_row: number | null
  typeform_response_id: string | null
  supplier: string | null
  invoiced: boolean
  prepared: boolean
  shipped: boolean
  shipping_label_url: string | null
  tracking_number: string | null
  delivered_at: string | null
  // TIPSA integration (tras aplicar migracion 20260421000001_add_tipsa_fields)
  carrier: string | null
  carrier_service_code: string | null
  carrier_guid: string | null
  shipping_weight_kg: number | null
  shipping_packages: number | null
  shipping_content: string | null
  shipping_observations: string | null
  shipped_at: string | null
  tracking_public_url: string | null
  tracking_last_status: string | null
  tracking_last_checked_at: string | null
  // Direccion estructurada (tras aplicar migracion 20260424000001_structured_shipping_fields)
  shipping_street: string | null
  shipping_cp: string | null
  shipping_city: string | null
  shipping_province: string | null
  // TIPSA envio con retorno (tras aplicar migracion 20260423000001_shipping_return)
  shipping_return: boolean | null
  // TIPSA entrega en sabado (tras aplicar migracion 20260505000005_add_saturday_delivery)
  shipping_saturday: boolean
  // joins
  order_items?: OrderItem[]
  creator?: UserProfile
  assignee?: UserProfile
  shipping_events?: ShippingEvent[]
}

export interface ShippingEvent {
  id: number
  /** XOR con shipment_id: exactamente uno de los dos viene rellenado. */
  order_id: string | null
  shipment_id: string | null
  carrier: string
  event_code: string
  event_label: string | null
  event_date: string
  raw_payload: Record<string, unknown> | null
  created_at: string
}

export interface Shipment {
  id: string
  shipment_id: string
  created_at: string
  updated_at: string
  created_by: string | null
  // Sender libre (no env vars)
  sender_name: string
  sender_address: string
  sender_cp: string
  sender_city: string
  sender_phone: string | null
  // Recipient
  recipient_name: string
  recipient_address: string
  recipient_cp: string
  recipient_city: string
  recipient_phone: string | null
  recipient_email: string | null
  recipient_contact_person: string | null
  // Detalles envio
  service_code: string
  packages: number
  weight_kg: number
  content: string | null
  observations: string | null
  return_shipment: boolean
  saturday_delivery: boolean
  reference: string | null
  // TIPSA
  albaran: string | null
  tracking_number: string | null
  tracking_public_url: string | null
  carrier_guid: string | null
  tracking_last_status: string | null
  tracking_last_checked_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  shipping_label_url: string | null
  notes: string | null
  // joins (opcional)
  shipping_events?: ShippingEvent[]
  creator?: UserProfile
}

export interface ShipmentSenderInput {
  name: string
  address: string
  cp: string
  city: string
  phone?: string | null
}

export interface ShipmentRecipientInput {
  name: string
  address: string
  cp: string
  city: string
  phone?: string | null
  email?: string | null
  contact_person?: string | null
}

export interface ShipmentCreateInput {
  sender: ShipmentSenderInput
  recipient: ShipmentRecipientInput
  service_code: string
  packages?: number
  weight_kg?: number
  content?: string | null
  observations?: string | null
  return_shipment?: boolean
  saturday_delivery?: boolean
  reference?: string | null
  notes?: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_name: string | null
  qty: number
  unit_price: number | null
  notes: string | null
  created_at: string
  product_id: string | null
  unit_price_cents: number | null
  discount_pct: number | null
  vat_rate: number | null
  product?: Product | null
}

export interface StatusHistory {
  id: string
  order_id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  changed_by: string | null
  changed_at: string
  comment: string | null
  changer?: UserProfile
}

export interface Comment {
  id: string
  order_id: string
  author_id: string | null
  body: string
  created_at: string
  updated_at: string
  author?: UserProfile
}

export interface OrderStatusLabel {
  status: OrderStatus
  label_es: string
  color: string
  description: string
}

export interface AddressBookEntry {
  id: string
  created_at: string
  updated_at: string
  created_by: string | null
  alias: string | null
  name: string
  venue_name: string | null
  address: string
  cp: string
  city: string
  province: string | null
  phone: string | null
  email: string | null
  contact_person: string | null
  notes: string | null
  // search_text es columna generada, no se expone al cliente.
}

export type AddressBookInput = Omit<
  AddressBookEntry,
  'id' | 'created_at' | 'updated_at' | 'created_by'
>
