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
} from '@/lib/utils'
import type { OrderStatus } from '@/types/database'

const ALL_STATUSES: OrderStatus[] = [
  'nuevo', 'en_revision', 'falta_info', 'aprobado',
  'pedido_a_proveedor', 'en_transito', 'recibido',
  'preparacion', 'completado', 'cancelado',
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
  it('completado has no transitions', () => {
    expect(STATUS_TRANSITIONS['completado']).toHaveLength(0)
  })

  it('cancelado has no transitions', () => {
    expect(STATUS_TRANSITIONS['cancelado']).toHaveLength(0)
  })

  it('nuevo can go to en_revision or cancelado', () => {
    expect(STATUS_TRANSITIONS['nuevo']).toContain('en_revision')
    expect(STATUS_TRANSITIONS['nuevo']).toContain('cancelado')
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
