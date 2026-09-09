/**
 * Tests para lib/tracking/steps.ts
 * -----------------------------------------------------------------------------
 * resolveTimelineSteps mapea la lista de shipping_events a los 4 pasos del
 * timeline horizontal en /tracking:
 *   0 Documentado · 1 En tránsito · 2 En reparto · 3 Entregado
 *
 * Codigos TIPSA (catalogo oficial, ver tipsa-status.test.ts):
 *   0 DOCUMENTADO · 1 TRANSITO · 2 REPARTO · 3 ENTREGADO · 4 INCIDENCIA
 *   5 DEVUELTO · 7 RECANALIZADO · 14 DISPONIBLE · 15 ENTREGA PARCIAL
 */

import { describe, expect, it } from 'vitest'
import {
  resolveTimelineSteps,
  timelineProgressPct,
  TIMELINE_STEP_LABELS,
} from '@/lib/tracking/steps'

const e = (event_code: string, event_date: string) => ({ event_code, event_date })

describe('resolveTimelineSteps', () => {
  it('con lista vacia devuelve 4 pasos pending muted', () => {
    const steps = resolveTimelineSteps([])
    expect(steps).toHaveLength(4)
    expect(steps.every((s) => s.status === 'pending' && s.tone === 'muted')).toBe(true)
    expect(steps.map((s) => s.label)).toEqual([...TIMELINE_STEP_LABELS])
  })

  it('solo Documentado -> paso 0 current', () => {
    const steps = resolveTimelineSteps([e('0', '2026-09-07T14:07:00Z')])
    expect(steps[0].status).toBe('current')
    expect(steps[0].tone).toBe('info')
    expect(steps[1].status).toBe('pending')
  })

  it('En transito -> paso 1 current, paso 0 done', () => {
    const steps = resolveTimelineSteps([
      e('0', '2026-09-07T14:07:00Z'),
      e('1', '2026-09-07T14:35:00Z'),
    ])
    expect(steps[0].status).toBe('done')
    expect(steps[1].status).toBe('current')
    expect(steps[1].tone).toBe('info')
  })

  it('Reparto (2) -> paso 2 current, NO entregado', () => {
    const steps = resolveTimelineSteps([
      e('1', '2026-09-07T14:35:00Z'),
      e('2', '2026-09-08T06:16:00Z'),
    ])
    expect(steps[2].status).toBe('current')
    expect(steps[2].tone).toBe('info')
    expect(steps[3].status).toBe('pending')
  })

  it('Entregado (3) -> paso 3 current, tono ok, 100%', () => {
    const steps = resolveTimelineSteps([
      e('2', '2026-09-08T06:16:00Z'),
      e('3', '2026-09-08T09:56:00Z'),
    ])
    expect(steps[3].status).toBe('current')
    expect(steps[3].tone).toBe('ok')
    expect(timelineProgressPct(steps)).toBe(100)
  })

  it('Devuelto (5) -> ultimo paso en tono crit', () => {
    const steps = resolveTimelineSteps([
      e('1', '2026-09-07T14:35:00Z'),
      e('5', '2026-09-09T11:00:00Z'),
    ])
    expect(steps[3].status).toBe('current')
    expect(steps[3].tone).toBe('crit')
  })

  // Recorrido real del albaran 0000012023.
  it('recorrido real completo -> Entregado', () => {
    const steps = resolveTimelineSteps([
      e('0', '2026-09-07T14:07:00Z'),
      e('1', '2026-09-07T14:35:00Z'),
      e('4', '2026-09-07T23:19:00Z'),
      e('2', '2026-09-08T06:16:00Z'),
      e('14', '2026-09-08T09:37:00Z'),
      e('3', '2026-09-08T09:56:00Z'),
    ])
    expect(steps[3].status).toBe('current')
    expect(steps[3].tone).toBe('ok')
    expect(timelineProgressPct(steps)).toBe(100)
  })
})

describe('codigos que no son un punto del recorrido', () => {
  it('una incidencia (4) no mueve la barra, solo tine el punto de ambar', () => {
    const steps = resolveTimelineSteps([
      e('0', '2026-09-07T14:07:00Z'),
      e('1', '2026-09-07T14:35:00Z'),
      e('4', '2026-09-07T23:19:00Z'),
    ])
    // Sigue en transito: la incidencia no le hace avanzar ni retroceder.
    expect(steps[1].status).toBe('current')
    expect(steps[1].tone).toBe('warn')
    expect(steps[2].status).toBe('pending')
  })

  it('Disponible (14) mantiene la barra en Reparto', () => {
    const steps = resolveTimelineSteps([
      e('2', '2026-09-08T06:16:00Z'),
      e('14', '2026-09-08T09:37:00Z'),
    ])
    expect(steps[2].status).toBe('current')
    expect(steps[3].status).toBe('pending')
  })

  it('un codigo desconocido (18) no hace retroceder la barra', () => {
    const steps = resolveTimelineSteps([
      e('1', '2026-09-07T14:35:00Z'),
      e('2', '2026-09-08T06:16:00Z'),
      e('18', '2026-09-08T08:00:00Z'),
    ])
    expect(steps[2].status).toBe('current')
  })

  it('un 14 despues del 3 no degrada un envio entregado', () => {
    const steps = resolveTimelineSteps([
      e('3', '2026-09-08T09:56:00Z'),
      e('14', '2026-09-08T11:00:00Z'),
    ])
    expect(steps[3].status).toBe('current')
    expect(steps[3].tone).toBe('ok')
    expect(timelineProgressPct(steps)).toBe(100)
  })

  it('solo eventos desconocidos -> se queda en Documentado', () => {
    const steps = resolveTimelineSteps([e('18', '2026-09-08T08:00:00Z')])
    expect(steps[0].status).toBe('current')
  })
})

describe('timelineProgressPct', () => {
  it('vacio -> 0', () => {
    expect(timelineProgressPct(resolveTimelineSteps([]))).toBe(0)
  })

  // El rail va de centro a centro de los puntos extremos: en step 0 la linea
  // mide 0 porque el arranque ES el primer punto.
  it('step 0 (documentado) -> 0%', () => {
    expect(timelineProgressPct(resolveTimelineSteps([e('0', '2026-09-07T14:07:00Z')]))).toBe(0)
  })

  it('step 1 (transito) -> 33%', () => {
    expect(timelineProgressPct(resolveTimelineSteps([e('1', '2026-09-07T14:35:00Z')]))).toBe(33)
  })

  it('step 2 (reparto) -> 67%', () => {
    expect(timelineProgressPct(resolveTimelineSteps([e('2', '2026-09-08T06:16:00Z')]))).toBe(67)
  })

  it('step 3 (entregado) -> 100%', () => {
    expect(timelineProgressPct(resolveTimelineSteps([e('3', '2026-09-08T09:56:00Z')]))).toBe(100)
  })
})
