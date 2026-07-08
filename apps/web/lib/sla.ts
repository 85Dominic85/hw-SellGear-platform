// =============================================================
// SLA Utilities — Calculo y visualizacion de dias de entrega
// SLA target: 7 dias desde created_at hasta delivered_at
// =============================================================

/** Estados posibles del SLA:
 *  - on_track / warning / breached: reloj activo, franja de dias.
 *  - paused: el pedido esta en un estado que PARA el reloj (hoy solo
 *    'bloqueado'). El badge muestra los dias congelados en el momento
 *    en que entro en pausa.
 */
export type SlaStatus = 'on_track' | 'warning' | 'breached' | 'paused'

/**
 * Calcula los dias transcurridos entre creacion y "fin del reloj".
 *
 * Fin del reloj (por orden de prioridad):
 *   1. deliveredAt (si el pedido esta entregado / completado).
 *   2. pausedAt (si el pedido esta en un estado que pausa el reloj,
 *      ej. 'bloqueado' → usamos updated_at como aproximacion del
 *      momento en que entro en pausa).
 *   3. Date.now() (reloj activo).
 *
 * Devuelve dias con 1 decimal.
 */
export function getDaysElapsed(
  createdAt: string,
  deliveredAt?: string | null,
  pausedAt?: string | null,
): number {
  const start = new Date(createdAt).getTime()
  const endTs = deliveredAt
    ? new Date(deliveredAt).getTime()
    : pausedAt
      ? new Date(pausedAt).getTime()
      : Date.now()
  const days = (endTs - start) / (1000 * 60 * 60 * 24)
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
    case 'paused':
      return 'bg-gray-100 text-gray-700'
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
    case 'paused':
      return 'text-gray-500'
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
    case 'paused':
      return 'Pausado'
  }
}

/** SLA target en dias */
export const SLA_TARGET_DAYS = 7
