// =============================================================
// Tipos TypeScript generados del schema Supabase
// Actualizar con: npx supabase gen types typescript --project-id <ref>
// =============================================================

export type OrderStatus =
  | 'nuevo'
  | 'pendiente'
  | 'solicitado_a_proveedor'
  | 'pagado'
  | 'falta_informacion'
  | 'bloqueado'

export type PurchaseType =
  | 'kit_digital'
  | 'hardware_one_off'
  | 'hardware_financiacion'
  | 'transferencias_saas'
  | 'otro'

export type UserRole = 'viewer' | 'creator' | 'hardware' | 'manager' | 'admin'

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
  // joins
  order_items?: OrderItem[]
  creator?: UserProfile
  assignee?: UserProfile
}

export interface OrderItem {
  id: string
  order_id: string
  product_name: string
  qty: number
  unit_price: number | null
  notes: string | null
  created_at: string
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
