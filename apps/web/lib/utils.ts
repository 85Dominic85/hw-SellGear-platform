import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { OrderStatus, PurchaseType } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  nuevo:                    'Nuevo',
  pendiente:                'Pendiente',
  solicitado_a_proveedor:   'Solicitado a proveedor',
  pagado:                   'Pagado',
  falta_informacion:        'Falta informacion',
  bloqueado:                'Bloqueado',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  nuevo:                    'bg-blue-100 text-blue-800',
  pendiente:                'bg-yellow-100 text-yellow-800',
  solicitado_a_proveedor:   'bg-purple-100 text-purple-800',
  pagado:                   'bg-green-100 text-green-800',
  falta_informacion:        'bg-orange-100 text-orange-800',
  bloqueado:                'bg-red-100 text-red-800',
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
  nuevo:                    ['pendiente', 'solicitado_a_proveedor', 'pagado', 'falta_informacion', 'bloqueado'],
  pendiente:                ['nuevo', 'solicitado_a_proveedor', 'pagado', 'falta_informacion', 'bloqueado'],
  solicitado_a_proveedor:   ['nuevo', 'pendiente', 'pagado', 'falta_informacion', 'bloqueado'],
  pagado:                   ['nuevo', 'pendiente', 'solicitado_a_proveedor', 'falta_informacion', 'bloqueado'],
  falta_informacion:        ['nuevo', 'pendiente', 'solicitado_a_proveedor', 'pagado', 'bloqueado'],
  bloqueado:                ['nuevo', 'pendiente', 'solicitado_a_proveedor', 'pagado', 'falta_informacion'],
}

const CANARY_KEYWORDS = [
  'canarias', 'tenerife', 'gran canaria', 'las palmas', 'lanzarote',
  'fuerteventura', 'la palma', 'la gomera', 'el hierro',
]

export function isCanaryIslands(address: string | null): boolean {
  if (!address) return false
  const lower = address.toLowerCase()
  if (/\b3[58]\d{3}\b/.test(address)) return true
  return CANARY_KEYWORDS.some((kw) => lower.includes(kw))
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
