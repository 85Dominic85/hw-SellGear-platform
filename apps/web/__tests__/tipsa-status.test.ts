/**
 * Tests para los helpers de estado oficial TIPSA.
 *
 * Catalogo oficial de codigos (PDF "Documentacion WebServices 64.0_resumen_ES",
 * pag. 22), verificado uno a uno contra la web publica de TIPSA para el albaran
 * 0000012023:
 *   0 DOCUMENTADO · 1 TRANSITO · 2 REPARTO · 3 ENTREGADO · 4 INCIDENCIA
 *   5 DEVUELTO · 7 RECANALIZADO · 14 DISPONIBLE · 15 ENTREGA PARCIAL
 *
 * Los terminales son el 3 y el 5. Una vez llega uno, manda sobre cualquier
 * evento posterior: TIPSA sigue emitiendo lecturas despues de entregar.
 */

import { describe, expect, it } from 'vitest'
import {
  isIncidenceEvent,
  isTerminalEvent,
  resolveOfficialStatus,
  tipsaEventLabel,
} from '@/lib/tipsa/services'

interface E {
  code: string
  date: string
}

const ev = (code: string, date: string): E => ({ code, date })
const getCode = (e: E) => e.code

describe('tipsaEventLabel', () => {
  it('usa el catalogo oficial', () => {
    expect(tipsaEventLabel('0')).toBe('Documentado')
    expect(tipsaEventLabel('1')).toBe('En tránsito')
    expect(tipsaEventLabel('2')).toBe('En reparto')
    expect(tipsaEventLabel('3')).toBe('Entregado')
    expect(tipsaEventLabel('4')).toBe('Incidencia')
    expect(tipsaEventLabel('5')).toBe('Devuelto')
    expect(tipsaEventLabel('7')).toBe('Recanalizado')
    expect(tipsaEventLabel('14')).toBe('Disponible para recoger')
  })

  it('cae a "Estado {code}" con codigos fuera del catalogo', () => {
    // El 18 llega en produccion pero no esta en la tabla v64.0: no lo
    // inventamos.
    expect(tipsaEventLabel('18')).toBe('Estado 18')
    expect(tipsaEventLabel('99')).toBe('Estado 99')
  })
})

describe('isTerminalEvent', () => {
  it('solo 3 (Entregado) y 5 (Devuelto) cierran el recorrido', () => {
    expect(isTerminalEvent('3')).toBe(true)
    expect(isTerminalEvent('5')).toBe(true)
    // El 2 es REPARTO, no la entrega: el paquete sigue en la furgoneta.
    expect(isTerminalEvent('2')).toBe(false)
    expect(isTerminalEvent('4')).toBe(false)
    expect(isTerminalEvent('14')).toBe(false)
  })
})

describe('resolveOfficialStatus', () => {
  it('devuelve null si no hay eventos', () => {
    expect(resolveOfficialStatus<E>([], getCode)).toBeNull()
  })

  it('devuelve el unico evento cuando solo hay uno', () => {
    expect(resolveOfficialStatus([ev('0', '2026-05-01T10:00:00Z')], getCode)?.code).toBe('0')
  })

  // Recorrido real del albaran 0000012023 (horas Madrid), tal cual lo devuelve
  // ConsEnvEstados y tal cual lo pinta dinapaqweb.
  it('recorrido real completo: acaba en Entregado', () => {
    const events = [
      ev('0', '2026-09-07T14:07:00Z'), // 16:07 Documentado
      ev('1', '2026-09-07T14:35:00Z'), // 16:35 Transito
      ev('4', '2026-09-07T23:19:00Z'), // 01:19 Incidencia (otra direccion)
      ev('2', '2026-09-08T06:16:00Z'), // 08:16 Reparto
      ev('14', '2026-09-08T09:37:00Z'), // 11:37 Disponible
      ev('3', '2026-09-08T09:56:00Z'), // 11:56 Entregado
    ]
    expect(resolveOfficialStatus(events, getCode)?.code).toBe('3')
  })

  it('una lectura posterior a la entrega no la pisa', () => {
    const events = [
      ev('2', '2026-09-08T06:16:00Z'),
      ev('3', '2026-09-08T09:56:00Z'),
      ev('14', '2026-09-08T11:00:00Z'),
    ]
    expect(resolveOfficialStatus(events, getCode)?.code).toBe('3')
  })

  it('un codigo sin catalogar posterior tampoco pisa la entrega', () => {
    const events = [
      ev('3', '2026-09-08T09:56:00Z'),
      ev('18', '2026-09-08T11:00:00Z'),
    ]
    expect(resolveOfficialStatus(events, getCode)?.code).toBe('3')
  })

  it('sin terminal, el estado es el ultimo evento — incluida una incidencia', () => {
    const events = [
      ev('0', '2026-09-07T14:07:00Z'),
      ev('1', '2026-09-07T14:35:00Z'),
      ev('4', '2026-09-07T23:19:00Z'),
    ]
    expect(resolveOfficialStatus(events, getCode)?.code).toBe('4')
  })

  it('sin terminal, un codigo desconocido si es el estado oficial', () => {
    const events = [ev('1', '2026-09-07T14:35:00Z'), ev('18', '2026-09-08T11:00:00Z')]
    expect(resolveOfficialStatus(events, getCode)?.code).toBe('18')
  })

  it('un devuelto posterior a la entrega gana: es el ultimo terminal', () => {
    const events = [
      ev('3', '2026-09-08T07:20:00Z'),
      ev('5', '2026-09-09T11:00:00Z'),
    ]
    expect(resolveOfficialStatus(events, getCode)?.code).toBe('5')
  })

  it('el reparto (2) no cuenta como final: si no hay 3, el estado es 2', () => {
    const events = [ev('1', '2026-09-07T14:35:00Z'), ev('2', '2026-09-08T06:16:00Z')]
    expect(resolveOfficialStatus(events, getCode)?.code).toBe('2')
  })
})

describe('isIncidenceEvent', () => {
  it('solo el codigo 4', () => {
    expect(isIncidenceEvent('4')).toBe(true)
    // El 3 es la entrega, no una incidencia. Este era justo el error.
    expect(isIncidenceEvent('3')).toBe(false)
    expect(isIncidenceEvent('2')).toBe(false)
  })
})
