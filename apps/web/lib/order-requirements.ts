// =============================================================
// Reglas de campos obligatorios al crear un pedido en /orders/new.
//
// Fuente unica de verdad: cliente y servidor importan este modulo
// para decidir que campos exigir segun purchase_type. Cero divergencia.
//
// Reglas (decision 2026-05-26):
//   - contact_email y requester_email son OBLIGATORIOS en todos los
//     tipos (antes eran opcionales).
//   - transferencias_saas NO exige envio (es una transferencia bancaria
//     por un acuerdo SaaS, sin paquete fisico) ni telefono.
//   - El resto de tipos exigen direccion + telefono como hoy.
//
// Si se anade un nuevo PurchaseType, el helper sigue funcionando con
// BASE (todo obligatorio). Anadir override aqui si el nuevo tipo lo
// requiere.
// =============================================================

import type { PurchaseType } from '@/types/database'

export interface FieldRequirements {
  requester_name: boolean
  requester_email: boolean
  customer_name: boolean
  contact_email: boolean
  phone: boolean
  hubspot_ref: boolean
  bank_receipt_url: boolean
  /** Cubre shipping_street + shipping_cp + shipping_city como bloque. */
  shipping: boolean
}

const BASE: FieldRequirements = {
  requester_name: true,
  requester_email: true,
  customer_name: true,
  contact_email: true,
  phone: true,
  hubspot_ref: true,
  bank_receipt_url: true,
  shipping: true,
}

const SAAS_OVERRIDES: Partial<FieldRequirements> = {
  phone: false,
  shipping: false,
}

export function fieldRequirementsFor(t: PurchaseType | null | undefined): FieldRequirements {
  if (t === 'transferencias_saas') return { ...BASE, ...SAAS_OVERRIDES }
  return BASE
}

export function isShippingRequired(t: PurchaseType | null | undefined): boolean {
  return fieldRequirementsFor(t).shipping
}

export function isPhoneRequired(t: PurchaseType | null | undefined): boolean {
  return fieldRequirementsFor(t).phone
}
