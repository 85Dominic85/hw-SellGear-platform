/**
 * Tests para categorize() en lib/tracking/types.ts — el reparto de columnas del
 * kanban de /tracking.
 *
 * Existe por una razon concreta: cuando se corrigio el catalogo de codigos de
 * TIPSA (2026-09-09), esta funcion se quedo con el mapa viejo y nadie se dio
 * cuenta porque no tenia tests. El kanban metia las entregas reales en la
 * columna "Incidencia" y daba por entregado lo que solo iba en reparto.
 *
 * Catalogo oficial: 0 DOCUMENTADO · 1 TRANSITO · 2 REPARTO · 3 ENTREGADO
 * 4 INCIDENCIA · 5 DEVUELTO · 6 FALTA DE EXPEDICION · 7 RECANALIZADO
 * 9 FALTA EXPED. ADMIN · 10 DESTRUIDO · 14 DISPONIBLE · 15 ENTREGA PARCIAL
 */

import { describe, expect, it } from 'vitest'
import { categorize } from '@/lib/tracking/types'

describe('categorize', () => {
  it('sin codigo o recien documentado -> pending', () => {
    expect(categorize(null)).toBe('pending')
    expect(categorize(undefined)).toBe('pending')
    expect(categorize('')).toBe('pending')
    expect(categorize('0')).toBe('pending')
  })

  it('solo el codigo 3 es una entrega', () => {
    expect(categorize('3')).toBe('delivered')
  })

  it('el 2 es REPARTO, no una entrega: sigue en transito', () => {
    // Este era el fallo: el paquete va en la furgoneta, no ha llegado.
    expect(categorize('2')).toBe('transit')
  })

  it('en transito: 1, 2, 7, 14, 15', () => {
    expect(categorize('1')).toBe('transit')
    expect(categorize('7')).toBe('transit')
    expect(categorize('14')).toBe('transit')
    expect(categorize('15')).toBe('transit')
  })

  it('incidencias: 4, 6, 9 — y NO el 3', () => {
    expect(categorize('4')).toBe('incident')
    expect(categorize('6')).toBe('incident')
    expect(categorize('9')).toBe('incident')
    // El 3 es la entrega. Confundirlos era el bug.
    expect(categorize('3')).not.toBe('incident')
  })

  it('devueltos: 5 y 10', () => {
    expect(categorize('5')).toBe('returned')
    expect(categorize('10')).toBe('returned')
  })

  it('un codigo sin catalogar cae en transito, no en entregado', () => {
    // El 18 llega en produccion y no esta en la tabla oficial. Ante la duda,
    // "sigue en camino" es la suposicion segura: nunca damos por entregado
    // ni por incidente algo que no sabemos leer.
    expect(categorize('18')).toBe('transit')
    expect(categorize('99')).toBe('transit')
  })
})
