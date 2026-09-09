'use client'

/**
 * Orquestador cliente de la vista /tracking.
 *
 * Recibe el snapshot inicial de entries desde el server. Aplica filtros en
 * memoria (rango fecha, tipo, solo mios). Escucha cambios Realtime en las
 * tablas orders / shipments / shipping_events y hace router.refresh() con
 * debounce 500 ms para traer el snapshot nuevo del server.
 *
 * Persiste kanbanOpen en localStorage para respetar la preferencia entre
 * sesiones (empieza cerrado por defecto — timeline es el foco).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { TrackingEntry } from '@/lib/tracking/types'
import TrackingFilters, {
  type FiltersState,
  type DateRange,
} from './TrackingFilters'
import TrackingTimelineSection from './TrackingTimelineSection'
import TrackingKanbanSection from './TrackingKanbanSection'

const KANBAN_OPEN_KEY = 'tracking:kanban-open'
const REFRESH_DEBOUNCE_MS = 500

interface TrackingBoardProps {
  entries: TrackingEntry[]
  currentUserId: string | null
}

export default function TrackingBoard({
  entries,
  currentUserId,
}: TrackingBoardProps) {
  const router = useRouter()
  const [filters, setFilters] = useState<FiltersState>({
    range: 'active',
    onlyMine: false,
    kind: 'all',
  })
  const [kanbanOpen, setKanbanOpen] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Restaurar preferencia kanban al montar.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KANBAN_OPEN_KEY)
      if (stored === '1') setKanbanOpen(true)
    } catch {
      // ignore (private browsing, etc.)
    }
  }, [])

  const persistKanban = useCallback((open: boolean) => {
    setKanbanOpen(open)
    try {
      localStorage.setItem(KANBAN_OPEN_KEY, open ? '1' : '0')
    } catch {
      // ignore
    }
  }, [])

  // ------- Realtime -------
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      router.refresh()
      setLastRefresh(new Date())
    }, REFRESH_DEBOUNCE_MS)
  }, [router])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('tracking-board')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments' },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipping_events' },
        scheduleRefresh,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [scheduleRefresh])

  // ------- Filtros en memoria -------
  const filtered = useMemo(() => {
    return entries.filter((e) => matchesFilters(e, filters, currentUserId))
  }, [entries, filters, currentUserId])

  const liveHint = `Actualizado hace ${relative(lastRefresh)}`

  return (
    <div className="space-y-6">
      <TrackingFilters value={filters} onChange={setFilters} liveHint={liveHint} />
      <TrackingTimelineSection entries={filtered} />
      <TrackingKanbanSection
        entries={filtered}
        open={kanbanOpen}
        onToggle={persistKanban}
      />
    </div>
  )
}

// ---------------- helpers ----------------

function matchesFilters(
  e: TrackingEntry,
  filters: FiltersState,
  currentUserId: string | null,
): boolean {
  if (filters.kind === 'orders' && e.kind !== 'order') return false
  if (filters.kind === 'shipments' && e.kind !== 'shipment') return false
  if (filters.onlyMine && (!currentUserId || e.createdBy !== currentUserId)) return false
  if (!withinRange(e, filters.range)) return false
  return true
}

function withinRange(e: TrackingEntry, range: DateRange): boolean {
  if (range === 'active') {
    // "Activos" = no entregados ni devueltos (no tienen delivered_at o su estado
    // no es terminal). Descartar tambien pedidos muy viejos entregados hace >30d.
    if (!e.deliveredAt) return true
    const ageMs = Date.now() - new Date(e.deliveredAt).getTime()
    return ageMs < 30 * 24 * 3600 * 1000
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const cutoff = Date.now() - days * 24 * 3600 * 1000
  const ref = e.shippedAt ?? e.trackingLastCheckedAt
  if (!ref) return true
  return new Date(ref).getTime() >= cutoff
}

function relative(d: Date): string {
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}
