'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'

interface ServiceOption {
  code: string
  label: string
}

interface RecipientPreviewData {
  /** Local / nombre comercial (ej. "Churrería Veracruz"). Prioritario en la
   *  línea DES: de la etiqueta TIPSA. */
  venueName: string | null
  /** Persona / razón social del comprador (ej. "Johnny Osorio"). Va como
   *  "P.C." (persona de contacto) y como fallback si no hay venue. */
  customerName: string | null
  /** Dirección estructurada (primario; misma lógica que el route de creación). */
  shippingStreet: string | null
  shippingCp: string | null
  shippingCity: string | null
  /** Dirección "legacy" en una sola línea. Fallback si no hay estructurada. */
  shippingAddress: string | null
  phone: string | null
}

interface CreateShipmentModalProps {
  orderId: string
  services: ServiceOption[]
  defaultContent?: string
  defaultPackages?: number
  /** Datos del destinatario para previsualizar el bloque DES/P.C. de la
   *  etiqueta TIPSA antes de crear el envío. Solo lectura. */
  recipient: RecipientPreviewData
  onClose: () => void
}

export default function CreateShipmentModal({
  orderId,
  services,
  defaultContent,
  defaultPackages,
  recipient,
  onClose,
}: CreateShipmentModalProps) {
  const router = useRouter()
  const [serviceCode, setServiceCode] = useState(services[0]?.code ?? '48')
  const [packages, setPackages] = useState(Math.max(1, defaultPackages ?? 1))
  const [weightKg, setWeightKg] = useState(1)
  const [content, setContent] = useState(defaultContent ?? 'Productos hardware')
  const [observations, setObservations] = useState('')
  const [returnShipment, setReturnShipment] = useState(false)
  const [saturdayDelivery, setSaturdayDelivery] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [loading, onClose])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setLoading(true)
      try {
        const res = await fetch('/api/tipsa/create-shipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            service_code: serviceCode,
            packages,
            weight_kg: weightKg,
            content,
            observations: observations.trim() || undefined,
            return_shipment: returnShipment,
            saturday_delivery: saturdayDelivery,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Error creando envío')
          return
        }
        router.refresh()
        onClose()
      } catch {
        setError('Error de conexión. Inténtalo de nuevo.')
      } finally {
        setLoading(false)
      }
    },
    [
      orderId,
      serviceCode,
      packages,
      weightKg,
      content,
      observations,
      returnShipment,
      saturdayDelivery,
      router,
      onClose,
    ],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-xl bg-white shadow-2xl"
        style={{ colorScheme: 'light' }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Crear envío TIPSA</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {/* Vista previa del destinatario tal como saldra en la etiqueta
              TIPSA. Solo lectura: si algun dato esta mal, el operador
              cancela el modal y edita la ficha del pedido. */}
          <RecipientPreview recipient={recipient} />

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Servicio
            </label>
            <select
              value={serviceCode}
              onChange={(e) => setServiceCode(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={loading}
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
              <label className="mb-1 block text-xs font-medium text-gray-700">Bultos</label>
              <input
                type="number"
                min={1}
                step={1}
                value={packages}
                onChange={(e) => setPackages(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Peso (kg)</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={weightKg}
                onChange={(e) => setWeightKg(Math.max(0.1, Number(e.target.value)))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Contenido</label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={100}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Observaciones (opcional)
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              maxLength={200}
              className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={loading}
              placeholder="Ej: Dejar en portería"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-gray-100">
            <input
              type="checkbox"
              checked={returnShipment}
              onChange={(e) => setReturnShipment(e.target.checked)}
              disabled={loading}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700">
              <span className="font-medium text-gray-900">Con retorno de material</span>
              <span className="mt-0.5 block text-gray-500">
                TIPSA recogerá material del destinatario tras la entrega (boRetorno).
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-gray-100">
            <input
              type="checkbox"
              checked={saturdayDelivery}
              onChange={(e) => setSaturdayDelivery(e.target.checked)}
              disabled={loading}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700">
              <span className="font-medium text-gray-900">Entrega en sábado</span>
              <span className="mt-0.5 block text-gray-500">
                Autoriza que TIPSA pueda entregar el sábado (boSabado). Sujeto a zona y tarifa.
              </span>
            </span>
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear envío
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================================
// Vista previa del destinatario tal como saldra en la etiqueta TIPSA.
// Replica el bloque DES/P.C. del PDF que devuelve TIPSA para que el
// operador detecte errores ANTES de generar el envio real (errores
// que TIPSA luego no entiende: venue vacio, direccion mal escrita...).
// Misma logica de prioridad que /api/tipsa/create-shipment:
//   - DES (strNomDes)        = venue_name || customer_name
//   - P.C. (strPersContacto) = customer_name (si lo hay)
// =============================================================
function RecipientPreview({ recipient }: { recipient: RecipientPreviewData }) {
  const desName =
    recipient.venueName?.trim() ||
    recipient.customerName?.trim() ||
    'Destinatario'

  // Direccion: preferimos estructurada (street + cp + city); si no, la legacy.
  const hasStructured =
    !!recipient.shippingStreet || !!recipient.shippingCp || !!recipient.shippingCity
  const street = hasStructured
    ? recipient.shippingStreet?.trim() || null
    : recipient.shippingAddress?.trim() || null
  const cpCity = hasStructured
    ? [recipient.shippingCp, recipient.shippingCity].filter(Boolean).join(' ')
    : null

  // P.C.: solo si hay customer_name Y es distinto del que ya pusimos en DES
  // (cuando no hay venue, ambos serian iguales y serian redundantes).
  const contactPerson =
    recipient.customerName?.trim() &&
    recipient.customerName.trim() !== desName
      ? recipient.customerName.trim()
      : null
  const phone = recipient.phone?.trim() || null

  return (
    <div className="rounded-md border border-gray-300 bg-gray-50 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Vista previa del destinatario
      </p>
      <div className="space-y-1 font-mono text-xs text-gray-800">
        <div className="flex gap-2">
          <span className="w-10 shrink-0 font-semibold text-gray-500">DES:</span>
          <span className="font-semibold text-gray-900">{desName}</span>
        </div>
        {street && (
          <div className="flex gap-2">
            <span className="w-10 shrink-0" />
            <span>{street}</span>
          </div>
        )}
        {cpCity && (
          <div className="flex gap-2">
            <span className="w-10 shrink-0" />
            <span>{cpCity}</span>
          </div>
        )}
        {!hasStructured && street && (
          // Cuando solo tenemos legacy shipping_address (una linea), no separamos cp/city
          <></>
        )}
        {contactPerson && (
          <div className="flex gap-2 pt-1">
            <span className="w-10 shrink-0 font-semibold text-gray-500">P.C.</span>
            <span>
              {contactPerson}
              {phone && <span className="text-gray-500"> · {phone}</span>}
            </span>
          </div>
        )}
        {!contactPerson && phone && (
          <div className="flex gap-2 pt-1">
            <span className="w-10 shrink-0 font-semibold text-gray-500">Tlf.</span>
            <span>{phone}</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-[10px] italic text-gray-500">
        Si algún dato es incorrecto, cancela y edita el pedido.
      </p>
    </div>
  )
}
