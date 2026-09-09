/**
 * Tests para el orden de la lista de /tracking.
 *
 * Existe porque este orden ya se ha equivocado tres veces: primero agrupaba por
 * urgencia (un envio de julio encabezaba la tabla), luego desempataba por
 * tracking_last_checked_at (cuando lo consultamos NOSOTROS, no cuando paso algo)
 * y luego por la fecha del ultimo evento (el backfill toca decenas de envios en
 * el mismo minuto y la lista salia barajada).
 *
 * La regla buena: por numero de pedido, del mas alto al mas bajo.
 */

import { describe, expect, it } from 'vitest'
import { orderKey } from '@/components/tracking/TrackingTimelineSection'

const desc = (ids: string[]) => [...ids].sort((a, b) => orderKey(b) - orderKey(a))

describe('orderKey', () => {
  it('el pedido mas nuevo queda arriba dentro del mismo mes', () => {
    expect(desc(['HW-202609-2048', 'HW-202609-2055', 'HW-202609-2049'])).toEqual([
      'HW-202609-2055',
      'HW-202609-2049',
      'HW-202609-2048',
    ])
  })

  it('el mes manda sobre la secuencia', () => {
    // 202608-9999 es de agosto: va por debajo de cualquiera de septiembre.
    expect(desc(['HW-202608-9999', 'HW-202609-2016'])).toEqual([
      'HW-202609-2016',
      'HW-202608-9999',
    ])
  })

  it('el prefijo no decide: HW y SH se ordenan por su numero', () => {
    // Ordenando la cadena entera, "SH-..." iria antes que "HW-..." porque la S
    // va despues de la H. Aqui manda la secuencia.
    expect(desc(['SH-202609-0056', 'HW-202609-2055'])).toEqual([
      'HW-202609-2055',
      'SH-202609-0056',
    ])
  })

  it('un identificador con formato raro no revienta ni se cuela arriba', () => {
    expect(orderKey('sin-formato')).toBe(0)
    expect(desc(['sin-formato', 'HW-202609-2001'])[0]).toBe('HW-202609-2001')
  })
})
