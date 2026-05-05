// =============================================================
// Validacion de payload para POST /api/shipments/create
// =============================================================

import type {
  ShipmentCreateInput,
  ShipmentSenderInput,
  ShipmentRecipientInput,
} from '@/types/database'

const CP_REGEX = /^\d{5}$/

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function trimOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

function trimOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function validateSender(raw: unknown): ValidationResult<ShipmentSenderInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'sender invalido.' }
  }
  const r = raw as Record<string, unknown>
  const name = trimOrEmpty(r.name)
  if (!name) return { ok: false, error: 'sender.name es obligatorio.' }
  const address = trimOrEmpty(r.address)
  if (!address) return { ok: false, error: 'sender.address es obligatorio.' }
  const cp = trimOrEmpty(r.cp)
  if (!CP_REGEX.test(cp)) return { ok: false, error: 'sender.cp debe ser 5 digitos.' }
  const city = trimOrEmpty(r.city)
  if (!city) return { ok: false, error: 'sender.city es obligatorio.' }
  return {
    ok: true,
    data: { name, address, cp, city, phone: trimOrNull(r.phone) },
  }
}

function validateRecipient(raw: unknown): ValidationResult<ShipmentRecipientInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'recipient invalido.' }
  }
  const r = raw as Record<string, unknown>
  const name = trimOrEmpty(r.name)
  if (!name) return { ok: false, error: 'recipient.name es obligatorio.' }
  const address = trimOrEmpty(r.address)
  if (!address) return { ok: false, error: 'recipient.address es obligatorio.' }
  const cp = trimOrEmpty(r.cp)
  if (!CP_REGEX.test(cp)) return { ok: false, error: 'recipient.cp debe ser 5 digitos.' }
  const city = trimOrEmpty(r.city)
  if (!city) return { ok: false, error: 'recipient.city es obligatorio.' }
  return {
    ok: true,
    data: {
      name,
      address,
      cp,
      city,
      phone: trimOrNull(r.phone),
      email: trimOrNull(r.email),
      contact_person: trimOrNull(r.contact_person),
    },
  }
}

export function validateShipmentBody(
  body: unknown,
): ValidationResult<ShipmentCreateInput> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body invalido.' }
  }
  const b = body as Record<string, unknown>

  const sender = validateSender(b.sender)
  if (!sender.ok) return sender

  const recipient = validateRecipient(b.recipient)
  if (!recipient.ok) return recipient

  const service_code = trimOrEmpty(b.service_code)
  if (!service_code) {
    return { ok: false, error: 'service_code es obligatorio.' }
  }

  const packagesRaw = b.packages
  const packages =
    typeof packagesRaw === 'number' && Number.isFinite(packagesRaw)
      ? Math.floor(packagesRaw)
      : 1
  if (packages < 1) return { ok: false, error: 'packages debe ser >= 1.' }

  const weightRaw = b.weight_kg
  const weight_kg =
    typeof weightRaw === 'number' && Number.isFinite(weightRaw) ? weightRaw : 1
  if (weight_kg <= 0) return { ok: false, error: 'weight_kg debe ser > 0.' }

  return {
    ok: true,
    data: {
      sender: sender.data,
      recipient: recipient.data,
      service_code,
      packages,
      weight_kg,
      content: trimOrNull(b.content),
      observations: trimOrNull(b.observations),
      return_shipment: b.return_shipment === true,
      saturday_delivery: b.saturday_delivery === true,
      reference: trimOrNull(b.reference),
      notes: trimOrNull(b.notes),
    },
  }
}
