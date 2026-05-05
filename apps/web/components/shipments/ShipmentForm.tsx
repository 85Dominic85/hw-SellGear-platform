'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AddressBookEntry } from '@/types/database'
import AddressPicker from '@/components/address-book/AddressPicker'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500'
const labelClass = 'mb-1 block text-xs font-medium text-gray-700'
const cardClass = 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4'

interface SenderState {
  name: string
  address: string
  cp: string
  city: string
  phone: string
}

interface RecipientState {
  name: string
  address: string
  cp: string
  city: string
  phone: string
  email: string
  contact_person: string
}

interface DetailsState {
  service_code: string
  packages: number
  weight_kg: number
  content: string
  observations: string
  return_shipment: boolean
  reference: string
}

const EMPTY_SENDER: SenderState = { name: '', address: '', cp: '', city: '', phone: '' }
const EMPTY_RECIPIENT: RecipientState = {
  name: '',
  address: '',
  cp: '',
  city: '',
  phone: '',
  email: '',
  contact_person: '',
}

interface ShipmentFormProps {
  services: { code: string; label: string }[]
}

export default function ShipmentForm({ services }: ShipmentFormProps) {
  const router = useRouter()
  const [sender, setSender] = useState<SenderState>(EMPTY_SENDER)
  const [recipient, setRecipient] = useState<RecipientState>(EMPTY_RECIPIENT)
  const [details, setDetails] = useState<DetailsState>({
    service_code: services[0]?.code ?? '48',
    packages: 1,
    weight_kg: 1,
    content: '',
    observations: '',
    return_shipment: false,
    reference: '',
  })
  const [pickerOpen, setPickerOpen] = useState<null | 'sender' | 'recipient'>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePickerSelect = (entry: AddressBookEntry) => {
    if (pickerOpen === 'sender') {
      setSender({
        name: entry.name,
        address: entry.address,
        cp: entry.cp,
        city: entry.city,
        phone: entry.phone ?? '',
      })
    } else if (pickerOpen === 'recipient') {
      setRecipient({
        name: entry.name,
        address: entry.address,
        cp: entry.cp,
        city: entry.city,
        phone: entry.phone ?? '',
        email: entry.email ?? '',
        contact_person: entry.contact_person ?? entry.name,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: {
            name: sender.name,
            address: sender.address,
            cp: sender.cp,
            city: sender.city,
            phone: sender.phone || null,
          },
          recipient: {
            name: recipient.name,
            address: recipient.address,
            cp: recipient.cp,
            city: recipient.city,
            phone: recipient.phone || null,
            email: recipient.email || null,
            contact_person: recipient.contact_person || null,
          },
          service_code: details.service_code,
          packages: details.packages,
          weight_kg: details.weight_kg,
          content: details.content || null,
          observations: details.observations || null,
          return_shipment: details.return_shipment,
          reference: details.reference || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          [data.error, data.detail].filter(Boolean).join(' — ') || 'Error desconocido',
        )
      }
      router.push(`/shipments/${data.shipment.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {/* Remitente */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Remitente</h2>
            <button
              type="button"
              onClick={() => setPickerOpen('sender')}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cargar de agenda
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Nombre / Razón social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={sender.name}
                onChange={(e) => setSender({ ...sender, name: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Dirección <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={sender.address}
                onChange={(e) => setSender({ ...sender, address: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>
                CP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={sender.cp}
                onChange={(e) => setSender({ ...sender, cp: e.target.value })}
                className={inputClass}
                pattern="\d{5}"
                maxLength={5}
                required
              />
            </div>
            <div>
              <label className={labelClass}>
                Ciudad <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={sender.city}
                onChange={(e) => setSender({ ...sender, city: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                type="tel"
                value={sender.phone}
                onChange={(e) => setSender({ ...sender, phone: e.target.value })}
                className={inputClass}
                maxLength={30}
              />
            </div>
          </div>
        </div>

        {/* Destinatario */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Destinatario</h2>
            <button
              type="button"
              onClick={() => setPickerOpen('recipient')}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cargar de agenda
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Nombre / Razón social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={recipient.name}
                onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Dirección <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={recipient.address}
                onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>
                CP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={recipient.cp}
                onChange={(e) => setRecipient({ ...recipient, cp: e.target.value })}
                className={inputClass}
                pattern="\d{5}"
                maxLength={5}
                required
              />
            </div>
            <div>
              <label className={labelClass}>
                Ciudad <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={recipient.city}
                onChange={(e) => setRecipient({ ...recipient, city: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                type="tel"
                value={recipient.phone}
                onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                className={inputClass}
                maxLength={30}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={recipient.email}
                onChange={(e) => setRecipient({ ...recipient, email: e.target.value })}
                className={inputClass}
                maxLength={200}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Persona de contacto</label>
              <input
                type="text"
                value={recipient.contact_person}
                onChange={(e) =>
                  setRecipient({ ...recipient, contact_person: e.target.value })
                }
                className={inputClass}
                maxLength={200}
              />
            </div>
          </div>
        </div>

        {/* Detalles del envío */}
        <div className={cardClass}>
          <h2 className="text-sm font-semibold text-gray-900">Detalles del envío</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Servicio TIPSA <span className="text-red-500">*</span>
              </label>
              <select
                value={details.service_code}
                onChange={(e) => setDetails({ ...details, service_code: e.target.value })}
                className={inputClass}
                required
              >
                {services.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Bultos</label>
                <input
                  type="number"
                  min={1}
                  value={details.packages}
                  onChange={(e) =>
                    setDetails({
                      ...details,
                      packages: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Peso (kg)</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={details.weight_kg}
                  onChange={(e) =>
                    setDetails({
                      ...details,
                      weight_kg: Math.max(0.1, parseFloat(e.target.value) || 1),
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Contenido</label>
              <input
                type="text"
                value={details.content}
                onChange={(e) => setDetails({ ...details, content: e.target.value })}
                placeholder="Ej: Hardware, recogida material..."
                className={inputClass}
                maxLength={200}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Observaciones</label>
              <textarea
                value={details.observations}
                onChange={(e) =>
                  setDetails({ ...details, observations: e.target.value })
                }
                placeholder="Instrucciones para el transportista..."
                className={`${inputClass} min-h-[60px]`}
                maxLength={500}
              />
            </div>
            <div>
              <label className={labelClass}>Referencia interna</label>
              <input
                type="text"
                value={details.reference}
                onChange={(e) => setDetails({ ...details, reference: e.target.value })}
                placeholder="Tu referencia (opcional)"
                className={inputClass}
                maxLength={100}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={details.return_shipment}
                  onChange={(e) =>
                    setDetails({ ...details, return_shipment: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Envío con retorno (boRetorno TIPSA)
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => router.push('/shipments')}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? 'Creando envío...' : 'Crear envío TIPSA'}
          </button>
        </div>
      </form>

      <AddressPicker
        open={pickerOpen !== null}
        onClose={() => setPickerOpen(null)}
        onSelect={handlePickerSelect}
        variant={pickerOpen ?? 'recipient'}
      />
    </>
  )
}
