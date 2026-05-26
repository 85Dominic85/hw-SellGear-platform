// =============================================================
// Tests: fieldRequirementsFor + isShippingRequired + isPhoneRequired
//
// Regla central: transferencias_saas no exige envio ni telefono;
// el resto de tipos exigen TODOS los campos del BASE.
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  fieldRequirementsFor,
  isShippingRequired,
  isPhoneRequired,
} from '@/lib/order-requirements'
import type { PurchaseType } from '@/types/database'

const ALL_TYPES: PurchaseType[] = [
  'kit_digital',
  'hardware_one_off',
  'hardware_financiacion',
  'transferencias_saas',
  'saas_hardware',
  'otro',
]

describe('fieldRequirementsFor', () => {
  it('para transferencias_saas: phone=false, shipping=false; resto true', () => {
    const r = fieldRequirementsFor('transferencias_saas')
    expect(r.phone).toBe(false)
    expect(r.shipping).toBe(false)
    // El resto siguen obligatorios
    expect(r.customer_name).toBe(true)
    expect(r.contact_email).toBe(true)
    expect(r.requester_name).toBe(true)
    expect(r.requester_email).toBe(true)
    expect(r.hubspot_ref).toBe(true)
    expect(r.bank_receipt_url).toBe(true)
  })

  it('para el resto de tipos: TODOS los campos son true', () => {
    const physicalTypes: PurchaseType[] = [
      'kit_digital',
      'hardware_one_off',
      'hardware_financiacion',
      'saas_hardware',
      'otro',
    ]
    for (const t of physicalTypes) {
      const r = fieldRequirementsFor(t)
      expect(r, `tipo ${t}`).toEqual({
        requester_name: true,
        requester_email: true,
        customer_name: true,
        contact_email: true,
        phone: true,
        hubspot_ref: true,
        bank_receipt_url: true,
        shipping: true,
      })
    }
  })

  it('para null / undefined (purchase_type no seleccionado todavia) usa BASE', () => {
    expect(fieldRequirementsFor(null).shipping).toBe(true)
    expect(fieldRequirementsFor(undefined).shipping).toBe(true)
  })

  it('cubre los 6 PurchaseType del union sin lanzar', () => {
    for (const t of ALL_TYPES) {
      expect(() => fieldRequirementsFor(t)).not.toThrow()
    }
  })

  it('emails (contact_email y requester_email) son obligatorios en TODOS los tipos', () => {
    for (const t of ALL_TYPES) {
      const r = fieldRequirementsFor(t)
      expect(r.contact_email, `contact_email en ${t}`).toBe(true)
      expect(r.requester_email, `requester_email en ${t}`).toBe(true)
    }
  })
})

describe('isShippingRequired', () => {
  it('false solo para transferencias_saas', () => {
    expect(isShippingRequired('transferencias_saas')).toBe(false)
    expect(isShippingRequired('hardware_one_off')).toBe(true)
    expect(isShippingRequired('kit_digital')).toBe(true)
    expect(isShippingRequired('saas_hardware')).toBe(true)
  })
})

describe('isPhoneRequired', () => {
  it('false solo para transferencias_saas', () => {
    expect(isPhoneRequired('transferencias_saas')).toBe(false)
    expect(isPhoneRequired('hardware_one_off')).toBe(true)
    expect(isPhoneRequired('otro')).toBe(true)
  })
})
