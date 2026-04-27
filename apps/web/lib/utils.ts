import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { OrderStatus, PurchaseType } from '@/types/database'

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
