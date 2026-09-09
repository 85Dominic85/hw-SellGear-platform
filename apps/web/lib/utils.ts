import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { OrderStatus, PurchaseType, ShipmentStatus } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  nuevo:                    'Nuevo',
  pendiente:                'Pendiente',
  enviado_proveedor:        'Enviado desde proveedor',
  enviado:                  'Enviado',
  pagado:                   'Pagado',
  falta_informacion:        'Falta informacion',
  bloqueado:                'Bloqueado',
  completado:               'Completado',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  nuevo:                    'bg-blue-100 text-blue-800',
  pendiente:                'bg-yellow-100 text-yellow-800',
  enviado_proveedor:        'bg-purple-100 text-purple-800',
  enviado:                  'bg-indigo-100 text-indigo-800',
  pagado:                   'bg-green-100 text-green-800',
  falta_informacion:        'bg-orange-100 text-orange-800',
  bloqueado:                'bg-red-100 text-red-800',
  completado:               'bg-green-50 text-green-700 ring-2 ring-green-500 font-semibold',
}

export const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
  kit_digital:            'KIT Digital',
  hardware_one_off:       'Hardware One Off',
  hardware_financiacion:  'Hardware Financiación',
  transferencias_saas:    'Transferencias SaaS',
  saas_hardware:          'SaaS + Hardware',
  otro:                   'Otro',
}

// Transiciones de estado permitidas (selector libre entre todos)
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  nuevo:                    ['pendiente', 'enviado_proveedor', 'enviado', 'pagado', 'completado', 'falta_informacion', 'bloqueado'],
  pendiente:                ['nuevo', 'enviado_proveedor', 'enviado', 'pagado', 'completado', 'falta_informacion', 'bloqueado'],
  enviado_proveedor:        ['nuevo', 'pendiente', 'enviado', 'pagado', 'completado', 'falta_informacion', 'bloqueado'],
  enviado:                  ['nuevo', 'pendiente', 'enviado_proveedor', 'pagado', 'completado', 'falta_informacion', 'bloqueado'],
  pagado:                   ['nuevo', 'pendiente', 'enviado_proveedor', 'enviado', 'completado', 'falta_informacion', 'bloqueado'],
  falta_informacion:        ['nuevo', 'pendiente', 'enviado_proveedor', 'enviado', 'pagado', 'completado', 'bloqueado'],
  bloqueado:                ['nuevo', 'pendiente', 'enviado_proveedor', 'enviado', 'pagado', 'completado', 'falta_informacion'],
  completado:               ['nuevo', 'pendiente'],
}

// =============================================================
// Shipments (envios libres) - estado manual
// =============================================================

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pendiente:    'Pendiente',
  en_curso:     'En curso',
  entregado:    'Entregado',
  incidencia:   'Incidencia',
  devuelto:     'Devuelto',
  cancelado:    'Cancelado',
}

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  pendiente:    'bg-gray-100 text-gray-800',
  en_curso:     'bg-blue-100 text-blue-800',
  entregado:    'bg-green-50 text-green-700 ring-2 ring-green-500 font-semibold',
  incidencia:   'bg-red-100 text-red-800',
  devuelto:     'bg-amber-100 text-amber-800',
  cancelado:    'bg-gray-200 text-gray-700 line-through',
}

// =============================================================
// TIPSA - codigos de estado del transportista (V_COD_TIPO_EST)
// Se pintan igual que el resto de badges del proyecto.
// Catalogo oficial: ver TIPSA_EVENT_LABELS en lib/tipsa/services.ts.
// =============================================================

export const TIPSA_STATUS_COLORS: Record<string, string> = {
  '0':  'bg-gray-100 text-gray-800',    // Documentado
  '1':  'bg-blue-100 text-blue-800',    // En transito
  '2':  'bg-blue-100 text-blue-800',    // En reparto
  '3':  'bg-green-50 text-green-700 ring-2 ring-green-500 font-semibold', // Entregado (terminal)
  '4':  'bg-amber-100 text-amber-800',  // Incidencia
  '5':  'bg-red-100 text-red-800',      // Devuelto (terminal)
  '6':  'bg-amber-100 text-amber-800',  // Falta de expedicion
  '7':  'bg-blue-100 text-blue-800',    // Recanalizado
  '9':  'bg-amber-100 text-amber-800',  // Falta de expedicion administrativa
  '10': 'bg-red-100 text-red-800',      // Destruido
  '11': 'bg-gray-100 text-gray-800',    // Recogida
  '12': 'bg-blue-100 text-blue-800',    // Leida repartidor
  '13': 'bg-blue-100 text-blue-800',    // Leida
  '14': 'bg-blue-100 text-blue-800',    // Disponible para recoger
  '15': 'bg-amber-100 text-amber-800',  // Entrega parcial
}

/** Fallback para codigos que TIPSA anada y aun no hayamos mapeado. */
export const TIPSA_STATUS_COLOR_FALLBACK = 'bg-gray-100 text-gray-800'

export function tipsaStatusColor(code: string | null | undefined): string {
  if (!code) return TIPSA_STATUS_COLOR_FALLBACK
  return TIPSA_STATUS_COLORS[code] ?? TIPSA_STATUS_COLOR_FALLBACK
}

// Transiciones permitidas. 'cancelado' es semi-terminal (solo se puede
// revertir a pendiente). 'entregado' tambien lo es: si necesitas
// revertir, vuelve a pendiente y de ahi se reabre el flujo.
export const SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  pendiente:    ['en_curso', 'entregado', 'incidencia', 'devuelto', 'cancelado'],
  en_curso:     ['pendiente', 'entregado', 'incidencia', 'devuelto', 'cancelado'],
  entregado:    ['pendiente', 'incidencia'],
  incidencia:   ['pendiente', 'en_curso', 'entregado', 'devuelto', 'cancelado'],
  devuelto:     ['pendiente', 'incidencia'],
  cancelado:    ['pendiente'],
}

// Canarias: detección estricta por código postal.
// 35xxx = Las Palmas; 38xxx = Santa Cruz de Tenerife.
// Acepta tanto CP exacto ('38500') como dirección textual con CP embebido.
// NO matchea por keywords ('Calle Canarias 5, Madrid' → false).
export function isCanaryIslands(cpOrAddress: string | null): boolean {
  if (!cpOrAddress) return false
  const trimmed = cpOrAddress.trim()
  if (/^3[58]\d{3}$/.test(trimmed)) return true
  return /\b3[58]\d{3}\b/.test(trimmed)
}

export function formatCurrency(amount: number | null): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}
