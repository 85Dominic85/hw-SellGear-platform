/**
 * Tests para lib/tracking/steps.ts
 * -----------------------------------------------------------------------------
 * resolveTimelineSteps mapea la lista de shipping_events a los 5 pasos del
 * timeline horizontal en /tracking.
 */

import { describe, expect, it } from 'vitest'
import {
  resolveTimelineSteps,
  timelineProgressPct,
  TIMELINE_STEP_LABELS,
} from '@/lib/tracking/steps'

const e = (event_code: string, event_date: string) => ({ event_code, event_date })

describe('resolveTimelineSteps', () => {
  it('con lista vacia devuelve 5 pasos pending muted', () => {
    const steps = resolveTimelineSteps([])
    expect(steps).toHaveLength(5)
    expect(steps.every((s) => s.status === 'pending' && s.tone === 'muted')).toBe(true)
    expect(steps.map((s) => s.label)).toEqual([...TIMELINE_STEP_LABELS])
  })

  it('solo Alta -> paso 0 current info', () => {
    const steps = resolveTimelineSteps([e('1', '2026-05-01T10:00:00Z')])
    expect(steps[0].status).toBe('current')
    expect(steps[0].tone).toBe('info')
    expect(steps[1].status).toBe('pending')
  })

  it('En transito -> paso 1 current, paso 0 done', () => {
    const steps = resolveTimelineSteps([
      e('1', '2026-05-01T10:00:00Z'),
      e('4', '2026-05-01T15:00:00Z'),
    ])
    expect(steps[0].status).toBe('done')
    expect(steps[1].status).toBe('current')
    expect(steps[1].tone).toBe('info')
    expect(steps[2].status).toBe('pending')
  })

  it('Entregado -> paso 4 current ok, todos anteriores done', () => {
    const steps = resolveTimelineSteps([
      e('1', '2026-05-01T10:00:00Z'),
      e('4', '2026-05-01T15:00:00Z'),
      e('5', '2026-05-02T08:00:00Z'),
      e('2', '2026-05-02T10:00:00Z'),
    ])
    expect(steps[4].status).toBe('current')
    expect(steps[4].tone).toBe('ok')
    expect(steps.slice(0, 4).every((s) => s.status === 'done')).toBe(true)
  })

  it('Codigo 3 tras Entregado NO cambia el paso: sigue en Entregado ok', () => {
    // Bug real: TIPSA emite 3 despues de 2 como anotacion post-entrega.
    const steps = resolveTimelineSteps([
      e('1', '2026-05-01T10:00:00Z'),
      e('4', '2026-05-01T15:00:00Z'),
      e('2', '2026-05-02T10:00:00Z'),
      e('3', '2026-05-02T12:00:00Z'), // anotacion post-entrega
    ])
    expect(steps[4].status).toBe('current')
    expect(steps[4].tone).toBe('ok') // sigue ok, no warn
  })

  it('Codigo 3 SIN Entregado previo -> se muestra warn en paso de transito', () => {
    // Incidencia real: no ha llegado.
    const steps = resolveTimelineSteps([
      e('1', '2026-05-01T10:00:00Z'),
      e('4', '2026-05-01T15:00:00Z'),
      e('3', '2026-05-02T09:00:00Z'), // incidencia real
    ])
    // El estado oficial es 4 (ultimo no-3), asi que step 1 current info.
    expect(steps[1].status).toBe('current')
    expect(steps[1].tone).toBe('info')
  })

  it('Devuelto (codigo 6) -> paso final crit', () => {
    const steps = resolveTimelineSteps([
      e('1', '2026-05-01T10:00:00Z'),
      e('4', '2026-05-01T15:00:00Z'),
      e('6', '2026-05-03T10:00:00Z'),
    ])
    expect(steps[4].status).toBe('current')
    expect(steps[4].tone).toBe('crit')
  })

  it('En reparto (codigo 5) -> paso 3 current info', () => {
    const steps = resolveTimelineSteps([
      e('1', '2026-05-01T10:00:00Z'),
      e('4', '2026-05-01T15:00:00Z'),
      e('5', '2026-05-02T09:00:00Z'),
    ])
    expect(steps[3].status).toBe('current')
    expect(steps[3].tone).toBe('info')
  })

  it('acepta eventos desordenados y los ordena internamente', () => {
    const steps = resolveTimelineSteps([
      e('2', '2026-05-02T10:00:00Z'),
      e('1', '2026-05-01T10:00:00Z'),
      e('4', '2026-05-01T15:00:00Z'),
    ])
    expect(steps[4].status).toBe('current')
    expect(steps[4].tone).toBe('ok')
  })

  it('codigos nuevos (7, 18) caen en tránsito por defecto', () => {
    const steps = resolveTimelineSteps([
      e('1', '2026-05-01T10:00:00Z'),
      e('18', '2026-05-01T18:00:00Z'),
    ])
    expect(steps[1].status).toBe('current')
    expect(steps[1].tone).toBe('info')
  })
})

describe('codigos sin catalogar tras la entrega', () => {
  // Mismo caso real que en tipsa-status.test.ts: sin la regla "terminal gana",
  // CODE_TO_STEP['14'] no existe y el fallback lo mandaba al paso 1 (transito),
  // haciendo retroceder la barra de un envio ya entregado.
  it('un 14 despues del 2 no mueve la barra hacia atras', () => {
    const steps = resolveTimelineSteps([
      e('0', '2026-09-07T12:07:00Z'),
      e('1', '2026-09-07T12:35:00Z'),
      e('4', '2026-09-07T21:19:00Z'),
      e('2', '2026-09-08T07:20:00Z'),
      e('14', '2026-09-08T09:37:04Z'),
    ])
    expect(steps[4].status).toBe('current')
    expect(steps[4].tone).toBe('ok')
    expect(timelineProgressPct(steps)).toBe(100)
  })
})

describe('timelineProgressPct', () => {
  it('vacio -> 0', () => {
    const steps = resolveTimelineSteps([])
    expect(timelineProgressPct(steps)).toBe(0)
  })

  // El rail va de centro a centro de los puntos extremos: en step 0 la linea
  // mide 0 porque el arranque ES el primer punto.
  it('step 0 (documentado) -> 0%', () => {
    const steps = resolveTimelineSteps([e('1', '2026-05-01T10:00:00Z')])
    expect(timelineProgressPct(steps)).toBe(0)
  })

  it('step 2 (HUB destino) -> 50%', () => {
    const steps = resolveTimelineSteps([e('10', '2026-05-01T10:00:00Z')])
    expect(timelineProgressPct(steps)).toBe(50)
  })

  it('step 4 (entregado) -> 100%', () => {
    const steps = resolveTimelineSteps([e('2', '2026-05-02T10:00:00Z')])
    expect(timelineProgressPct(steps)).toBe(100)
  })
})
