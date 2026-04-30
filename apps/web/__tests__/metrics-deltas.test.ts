// =============================================================
// Tests: helpers de metricas (calcDelta, getDateRange, groupByWeek)
// =============================================================

import { describe, it, expect } from 'vitest'
import { calcDelta, groupByWeek } from '@/lib/metrics'

describe('calcDelta', () => {
  it('returns null when both current and previous are 0', () => {
    expect(calcDelta(0, 0)).toBeNull()
  })

  it('returns 100 when previous is 0 and current is positive', () => {
    expect(calcDelta(10, 0)).toBe(100)
    expect(calcDelta(1, 0)).toBe(100)
  })

  it('returns null when previous is 0 and current is also 0', () => {
    expect(calcDelta(0, 0)).toBeNull()
  })

  it('returns negative delta when current is below previous', () => {
    expect(calcDelta(50, 100)).toBe(-50)
    expect(calcDelta(80, 100)).toBe(-20)
  })

  it('returns positive delta when current is above previous', () => {
    expect(calcDelta(150, 100)).toBe(50)
    expect(calcDelta(120, 100)).toBe(20)
  })

  it('rounds to integer percentage', () => {
    expect(calcDelta(101, 100)).toBe(1)
    expect(calcDelta(99, 100)).toBe(-1)
  })

  it('handles small fractional changes by rounding to 0', () => {
    expect(calcDelta(100.4, 100)).toBe(0)
  })
})

describe('groupByWeek', () => {
  it('returns an empty array for empty input', () => {
    expect(groupByWeek([])).toEqual([])
  })

  it('groups daily entries by ISO week (Monday)', () => {
    const result = groupByWeek([
      { date: '2026-04-06', count: 2, revenue: 100 }, // lunes
      { date: '2026-04-07', count: 1, revenue: 50 }, // martes
      { date: '2026-04-13', count: 3, revenue: 200 }, // lunes siguiente
    ])

    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2026-04-06')
    expect(result[0].count).toBe(3)
    expect(result[0].revenue).toBe(150)
    expect(result[1].date).toBe('2026-04-13')
    expect(result[1].count).toBe(3)
    expect(result[1].revenue).toBe(200)
  })
})
