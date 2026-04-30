// =============================================================
// Tests: generateCSV (resumen + detalle de pedidos)
// =============================================================

import { describe, it, expect } from 'vitest'
import { generateCSV, type CsvSummary, type CsvOrderRow } from '@/lib/metrics'

const sampleOrder: CsvOrderRow = {
  operation_id: 'HW-202604-0001',
  created_at: '2026-04-01T08:00:00Z',
  customer_name: 'KOINE CAFE S.L.',
  venue_name: 'Koine Cafe',
  purchase_type: 'hardware_one_off',
  amount: 1234.56,
  status: 'completado',
  supplier: 'Internal',
  products: 'Pack Pro x1',
  shipped_at: '2026-04-03T08:00:00Z',
  delivered_at: '2026-04-05T08:00:00Z',
}

describe('generateCSV', () => {
  it('emits only the detail block when no summary is provided', () => {
    const csv = generateCSV([sampleOrder])
    expect(csv).not.toContain('# Resumen del periodo')
    expect(csv).toContain('ID Operacion,Fecha')
    expect(csv).toContain('HW-202604-0001')
  })

  it('emits summary block before detail when summary is provided', () => {
    const summary: CsvSummary = {
      from: '2026-04-01',
      to: '2026-04-30',
      purchase_type: 'all',
      total_orders: 67,
      total_revenue: 58530.94,
      avg_order_value: 914.55,
      completed_rate: 84.1,
      ops_total_shipped: 25,
      ops_avg_handling_days: 2.1,
      ops_avg_transit_days: 8.6,
      ops_excluded_admin: 12,
    }
    const csv = generateCSV([sampleOrder], { summary })
    const lines = csv.split('\n')

    expect(lines[0]).toBe('# Resumen del periodo')
    expect(csv).toContain('Periodo,2026-04-01,2026-04-30')
    expect(csv).toContain('Tasa entrega exitosa (%),84.1')
    expect(csv).toContain('Pedidos enviados,25')
    expect(csv).toContain('Plazo medio manipulacion (dias),2.1')
    expect(csv).toContain('Excluidos del SLA fisico (SaaS/otro),12')
    expect(csv).toContain('# Detalle de pedidos')
    // detalle existe debajo
    expect(csv).toContain('HW-202604-0001')
  })

  it('skips ops_* lines that are undefined in the summary', () => {
    const summary: CsvSummary = {
      from: '2026-04-01',
      to: '2026-04-30',
      purchase_type: 'all',
      total_orders: 10,
      total_revenue: 1000,
      avg_order_value: 100,
      completed_rate: 50,
      // No ops_*
    }
    const csv = generateCSV([sampleOrder], { summary })
    expect(csv).not.toContain('Pedidos enviados')
    expect(csv).not.toContain('Plazo medio manipulacion')
    expect(csv).not.toContain('Excluidos del SLA fisico')
  })

  it('escapes double quotes in customer_name and products', () => {
    const tricky: CsvOrderRow = {
      ...sampleOrder,
      customer_name: 'Bar "El Rincon" S.L.',
      products: 'Pack "Premium" x2',
    }
    const csv = generateCSV([tricky])
    expect(csv).toContain('"Bar ""El Rincon"" S.L."')
    expect(csv).toContain('"Pack ""Premium"" x2"')
  })

  it('computes plazo manipulacion and plazo total when both timestamps exist', () => {
    const csv = generateCSV([sampleOrder])
    // shipped_at - created_at = 2 days
    expect(csv).toContain(',2.0,')
    // delivered_at - created_at = 4 days
    expect(csv).toContain(',4.0')
  })

  it('leaves empty plazos when shipped_at or delivered_at is missing', () => {
    const noShipping: CsvOrderRow = {
      ...sampleOrder,
      shipped_at: null,
      delivered_at: null,
    }
    const csv = generateCSV([noShipping])
    const lines = csv.split('\n')
    const detail = lines[lines.length - 1]
    // las dos ultimas columnas (plazos) deben estar vacias
    expect(detail.endsWith(',,')).toBe(true)
  })
})
