// =============================================================
// Tests: lib/catalog/order-link.ts y lib/catalog/format.ts
//
// El parser de `?sel=` recibe entrada de la URL, asi que se prueba sobre
// todo con basura: nunca debe lanzar y nunca debe devolver un `code` que no
// parezca un slug. El servidor revalida igualmente, pero un parser que
// lanza rompe la pagina entera.
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  MAX_PICKS,
  MAX_QTY,
  buildNewOrderHref,
  encodeCatalogPicks,
  parseCatalogPicks,
} from '@/lib/catalog/order-link'
import {
  formatCatalogAmount,
  formatCatalogPrice,
  normalizeSearch,
  priceSuffix,
} from '@/lib/catalog/format'

describe('parseCatalogPicks - camino normal', () => {
  it('parsea code:qty separados por coma', () => {
    expect(parseCatalogPicks('pack-pro:1,printer-wifi:2')).toEqual([
      { code: 'pack-pro', qty: 1 },
      { code: 'printer-wifi', qty: 2 },
    ])
  })

  it('sin cantidad asume 1', () => {
    expect(parseCatalogPicks('pack-pro')).toEqual([{ code: 'pack-pro', qty: 1 }])
  })

  it('deduplica sumando cantidades', () => {
    expect(parseCatalogPicks('pack-pro:2,pack-pro:3')).toEqual([
      { code: 'pack-pro', qty: 5 },
    ])
  })

  it('normaliza a minusculas y recorta espacios', () => {
    expect(parseCatalogPicks(' PACK-PRO :2')).toEqual([
      { code: 'pack-pro', qty: 2 },
    ])
  })

  it('acepta guion bajo (saas_hardware)', () => {
    expect(parseCatalogPicks('saas_hardware:1')).toEqual([
      { code: 'saas_hardware', qty: 1 },
    ])
  })
})

describe('parseCatalogPicks - entrada hostil', () => {
  it('vacio o nulo devuelve []', () => {
    expect(parseCatalogPicks(null)).toEqual([])
    expect(parseCatalogPicks(undefined)).toEqual([])
    expect(parseCatalogPicks('')).toEqual([])
    expect(parseCatalogPicks(',,,')).toEqual([])
  })

  it('descarta path traversal y caracteres raros', () => {
    expect(parseCatalogPicks('../../etc/passwd:1')).toEqual([])
    expect(parseCatalogPicks('<script>:1')).toEqual([])
    expect(parseCatalogPicks('pack pro:1')).toEqual([])
    expect(parseCatalogPicks('PACK/PRO:1')).toEqual([])
  })

  it('descarta cantidades no positivas', () => {
    expect(parseCatalogPicks('pack-pro:0')).toEqual([])
    expect(parseCatalogPicks('pack-pro:-5')).toEqual([])
    expect(parseCatalogPicks('pack-pro:abc')).toEqual([])
  })

  it('acota la cantidad al maximo', () => {
    expect(parseCatalogPicks('pack-pro:1000000000')).toEqual([
      { code: 'pack-pro', qty: MAX_QTY },
    ])
    expect(parseCatalogPicks('pack-pro:1e9')).toEqual([
      { code: 'pack-pro', qty: 1 },
    ])
  })

  it('trunca al maximo de lineas', () => {
    const raw = Array.from({ length: MAX_PICKS + 20 }, (_, i) => `sku-${i}:1`).join(',')
    expect(parseCatalogPicks(raw)).toHaveLength(MAX_PICKS)
  })

  it('descarta un code larguisimo', () => {
    expect(parseCatalogPicks(`${'a'.repeat(200)}:1`)).toEqual([])
  })

  it('nunca lanza', () => {
    for (const raw of ['::::', 'a:b:c:d', '%%%', ':1', 'a:', ' :1']) {
      expect(() => parseCatalogPicks(raw)).not.toThrow()
    }
  })
})

describe('encode / href', () => {
  it('round-trip', () => {
    const picks = [
      { code: 'pack-pro', qty: 1 },
      { code: 'printer-wifi', qty: 3 },
    ]
    expect(parseCatalogPicks(encodeCatalogPicks(picks))).toEqual(picks)
  })

  it('filtra lo invalido al codificar', () => {
    expect(encodeCatalogPicks([{ code: 'a b', qty: 1 }])).toBe('')
    expect(encodeCatalogPicks([{ code: 'pack-pro', qty: 0 }])).toBe('')
  })

  it('href sin seleccion apunta al wizard limpio', () => {
    expect(buildNewOrderHref([])).toBe('/orders/new')
  })

  it('href con seleccion lleva el parametro', () => {
    const href = buildNewOrderHref([{ code: 'pack-pro', qty: 2 }])
    expect(href).toContain('/orders/new?sel=')
    const raw = decodeURIComponent(href.split('sel=')[1])
    expect(parseCatalogPicks(raw)).toEqual([{ code: 'pack-pro', qty: 2 }])
  })
})

describe('formato de precios del catalogo', () => {
  it('los enteros van sin decimales, como en la web', () => {
    expect(formatCatalogAmount(49900)).toBe('499')
    expect(formatCatalogPrice(49900)).toBe('499 €')
    // es-ES tiene minimumGroupingDigits = 2: el separador de miles NO
    // aparece hasta 5 digitos. Es la tipografia correcta en espanol y es
    // exactamente lo que muestra el catalogo web, que usa el mismo
    // Intl.NumberFormat.
    expect(formatCatalogPrice(119900)).toBe('1199 €')
    expect(formatCatalogPrice(1250000)).toBe('12.500 €')
  })

  it('los no enteros llevan dos decimales', () => {
    expect(formatCatalogPrice(8360)).toBe('83,60 €')
    expect(formatCatalogPrice(53907)).toBe('539,07 €')
  })

  it('el sufijo distingue Canarias', () => {
    expect(priceSuffix(21)).toBe('+ IVA')
    expect(priceSuffix(0)).toBe('Precio final')
    expect(priceSuffix(null)).toBe('+ IVA')
  })
})

describe('normalizeSearch', () => {
  it('busca sin acentos en los dos sentidos', () => {
    // Fija el comportamiento: si el fichero se guardara con otra
    // codificacion y el rango de marcas combinantes se corrompiera, estos
    // asserts lo detectan.
    expect(normalizeSearch('Impresión')).toBe('impresion')
    expect(normalizeSearch('Báscula Minerva')).toBe('bascula minerva')
    expect(normalizeSearch('Cajón')).toBe('cajon')
    expect(normalizeSearch('TPV Estándar')).toBe('tpv estandar')
  })

  it('la enye pierde la tilde (igual que el catalogo web)', () => {
    // Efecto conocido de quitar marcas combinantes. Se conserva porque asi
    // el comercial encuentra el producto escriba como escriba, y ningun
    // nombre de producto depende de esa distincion.
    expect(normalizeSearch('España')).toBe('espana')
  })
})
