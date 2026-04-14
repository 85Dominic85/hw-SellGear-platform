// =============================================================
// SLA Utilities — Calculo y visualizacion de dias de entrega
// SLA target: 7 dias desde created_at hasta delivered_at
// =============================================================

export type SlaStatus = 'on_track' | 'warning' | 'breached'

/**
 * Calcula los dias transcurridos entre creacion y entrega (o ahora si no entregado).
 * Devuelve dias con 1 decimal.
 */
export function getDaysElapsed(
  createdAt: string,
  deliveredAt?: string | null
): number {
  const start = new Date(createdAt).getTime()
  const end = deliveredAt ? new Date(deliveredAt).getTime() : Date.now()
  const days = (end - start) / (1000 * 60 * 60 * 24)
  return Math.round(days * 10) / 10
}

/**
 * Determina el estado SLA basado en los dias transcurridos.
 * 0-4d = on_track, 5-6d = warning, 7d+ = breached
 */
export function getSlaStatus(days: number): SlaStatus {
  if (days <= 4) return 'on_track'
  if (days <= 6) return 'warning'
  return 'breached'
}

/**
 * Clases Tailwind para el badge SLA segun estado.
 */
export function getSlaColor(status: SlaStatus): string {
  switch (status) {
    case 'on_track':
      return 'bg-green-100 text-green-800'
    case 'warning':
      return 'bg-amber-100 text-amber-800'
    case 'breached':
      return 'bg-red-100 text-red-800'
  }
}

/**
 * Color del icono SLA segun estado.
 */
export function getSlaIconColor(status: SlaStatus): string {
  switch (status) {
    case 'on_track':
      return 'text-green-500'
    case 'warning':
      return 'text-amber-500'
    case 'breached':
      return 'text-red-500'
  }
}

/**
 * Formatea los dias para mostrar: "2d", "5.5d", "8d"
 */
export function formatDaysElapsed(days: number): string {
  if (days < 1) return '<1d'
  if (Number.isInteger(days)) return `${days}d`
  return `${days.toFixed(1)}d`
}

/**
 * Etiqueta descriptiva del estado SLA.
 */
export function getSlaLabel(status: SlaStatus): string {
  switch (status) {
    case 'on_track':
      return 'En plazo'
    case 'warning':
      return 'En riesgo'
    case 'breached':
      return 'Fuera de plazo'
  }
}

/** SLA target en dias */
export const SLA_TARGET_DAYS = 7
