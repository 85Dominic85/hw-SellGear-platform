// =============================================================
// Tests: lib/catalog-taxonomy.ts
//
// La taxonomia paso a ser carga estructural con el toggle de Canarias del
// wizard: la pestaña activa determina la REGION, y la region determina que
// lista de precios ve el comercial. Si CATALOG_TABS se desincroniza, el
// wizard podria mezclar precios peninsulares y canarios en un pedido — que
// es exactamente lo que el toggle existe para impedir.
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  CANARIAS_TAB,
  CATALOG_TABS,
  CATEGORY_ORDER,
  PRODUCT_CATEGORIES,
  catalogTab,
  categoryLabel,
  categoryMeta,
  categoryShortLabel,
  isCatalogTabKey,
} from '@/lib/catalog-taxonomy'

describe('CATALOG_TABS', () => {
  it('son 8: las 7 familias peninsulares mas Canarias', () => {
    expect(CATALOG_TABS).toHaveLength(8)
    expect(CATALOG_TABS.filter((t) => t.region === 'peninsula')).toHaveLength(7)
    expect(CATALOG_TABS.filter((t) => t.region === 'canarias')).toHaveLength(1)
  })

  it('las peninsulares filtran por categoria; Canarias por region', () => {
    for (const t of CATALOG_TABS) {
      if (t.region === 'peninsula') {
        expect(t.category).toBe(t.key)
      } else {
        // Canarias NO es una categoria: es un eje ortogonal. Su pestaña no
        // debe filtrar por category o se comeria los 8 SKU canarios.
        expect(t.category).toBeNull()
      }
    }
  })

  it('van en orden comercial, no alfabetico', () => {
    expect(CATALOG_TABS.map((t) => t.key)).toEqual([
      'pack', 'tpv', 'kds', 'printer', 'accessory', 'network', 'service',
      'canarias',
    ])
  })

  it('Canarias es la ultima: es la excepcion, no una familia mas', () => {
    expect(CATALOG_TABS[CATALOG_TABS.length - 1].key).toBe(CANARIAS_TAB.key)
  })

  it('cada pestaña tiene etiqueta, frase e icono', () => {
    for (const t of CATALOG_TABS) {
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.short.length).toBeGreaterThan(0)
      expect(t.prompt.length).toBeGreaterThan(0)
      expect(t.icon.length).toBeGreaterThan(0)
    }
  })

  it('las etiquetas cortas no se repiten (se pintan en una sola fila)', () => {
    const cortas = CATALOG_TABS.map((t) => t.short)
    expect(new Set(cortas).size).toBe(cortas.length)
  })
})

describe('la region sale de la pestaña activa', () => {
  it('la pestaña de Canarias resuelve a region canarias', () => {
    expect(catalogTab('canarias')?.region).toBe('canarias')
  })

  it('cualquier pestaña de familia resuelve a peninsula', () => {
    for (const key of ['pack', 'tpv', 'kds', 'printer', 'accessory', 'network', 'service'] as const) {
      expect(catalogTab(key)?.region).toBe('peninsula')
    }
  })

  it('una pestaña inexistente devuelve null y no revienta', () => {
    expect(catalogTab('no-existe' as never)).toBeNull()
    expect(catalogTab(null)).toBeNull()
    expect(catalogTab(undefined)).toBeNull()
  })
})

describe('las pestañas del wizard excluyen Canarias', () => {
  it('el filtro por region peninsula da exactamente las 7 familias', () => {
    // Es lo que Step2Catalog usa como visibleTabs: en el wizard la region la
    // gobierna el toggle de envio, no una pestaña, para que no haya dos vias
    // de llegar a la lista canaria.
    const wizard = CATALOG_TABS.filter((t) => t.region === 'peninsula').map((t) => t.key)
    expect(wizard).toEqual([
      'pack', 'tpv', 'kds', 'printer', 'accessory', 'network', 'service',
    ])
    expect(wizard).not.toContain('canarias')
  })
})

describe('categorias', () => {
  it('service existe y custom no es pestaña', () => {
    expect(categoryMeta('service')?.tab).toBe(true)
    expect(categoryMeta('custom')?.tab).toBe(false)
  })

  it('saas_hardware sigue teniendo etiqueta durante la ventana de despliegue', () => {
    // El SQL se aplica a mano, asi que la BD puede devolver la categoria vieja
    // mientras el build ya lleva la nueva. Sin etiqueta, ese producto se
    // quedaria sin nombre de familia en la UI.
    expect(categoryMeta('saas_hardware')).not.toBeNull()
    expect(categoryMeta('saas_hardware')?.tab).toBe(false)
  })

  it('degrada sin romper si llega una categoria desconocida', () => {
    expect(categoryShortLabel(null)).toBe('Otros')
    expect(categoryLabel(undefined)).toBe('Otros')
    expect(categoryShortLabel('inventada' as never)).toBe('Otros')
  })

  it('CATEGORY_ORDER deriva del mismo orden que las pestañas', () => {
    const soloPestanas = CATEGORY_ORDER.filter((k) => categoryMeta(k)?.tab)
    expect(soloPestanas).toEqual(
      CATALOG_TABS.filter((t) => t.category).map((t) => t.category),
    )
  })

  it('no hay claves de categoria duplicadas', () => {
    const keys = PRODUCT_CATEGORIES.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('isCatalogTabKey', () => {
  it('acepta las pestañas reales y "all"', () => {
    expect(isCatalogTabKey('all')).toBe(true)
    expect(isCatalogTabKey('canarias')).toBe(true)
    expect(isCatalogTabKey('service')).toBe(true)
  })

  it('rechaza lo que no es pestaña (gobierna /catalogo/[categoria])', () => {
    expect(isCatalogTabKey('custom')).toBe(false)
    expect(isCatalogTabKey('saas_hardware')).toBe(false)
    expect(isCatalogTabKey('../etc/passwd')).toBe(false)
    expect(isCatalogTabKey('')).toBe(false)
  })
})
