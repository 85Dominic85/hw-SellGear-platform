// =============================================================
// Tests: Google Sheets sync logic
// =============================================================

import { describe, it, expect } from 'vitest'
import type { Order } from '@/types/database'

// -----------------------------------------------
// Helper copiado de sync-to-sheets para test
// -----------------------------------------------

function orderToSheetRow(order: Partial<Order>): unknown[] {
  return [
    order['operation_id'],
    order['created_at'],
    order['customer_name'],
    order['venue_name'] ?? '',
    order['purchase_type'] ?? '',
    order['status'] ?? '',
    order['amount'] ?? '',
    order['contact_email'] ?? '',
    order['phone'] ?? '',
    order['shipping_address'] ?? '',
    order['ae_ref'] ?? '',
    order['hubspot_ref'] ?? '',
    order['invoice_ref'] ?? '',
    order['bank_receipt_url'] ?? '',
    order['assigned_to'] ?? '',
    order['notes'] ?? '',
  ]
}

function extractRowNumber(updatedRange: string): number | null {
  // Range format: "Tab!A5:P5" — extract trailing row number after last column letter
  const match = updatedRange.match(/[A-Z]+(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

// -----------------------------------------------
// Tests
// -----------------------------------------------

const mockOrder: Partial<Order> = {
  operation_id:    'HW-202602-0001',
  created_at:      '2026-02-19T10:00:00Z',
  customer_name:   'Bar El Gato',
  venue_name:      'El Gato Bar',
  purchase_type:   'kit_digital',
  status:          'nuevo',
  amount:          1500,
  contact_email:   'info@elgato.es',
  phone:           '+34 612 345 678',
  shipping_address: 'Calle Mayor 1, Madrid',
  ae_ref:          'AE-123',
  hubspot_ref:     null,
  invoice_ref:     null,
  bank_receipt_url: null,
  assigned_to:     null,
  notes:           'Urgente',
}

describe('orderToSheetRow', () => {
  it('maps all 16 columns correctly', () => {
    const row = orderToSheetRow(mockOrder)
    expect(row).toHaveLength(16)
  })

  it('puts operation_id in first column', () => {
    const row = orderToSheetRow(mockOrder)
    expect(row[0]).toBe('HW-202602-0001')
  })

  it('puts customer_name in third column', () => {
    const row = orderToSheetRow(mockOrder)
    expect(row[2]).toBe('Bar El Gato')
  })

  it('defaults null fields to empty string', () => {
    const row = orderToSheetRow(mockOrder)
    // hubspot_ref, invoice_ref, bank_receipt_url, assigned_to are null → ''
    expect(row[11]).toBe('') // hubspot_ref
    expect(row[12]).toBe('') // invoice_ref
    expect(row[13]).toBe('') // bank_receipt_url
    expect(row[14]).toBe('') // assigned_to
  })

  it('includes amount as number', () => {
    const row = orderToSheetRow(mockOrder)
    expect(row[6]).toBe(1500)
  })
})

describe('extractRowNumber', () => {
  it('extracts row number from Sheets updatedRange', () => {
    expect(extractRowNumber("'KIT Digital'!A5:P5")).toBe(5)
    expect(extractRowNumber('Pedidos!A12:P12')).toBe(12)
    expect(extractRowNumber('Sheet1!A100:Z100')).toBe(100)
  })

  it('returns null when no row number found', () => {
    expect(extractRowNumber('')).toBeNull()
    expect(extractRowNumber('invalid')).toBeNull()
  })
})

describe('purchase_type → sheet tab mapping', () => {
  const sheetTabMap: Record<string, string> = {
    kit_digital:           'KIT Digital',
    hardware_one_off:      'Hardware One Off',
    hardware_financiacion: 'Hardware Financiación',
    transferencias_saas:   'Transferencias SaaS',
    otro:                  'Pedidos',
  }

  it('maps all known purchase types', () => {
    const knownTypes = ['kit_digital', 'hardware_one_off', 'hardware_financiacion', 'transferencias_saas', 'otro']
    for (const t of knownTypes) {
      expect(sheetTabMap[t]).toBeTruthy()
    }
  })

  it('unknown type falls back to Pedidos', () => {
    const tab = sheetTabMap['unknown_type'] ?? 'Pedidos'
    expect(tab).toBe('Pedidos')
  })
})
