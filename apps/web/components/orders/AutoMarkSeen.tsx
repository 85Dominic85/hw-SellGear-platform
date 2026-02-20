'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AutoMarkSeen({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const router = useRouter()

  useEffect(() => {
    if (currentStatus !== 'nuevo') return

    fetch(`/api/orders/${orderId}/mark-seen`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.changed) router.refresh()
      })
      .catch(() => {})
  }, [orderId, currentStatus, router])

  return null
}
