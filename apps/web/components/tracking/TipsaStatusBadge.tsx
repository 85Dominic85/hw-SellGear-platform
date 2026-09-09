import { tipsaEventLabel } from '@/lib/tipsa/services'

/**
 * Tono semantico de un estado TIPSA. Separado del accent brand para que
 * "entregado / incidencia / devuelto" siempre lean igual sea cual sea la
 * marca del sitio.
 */
export type TipsaStatusTone = 'muted' | 'info' | 'ok' | 'warn' | 'crit'

/** Codigos que consideramos "en curso" (azul info). Todo lo intermedio. */
const IN_TRANSIT_CODES = new Set(['4', '5', '7', '8', '10', '11', '15', '18'])

export function toneForStatus(code: string | null | undefined): TipsaStatusTone {
  if (!code) return 'muted'
  if (code === '2') return 'ok'
  if (code === '3') return 'warn'
  if (code === '6') return 'crit'
  if (code === '0' || code === '1') return 'muted'
  if (IN_TRANSIT_CODES.has(code)) return 'info'
  return 'info'
}

const TONE_CLASSES: Record<TipsaStatusTone, string> = {
  muted: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  ok: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  warn: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  crit: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
}

const DOT_CLASSES: Record<TipsaStatusTone, string> = {
  muted: 'bg-gray-500',
  info: 'bg-blue-500',
  ok: 'bg-green-500',
  warn: 'bg-amber-500',
  crit: 'bg-red-500',
}

interface TipsaStatusBadgeProps {
  code: string | null | undefined
  /** Si se pasa un label custom, sobreescribe el mapeo automatico. */
  label?: string
  /** Tamano visual. Default 'sm'. */
  size?: 'sm' | 'xs'
}

export default function TipsaStatusBadge({
  code,
  label,
  size = 'sm',
}: TipsaStatusBadgeProps) {
  const tone = toneForStatus(code)
  const text = label ?? (code ? tipsaEventLabel(code) : 'Sin estado')
  const sizeClass = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-semibold ${sizeClass} ${TONE_CLASSES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      {text}
    </span>
  )
}
