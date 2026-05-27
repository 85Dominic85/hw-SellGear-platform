import type { OrderPayment } from '@/types/database'

interface FinancingProgressBadgeProps {
  payments: OrderPayment[] | null | undefined
  className?: string
}

/**
 * Alerta visual del progreso de pagos de un pedido de financiación.
 * Estados: Sin pagos (gris) · 1/3 (ámbar) · 2/3 (azul) · Completado (verde).
 */
export default function FinancingProgressBadge({
  payments,
  className = '',
}: FinancingProgressBadgeProps) {
  const total = payments?.length ?? 0
  const paid = (payments ?? []).filter((p) => p.status === 'pagado').length

  let label: string
  let color: string
  if (total === 0) {
    label = 'Sin plan'
    color = 'bg-gray-100 text-gray-600'
  } else if (paid === 0) {
    label = `Sin pagos · 0/${total}`
    color = 'bg-gray-100 text-gray-700'
  } else if (paid >= total) {
    label = `Completado · ${paid}/${total}`
    color = 'bg-green-100 text-green-800'
  } else if (paid === 1) {
    label = `Entrada · ${paid}/${total}`
    color = 'bg-amber-100 text-amber-800'
  } else {
    label = `En curso · ${paid}/${total}`
    color = 'bg-blue-100 text-blue-800'
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color} ${className}`}
    >
      {label}
    </span>
  )
}
