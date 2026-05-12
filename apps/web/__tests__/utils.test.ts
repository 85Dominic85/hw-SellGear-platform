// =============================================================
// Tests: utilidades de la app (STATUS_TRANSITIONS, formatCurrency…)
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_TRANSITIONS,
  formatCurrency,
  formatDate,
  isCanaryIslands,
} from '@/lib/utils'
import type { OrderStatus } from '@/types/database'

const ALL_STATUSES: OrderStatus[] = [
  'nuevo', 'pendiente', 'enviado_proveedor', 'enviado',
  'pagado', 'falta_informacion', 'bloqueado', 'completado',
]

describe('STATUS_LABELS', () => {
  it('has a label for every status', () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy()
    }
  })
})

describe('STATUS_COLORS', () => {
  it('has a color class for every status', () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_COLORS[s]).toBeTruthy()
    }
  })
})

describe('STATUS_TRANSITIONS', () => {
  // 'completado' es semi-terminal: solo puede revertirse a 'nuevo' o 'pendiente'
  // (decision de producto). El resto de estados puede transicionar a todos los demas.
  const SEMI_TERMINAL: OrderStatus[] = ['completado']

  it('non-terminal statuses can transition to all others', () => {
    for (const s of ALL_STATUSES) {
      if (SEMI_TERMINAL.includes(s)) continue
      expect(STATUS_TRANSITIONS[s].length).toBe(ALL_STATUSES.length - 1)
    }
  })

  it('completado is semi-terminal (solo se puede revertir)', () => {
    expect(STATUS_TRANSITIONS['completado']).toEqual(['nuevo', 'pendiente'])
  })

  it('no status can transition to itself', () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_TRANSITIONS[s]).not.toContain(s)
    }
  })

  it('nuevo can go to pendiente', () => {
    expect(STATUS_TRANSITIONS['nuevo']).toContain('pendiente')
  })

  it('all transition targets are valid statuses', () => {
    for (const [, targets] of Object.entries(STATUS_TRANSITIONS)) {
      for (const t of targets) {
        expect(ALL_STATUSES).toContain(t)
      }
    }
  })
})

describe('formatCurrency', () => {
  it('formats euros correctly', () => {
    const result = formatCurrency(1500)
    expect(result).toMatch(/1\.?500/)
    expect(result).toMatch(/€/)
  })

  it('returns em dash for null', () => {
    expect(formatCurrency(null)).toBe('—')
  })

  it('handles zero', () => {
    const result = formatCurrency(0)
    expect(result).toMatch(/0/)
  })
})

describe('formatDate', () => {
  it('formats ISO date to es-ES', () => {
    const result = formatDate('2026-02-19T10:00:00Z')
    expect(result).toMatch(/19/)
    expect(result).toMatch(/02/)
    expect(result).toMatch(/2026/)
  })

  it('returns em dash for null', () => {
    expect(formatDate(null)).toBe('—')
  })
})

describe('isCanaryIslands', () => {
  it('matches CP exacto 35xxx (Las Palmas)', () => {
    expect(isCanaryIslands('35001')).toBe(true)
    expect(isCanaryIslands('35660')).toBe(true)
  })

  it('matches CP exacto 38xxx (Santa Cruz de Tenerife)', () => {
    expect(isCanaryIslands('38001')).toBe(true)
    expect(isCanaryIslands('38500')).toBe(true)
  })

  it('matches dirección legacy con CP canario embebido', () => {
    expect(isCanaryIslands('Avda Real 12, 35001 Las Palmas')).toBe(true)
    expect(isCanaryIslands('Calle del Sol 8, 38500 Güímar')).toBe(true)
  })

  it('NO matchea direcciones con "canarias" en el nombre de calle pero CP peninsular', () => {
    expect(isCanaryIslands('Calle Canarias 5, 28001 Madrid')).toBe(false)
    expect(isCanaryIslands('Avda Tenerife 10, 41010 Sevilla')).toBe(false)
    expect(isCanaryIslands('Plaza Lanzarote 3, 08001 Barcelona')).toBe(false)
  })

  it('NO matchea CP peninsular', () => {
    expect(isCanaryIslands('28001')).toBe(false)
    expect(isCanaryIslands('41010')).toBe(false)
    expect(isCanaryIslands('08001')).toBe(false)
  })

  it('NO matchea CP fuera del rango canario aunque empiece por 3', () => {
    expect(isCanaryIslands('30001')).toBe(false) // Murcia
    expect(isCanaryIslands('33001')).toBe(false) // Asturias
    expect(isCanaryIslands('37001')).toBe(false) // Salamanca
  })

  it('handles null y vacío', () => {
    expect(isCanaryIslands(null)).toBe(false)
    expect(isCanaryIslands('')).toBe(false)
    expect(isCanaryIslands('   ')).toBe(false)
  })
})
