// =============================================================
// Tests: Typeform webhook parsing y validación
// Ejecutar con: npx vitest (o jest si se configura)
// =============================================================

import { describe, it, expect } from 'vitest'

// -----------------------------------------------
// Helpers copiados de la Edge Function para test
// -----------------------------------------------

type TypeformAnswer = {
  field: { id: string; ref: string; type: string }
  type: string
  text?: string
  email?: string
  phone_number?: string
  number?: number
  choice?: { label: string }
  file_url?: string
}

function getAnswerValue(answer: TypeformAnswer): string | number | null {
  switch (answer.type) {
    case 'text':
    case 'short_text':
    case 'long_text':
      return answer.text ?? null
    case 'email':
      return answer.email ?? null
    case 'phone_number':
      return answer.phone_number ?? null
    case 'number':
      return answer.number ?? null
    case 'choice':
      return answer.choice?.label ?? null
    default:
      return null
  }
}

function normalizeString(s: string | number | null): string | null {
  if (s == null) return null
  return String(s).trim() || null
}

function normalizePurchaseType(raw: string | null): string | null {
  if (!raw) return null
  const map: Record<string, string> = {
    'kit digital':            'kit_digital',
    'kit_digital':            'kit_digital',
    'hardware one off':       'hardware_one_off',
    'hardware_one_off':       'hardware_one_off',
    'hardware financiación':  'hardware_financiacion',
    'hardware financiacion':  'hardware_financiacion',
    'hardware_financiacion':  'hardware_financiacion',
    'transferencias saas':    'transferencias_saas',
    'transferencias_saas':    'transferencias_saas',
    'saas + hardware':        'saas_hardware',
    'saas+hardware':          'saas_hardware',
    'saas hardware':          'saas_hardware',
    'saas_hardware':          'saas_hardware',
  }
  return map[raw.toLowerCase()] ?? 'otro'
}

// -----------------------------------------------
// Tests
// -----------------------------------------------

describe('getAnswerValue', () => {
  it('extracts text answers', () => {
    const answer: TypeformAnswer = {
      field: { id: '1', ref: 'customer_name', type: 'short_text' },
      type: 'short_text',
      text: 'Juan García',
    }
    expect(getAnswerValue(answer)).toBe('Juan García')
  })

  it('extracts email answers', () => {
    const answer: TypeformAnswer = {
      field: { id: '2', ref: 'contact_email', type: 'email' },
      type: 'email',
      email: 'juan@bar.es',
    }
    expect(getAnswerValue(answer)).toBe('juan@bar.es')
  })

  it('extracts number answers', () => {
    const answer: TypeformAnswer = {
      field: { id: '3', ref: 'amount', type: 'number' },
      type: 'number',
      number: 1250.5,
    }
    expect(getAnswerValue(answer)).toBe(1250.5)
  })

  it('extracts choice answers', () => {
    const answer: TypeformAnswer = {
      field: { id: '4', ref: 'purchase_type', type: 'multiple_choice' },
      type: 'choice',
      choice: { label: 'Kit Digital' },
    }
    expect(getAnswerValue(answer)).toBe('Kit Digital')
  })

  it('returns null for unknown type', () => {
    const answer: TypeformAnswer = {
      field: { id: '5', ref: 'unknown', type: 'matrix' },
      type: 'matrix',
    }
    expect(getAnswerValue(answer)).toBeNull()
  })
})

describe('normalizeString', () => {
  it('trims whitespace', () => {
    expect(normalizeString('  hola  ')).toBe('hola')
  })

  it('returns null for empty string', () => {
    expect(normalizeString('')).toBeNull()
    expect(normalizeString('   ')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(normalizeString(null)).toBeNull()
  })

  it('coerces numbers to string', () => {
    expect(normalizeString(42)).toBe('42')
  })
})

describe('normalizePurchaseType', () => {
  it('normalizes Kit Digital variants', () => {
    expect(normalizePurchaseType('Kit Digital')).toBe('kit_digital')
    expect(normalizePurchaseType('kit digital')).toBe('kit_digital')
    expect(normalizePurchaseType('KIT DIGITAL')).toBe('kit_digital')
  })

  it('normalizes Hardware One Off', () => {
    expect(normalizePurchaseType('Hardware One Off')).toBe('hardware_one_off')
    expect(normalizePurchaseType('hardware one off')).toBe('hardware_one_off')
  })

  it('normalizes Hardware Financiación', () => {
    expect(normalizePurchaseType('Hardware Financiación')).toBe('hardware_financiacion')
    expect(normalizePurchaseType('Hardware Financiacion')).toBe('hardware_financiacion')
  })

  it('normalizes Transferencias SaaS', () => {
    expect(normalizePurchaseType('Transferencias SaaS')).toBe('transferencias_saas')
    expect(normalizePurchaseType('TRANSFERENCIAS SAAS')).toBe('transferencias_saas')
  })

  it('normalizes SaaS + Hardware variants', () => {
    expect(normalizePurchaseType('SaaS + Hardware')).toBe('saas_hardware')
    expect(normalizePurchaseType('saas hardware')).toBe('saas_hardware')
    expect(normalizePurchaseType('SAAS+HARDWARE')).toBe('saas_hardware')
    expect(normalizePurchaseType('saas_hardware')).toBe('saas_hardware')
  })

  it('defaults unknown to "otro"', () => {
    expect(normalizePurchaseType('Algo desconocido')).toBe('otro')
  })

  it('handles null input', () => {
    expect(normalizePurchaseType(null)).toBeNull()
  })
})

describe('sheet tab mapping from purchase type', () => {
  const sheetTabMap: Record<string, string> = {
    kit_digital:           'KIT Digital',
    hardware_one_off:      'Hardware One Off',
    hardware_financiacion: 'Hardware Financiación',
    transferencias_saas:   'Transferencias SaaS',
    // saas_hardware reusa la pestana de Transferencias SaaS para agrupar
    // todo lo que toca software en el Sheet.
    saas_hardware:         'Transferencias SaaS',
    otro:                  'Pedidos',
  }

  it('maps each purchase_type to the correct sheet tab', () => {
    expect(sheetTabMap['kit_digital']).toBe('KIT Digital')
    expect(sheetTabMap['hardware_one_off']).toBe('Hardware One Off')
    expect(sheetTabMap['hardware_financiacion']).toBe('Hardware Financiación')
    expect(sheetTabMap['transferencias_saas']).toBe('Transferencias SaaS')
    expect(sheetTabMap['saas_hardware']).toBe('Transferencias SaaS')
    expect(sheetTabMap['otro']).toBe('Pedidos')
  })
})
