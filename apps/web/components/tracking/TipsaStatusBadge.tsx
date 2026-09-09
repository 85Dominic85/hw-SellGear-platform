import { cn, tipsaStatusColor } from '@/lib/utils'
import { tipsaEventLabel } from '@/lib/tipsa/services'

interface TipsaStatusBadgeProps {
  code: string | null | undefined
  /** Sobreescribe el label derivado del codigo. */
  label?: string
  className?: string
}

/**
 * Badge del estado TIPSA. Misma forma que StatusBadge / ShipmentStatusBadge
 * para que convivan sin chirriar cuando aparecen en la misma pantalla.
 */
export default function TipsaStatusBadge({
  code,
  label,
  className,
}: TipsaStatusBadgeProps) {
  const text = label ?? (code ? tipsaEventLabel(code) : 'Sin estado')
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tipsaStatusColor(code),
        className,
      )}
    >
      {text}
    </span>
  )
}
