import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLORS, cn } from '@/lib/utils'
import type { ShipmentStatus } from '@/types/database'

interface ShipmentStatusBadgeProps {
  status: ShipmentStatus
  className?: string
}

export default function ShipmentStatusBadge({
  status,
  className,
}: ShipmentStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        SHIPMENT_STATUS_COLORS[status],
        className,
      )}
    >
      {SHIPMENT_STATUS_LABELS[status]}
    </span>
  )
}
