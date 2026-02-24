'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const POLL_INTERVAL = 30_000 // 30 seconds fallback

export default function RealtimeRefresh() {
  const router = useRouter()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Debounce refreshes to avoid multiple rapid revalidations
    const scheduleRefresh = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        router.refresh()
      }, 500)
    }

    // Realtime: instant updates via WebSocket
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        scheduleRefresh
      )
      .subscribe()

    // Polling: fallback every 30s in case Realtime misses an event
    const pollInterval = setInterval(() => {
      router.refresh()
    }, POLL_INTERVAL)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
