// =============================================================
// Tests: validacion de payload para POST /api/shipments/create
// =============================================================

import { describe, it, expect } from 'vitest'
import { validateShipmentBody } from '@/lib/shipments/validate-payload'

const validSender = {
  name: 'Hardware Depto',
  address: 'Calle Origen 1',
  cp: '28013',
  city: 'Madrid',
  phone: '912345678',
}

const validRecipient = {
  name: 'Bar Manolo S.L.',
  address: 'Calle Mayor 12',
  cp: '08001',
  city: 'Barcelona',
  phone: '933456789',
  email: 'manolo@bar.com',
  contact_person: 'Manolo',
}

const validBody = {
  sender: validSender,
  recipient: validRecipient,
  service_code: '48',
  packages: 1,
  weight_kg: 2.5,
  content: 'Hardware',
}

describe('validateShipmentBody — happy path', () => {
  it('acepta un body completo', () => {
    const r = validateShipmentBody(validBody)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.sender.name).toBe('Hardware Depto')
      expect(r.data.recipient.cp).toBe('08001')
      expect(r.data.packages).toBe(1)
      expect(r.data.return_shipment).toBe(false)
    }
  })

  it('aplica defaults: packages=1, weight_kg=1, return_shipment=false', () => {
    const r = validateShipmentBody({
      sender: validSender,
      recipient: validRecipient,
      service_code: '48',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.packages).toBe(1)
      expect(r.data.weight_kg).toBe(1)
      expect(r.data.return_shipment).toBe(false)
    }
  })

  it('trim de campos string', () => {
    const r = validateShipmentBody({
      ...validBody,
      sender: { ...validSender, name: '  Hardware Depto  ' },
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.sender.name).toBe('Hardware Depto')
  })
})

describe('validateShipmentBody — sender', () => {
  it('rechaza sin name', () => {
    const r = validateShipmentBody({
      ...validBody,
      sender: { ...validSender, name: '' },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/sender\.name/)
  })

  it('rechaza sin address', () => {
    const r = validateShipmentBody({
      ...validBody,
      sender: { ...validSender, address: '   ' },
    })
    expect(r.ok).toBe(false)
  })

  it('rechaza CP no 5 digitos', () => {
    expect(validateShipmentBody({ ...validBody, sender: { ...validSender, cp: '2801' } }).ok).toBe(false)
    expect(validateShipmentBody({ ...validBody, sender: { ...validSender, cp: '280131' } }).ok).toBe(false)
    expect(validateShipmentBody({ ...validBody, sender: { ...validSender, cp: '2801A' } }).ok).toBe(false)
  })

  it('rechaza sin city', () => {
    const r = validateShipmentBody({
      ...validBody,
      sender: { ...validSender, city: '' },
    })
    expect(r.ok).toBe(false)
  })
})

describe('validateShipmentBody — recipient', () => {
  it('rechaza CP no 5 digitos en recipient', () => {
    const r = validateShipmentBody({
      ...validBody,
      recipient: { ...validRecipient, cp: '0800' },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/recipient\.cp/)
  })

  it('contact_person opcional', () => {
    const { ...recipient } = validRecipient
    delete (recipient as Partial<typeof validRecipient>).contact_person
    const r = validateShipmentBody({ ...validBody, recipient })
    expect(r.ok).toBe(true)
  })
})

describe('validateShipmentBody — detalles', () => {
  it('rechaza service_code vacio', () => {
    const r = validateShipmentBody({ ...validBody, service_code: '' })
    expect(r.ok).toBe(false)
  })

  it('rechaza packages < 1', () => {
    const r = validateShipmentBody({ ...validBody, packages: 0 })
    expect(r.ok).toBe(false)
  })

  it('rechaza weight_kg <= 0', () => {
    expect(validateShipmentBody({ ...validBody, weight_kg: 0 }).ok).toBe(false)
    expect(validateShipmentBody({ ...validBody, weight_kg: -1 }).ok).toBe(false)
  })

  it('return_shipment se normaliza a boolean', () => {
    const r = validateShipmentBody({ ...validBody, return_shipment: true })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.return_shipment).toBe(true)
  })
})

describe('validateShipmentBody — body invalido', () => {
  it('rechaza null/undefined/string', () => {
    expect(validateShipmentBody(null).ok).toBe(false)
    expect(validateShipmentBody(undefined).ok).toBe(false)
    expect(validateShipmentBody('not an object').ok).toBe(false)
  })

  it('rechaza sender ausente', () => {
    const r = validateShipmentBody({ recipient: validRecipient, service_code: '48' })
    expect(r.ok).toBe(false)
  })

  it('rechaza recipient ausente', () => {
    const r = validateShipmentBody({ sender: validSender, service_code: '48' })
    expect(r.ok).toBe(false)
  })
})
