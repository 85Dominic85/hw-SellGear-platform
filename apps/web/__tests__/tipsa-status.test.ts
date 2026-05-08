/**
 * Tests para los helpers de estado oficial TIPSA:
 *  - resolveOfficialStatus: ignora codigo 3 (Incidencia) post-entrega.
 *  - isPostDeliveryNote: detecta anotaciones tras un Entregado.
 *
 * TIPSA emite codigo 3 tanto para incidencias reales (antes de entregar)
 * como para anotaciones post-entrega del repartidor (ej. "entregado al portero").
 * El estado oficial debe ignorar estas anotaciones para no marcar como rojo
 * un envio que ya esta entregado correctamente.
 */

import { describe, expect, it } from 'vitest'
import { isPostDeliveryNote, resolveOfficialStatus } from '@/lib/tipsa/services'

interface E {
  code: string
  date: string
}

const ev = (code: string, date: string): E => ({ code, date })
const getCode = (e: E) => e.code

describe('resolveOfficialStatus', () => {
  it('returns null when there are no events', () => {
    expect(resolveOfficialStatus<E>([], getCode)).toBeNull()
  })

  it('returns the only event when there is one', () => {
    const events = [ev('1', '2026-05-01T10:00:00Z')]
    expect(resolveOfficialStatus(events, getCode)?.code).toBe('1')
  })

  it('returns the last event when none is a note (code 3)', () => {
    const events = [
      ev('1', '2026-05-01T08:00:00Z'),
      ev('4', '2026-05-01T12:00:00Z'),
      ev('5', '2026-05-02T07:00:00Z'),
      ev('2', '2026-05-02T10:45:00Z'),
    ]
    expect(resolveOfficialStatus(events, getCode)?.code).toBe('2')
  })

  it('ignores trailing code-3 notes after delivery (real bug case)', () => {
    // Caso real del usuario: TIPSA envia codigo 3 tras codigo 2.
    // El estado oficial sigue siendo Entregado (codigo 2).
    const events = [
      ev('1', '2026-05-04T15:02:00Z'),
      ev('4', '2026-05-04T18:32:00Z'),
      ev('5', '2026-05-05T08:47:00Z'),
      ev('5', '2026-05-06T07:05:00Z'),
      ev('2', '2026-05-06T10:45:00Z'),
      ev('3', '2026-05-06T12:45:00Z'), // anotacion post-entrega
    ]
    const resolved = resolveOfficialStatus(events, getCode)
    expect(resolved?.code).toBe('2')
    expect(resolved?.date).toBe('2026-05-06T10:45:00Z')
  })

  it('keeps code-3 as official when it is a real incident before any delivery', () => {
    // Si el unico evento "ultimo" es codigo 3 SIN un codigo 2 anterior,
    // sigue siendo el estado oficial (incidencia real).
    const events = [
      ev('1', '2026-05-01T08:00:00Z'),
      ev('4', '2026-05-01T15:00:00Z'),
      ev('3', '2026-05-02T10:00:00Z'),
    ]
    const resolved = resolveOfficialStatus(events, getCode)
    expect(resolved?.code).toBe('4') // ultimo no-codigo-3
  })

  it('returns the last event when ALL events are code 3', () => {
    // Edge case: solo incidencias. Devuelve la ultima.
    const events = [
      ev('3', '2026-05-01T08:00:00Z'),
      ev('3', '2026-05-02T10:00:00Z'),
    ]
    const resolved = resolveOfficialStatus(events, getCode)
    expect(resolved?.date).toBe('2026-05-02T10:00:00Z')
  })

  it('works with custom getCode function (ShippingEvent shape)', () => {
    // Verifica que la firma generica funciona con objetos que tienen
    // event_code en lugar de code (como las filas de la tabla shipping_events).
    interface DbRow {
      event_code: string
      event_date: string
    }
    const events: DbRow[] = [
      { event_code: '1', event_date: '2026-05-01T08:00:00Z' },
      { event_code: '2', event_date: '2026-05-02T10:00:00Z' },
      { event_code: '3', event_date: '2026-05-02T12:00:00Z' },
    ]
    const resolved = resolveOfficialStatus(events, (e) => e.event_code)
    expect(resolved?.event_code).toBe('2')
  })
})

describe('isPostDeliveryNote', () => {
  it('returns false for non code-3 events', () => {
    const events = [ev('1', '2026-05-01T08:00:00Z'), ev('2', '2026-05-02T10:00:00Z')]
    expect(isPostDeliveryNote(events, 0, getCode)).toBe(false)
    expect(isPostDeliveryNote(events, 1, getCode)).toBe(false)
  })

  it('returns true for code-3 that comes after a code-2', () => {
    const events = [
      ev('1', '2026-05-01T08:00:00Z'),
      ev('2', '2026-05-02T10:00:00Z'),
      ev('3', '2026-05-02T12:00:00Z'),
    ]
    expect(isPostDeliveryNote(events, 2, getCode)).toBe(true)
  })

  it('returns false for code-3 that comes BEFORE any code-2 (real incident)', () => {
    const events = [
      ev('1', '2026-05-01T08:00:00Z'),
      ev('3', '2026-05-01T15:00:00Z'),
      ev('4', '2026-05-02T10:00:00Z'),
    ]
    expect(isPostDeliveryNote(events, 1, getCode)).toBe(false)
  })

  it('returns false for out-of-bounds index', () => {
    const events = [ev('1', '2026-05-01T08:00:00Z')]
    expect(isPostDeliveryNote(events, 99, getCode)).toBe(false)
  })
})
