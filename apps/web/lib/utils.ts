import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { OrderStatus, PurchaseType } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  nuevo:               'Nuevo',
  en_revision:         'En revisión',
  falta_info:          'Falta info',
  aprobado:            'Aprobado',
  pedido_a_proveedor:  'Pedido a proveedor',
  en_transito:         'En tránsito',
  recibido:            'Recibido',
  preparacion:         'Preparación/Envío',
  completado:          'Completado',
  cancelado:           'Cancelado',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  nuevo:               'bg-blue-100 text-blue-800',
  en_revision:         'bg-yellow-100 text-yellow-800',
  falta_info:          'bg-orange-100 text-orange-800',
  aprobado:            'bg-green-100 text-green-800',
  pedido_a_proveedor:  'bg-purple-100 text-purple-800',
  en_transito:         'bg-indigo-100 text-indigo-800',
  recibido:            'bg-teal-100 text-teal-800',
  preparacion:         'bg-cyan-100 text-cyan-800',
  completado:          'bg-emerald-100 text-emerald-800',
  cancelado:           'bg-red-100 text-red-800',
}

export const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
  kit_digital:            'KIT Digital',
  hardware_one_off:       'Hardware One Off',
  hardware_financiacion:  'Hardware Financiación',
  transferencias_saas:    'Transferencias SaaS',
  otro:                   'Otro',
}

// Transiciones de estado permitidas por rol
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  nuevo:               ['en_revision', 'cancelado'],
  en_revision:         ['falta_info', 'aprobado', 'cancelado'],
  falta_info:          ['en_revision', 'cancelado'],
  aprobado:            ['pedido_a_proveedor', 'cancelado'],
  pedido_a_proveedor:  ['en_transito', 'cancelado'],
  en_transito:         ['recibido', 'cancelado'],
  recibido:            ['preparacion'],
  preparacion:         ['completado'],
  completado:          [],
  cancelado:           [],
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
