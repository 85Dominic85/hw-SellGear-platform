// =============================================================
// Tests: lib/external-query.ts
//
// Estos helpers eran privados dentro del listado de pedidos de HWToolbox, así
// que nunca se habían probado. Al compartirlos con el listado de envíos pasan
// a gobernar la paginación y la búsqueda de DOS endpoints externos, y uno de
// ellos —`ilikePattern`— es lo único que evita que un `q=%` liste la tabla
// entera.
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_OFFSET,
  addOneDay,
  clampInt,
  ilikePattern,
  isValidDate,
} from '@/lib/external-query'

describe('clampInt', () => {
  it('usa el fallback si no viene el param', () => {
    expect(clampInt(null, 1, MAX_LIMIT, DEFAULT_LIMIT)).toBe(DEFAULT_LIMIT)
    expect(clampInt('', 1, MAX_LIMIT, DEFAULT_LIMIT)).toBe(DEFAULT_LIMIT)
  })

  it('usa el fallback ante basura, en vez de devolver NaN', () => {
    // Un NaN colado en .range() rompe la query, no la acota.
    expect(clampInt('abc', 1, MAX_LIMIT, DEFAULT_LIMIT)).toBe(DEFAULT_LIMIT)
    expect(clampInt('../../etc', 0, MAX_OFFSET, 0)).toBe(0)
  })

  it('recorta por arriba y por abajo', () => {
    expect(clampInt('9999', 1, MAX_LIMIT, DEFAULT_LIMIT)).toBe(MAX_LIMIT)
    expect(clampInt('0', 1, MAX_LIMIT, DEFAULT_LIMIT)).toBe(1)
    expect(clampInt('-40', 0, MAX_OFFSET, 0)).toBe(0)
  })

  it('respeta un valor dentro de rango', () => {
    expect(clampInt('10', 1, MAX_LIMIT, DEFAULT_LIMIT)).toBe(10)
  })

  it('parseInt se queda con el entero de la izquierda', () => {
    expect(clampInt('12.9', 1, MAX_LIMIT, DEFAULT_LIMIT)).toBe(12)
    expect(clampInt('7abc', 1, MAX_LIMIT, DEFAULT_LIMIT)).toBe(7)
  })
})

describe('isValidDate', () => {
  it('acepta YYYY-MM-DD', () => {
    expect(isValidDate('2026-09-08')).toBe(true)
    expect(isValidDate('2026-01-01')).toBe(true)
  })

  it('rechaza otros formatos', () => {
    expect(isValidDate('08-09-2026')).toBe(false)
    expect(isValidDate('2026-9-8')).toBe(false)
    expect(isValidDate('2026-09-08T00:00:00Z')).toBe(false)
    expect(isValidDate('')).toBe(false)
  })

  it('rechaza un mes que no existe', () => {
    expect(isValidDate('2026-13-01')).toBe(false)
    expect(isValidDate('2026-00-01')).toBe(false)
  })

  it('LAXITUD CONOCIDA: acepta un dia que no existe en ese mes', () => {
    // `Date.parse('2026-02-30')` no devuelve NaN: rueda a 2026-03-02. Asi que
    // un `from=2026-02-30` no da 400, desplaza la ventana dos dias en
    // silencio. Es el comportamiento que ya tenia el listado de pedidos desde
    // que existe el endpoint, y este test lo fija para que un cambio sea
    // deliberado y no un efecto colateral. Endurecerlo cambiaria el contrato
    // externo, asi que se decide aparte.
    expect(isValidDate('2026-02-30')).toBe(true)
    expect(isValidDate('2026-04-31')).toBe(true)
  })
})

describe('addOneDay', () => {
  it('suma un día', () => {
    expect(addOneDay('2026-09-08')).toBe('2026-09-09')
  })

  it('cruza fin de mes', () => {
    expect(addOneDay('2026-09-30')).toBe('2026-10-01')
    expect(addOneDay('2026-02-28')).toBe('2026-03-01')
  })

  it('cruza fin de año', () => {
    expect(addOneDay('2026-12-31')).toBe('2027-01-01')
  })

  it('trabaja en UTC, así que no se desplaza por la zona horaria', () => {
    // Con `new Date('2026-09-08')` sin la T00:00:00Z, un runner en UTC-X
    // devolvería el día anterior. Por eso el helper fija la Z.
    expect(addOneDay('2026-01-01')).toBe('2026-01-02')
  })
})

describe('ilikePattern', () => {
  it('envuelve el texto en comodines', () => {
    expect(ilikePattern('Pepe')).toBe('%Pepe%')
  })

  it('escapa el % para que no sea un comodín del usuario', () => {
    // Sin esto, q=% hacía ILIKE '%%%' y devolvía la tabla completa.
    expect(ilikePattern('%')).toBe('%\\%%')
    expect(ilikePattern('50%')).toBe('%50\\%%')
  })

  it('escapa el _ , que en LIKE es "un carácter cualquiera"', () => {
    expect(ilikePattern('SH_2026')).toBe('%SH\\_2026%')
  })

  it('escapa todas las apariciones, no solo la primera', () => {
    expect(ilikePattern('a%b%c')).toBe('%a\\%b\\%c%')
    expect(ilikePattern('_%_')).toBe('%\\_\\%\\_%')
  })

  it('deja intacto el texto sin comodines', () => {
    expect(ilikePattern('SH-202609-0055')).toBe('%SH-202609-0055%')
  })
})
