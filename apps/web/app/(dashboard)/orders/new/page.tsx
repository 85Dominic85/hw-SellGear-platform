'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PurchaseType } from '@/types/database'
import { PURCHASE_TYPE_LABELS } from '@/lib/utils'

interface ItemRow {
  product_name: string
  qty: number
}

const EMPTY_ITEM: ItemRow = { product_name: '', qty: 1 }

interface FormData {
  requester_name: string
  requester_email: string
  customer_name: string
  venue_name: string
  contact_email: string
  phone: string
  purchase_type: PurchaseType | ''
  amount: string
  ae_ref: string
  hubspot_ref: string
  bank_receipt_url: string
  shipping_address: string
  notes: string
}

const EMPTY_FORM: FormData = {
  requester_name: '',
  requester_email: '',
  customer_name: '',
  venue_name: '',
  contact_email: '',
  phone: '',
  purchase_type: '',
  amount: '',
  ae_ref: '',
  hubspot_ref: '',
  bank_receipt_url: '',
  shipping_address: '',
  notes: '',
}

export default function NewOrderPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof ItemRow, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_name.trim()) {
      setError('El nombre del cliente es obligatorio.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_name: form.requester_name.trim() || null,
          requester_email: form.requester_email.trim() || null,
          customer_name: form.customer_name.trim(),
          venue_name: form.venue_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          phone: form.phone.trim() || null,
          purchase_type: form.purchase_type || null,
          amount: form.amount ? parseFloat(form.amount) : null,
          ae_ref: form.ae_ref.trim() || null,
          hubspot_ref: form.hubspot_ref.trim() || null,
          bank_receipt_url: form.bank_receipt_url.trim() || null,
          shipping_address: form.shipping_address.trim() || null,
          notes: form.notes.trim() || null,
          items: items
            .filter((item) => item.product_name.trim())
            .map((item) => ({
              product_name: item.product_name.trim(),
              qty: item.qty,
            })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al crear el pedido.')
        setSaving(false)
        return
      }

      router.push(`/orders/${data.id}`)
    } catch {
      setError('Error de conexión al crear el pedido.')
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500'
  const labelClass = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <nav className="mb-2 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/orders" className="hover:text-gray-700">
            Pedidos
          </Link>
          <span>/</span>
          <span className="text-gray-900">Nuevo pedido</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">Crear pedido manual</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Requester */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Solicitante</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nombre del solicitante</label>
              <input
                type="text"
                value={form.requester_name}
                onChange={(e) => setField('requester_name', e.target.value)}
                placeholder="Nombre de quien solicita el pedido"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email del solicitante</label>
              <input
                type="email"
                value={form.requester_email}
                onChange={(e) => setField('requester_email', e.target.value)}
                placeholder="Para notificaciones si hay incidencias"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Customer details */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            Datos del cliente
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Nombre del cliente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.customer_name}
                onChange={(e) => setField('customer_name', e.target.value)}
                placeholder="Nombre completo o empresa"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Nombre del venue / local</label>
              <input
                type="text"
                value={form.venue_name}
                onChange={(e) => setField('venue_name', e.target.value)}
                placeholder="Bar Ejemplo, S.L."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email de contacto</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setField('contact_email', e.target.value)}
                placeholder="contacto@empresa.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="+34 600 000 000"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Order details */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            Detalles del pedido
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Tipo de compra</label>
              <select
                value={form.purchase_type}
                onChange={(e) =>
                  setField('purchase_type', e.target.value as PurchaseType | '')
                }
                className={inputClass}
              >
                <option value="">Seleccionar tipo...</option>
                {(Object.keys(PURCHASE_TYPE_LABELS) as PurchaseType[]).map((type) => (
                  <option key={type} value={type}>
                    {PURCHASE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Importe (EUR)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Ref. AE</label>
              <input
                type="text"
                value={form.ae_ref}
                onChange={(e) => setField('ae_ref', e.target.value)}
                placeholder="AE-XXXXX"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Ref. HubSpot</label>
              <input
                type="text"
                value={form.hubspot_ref}
                onChange={(e) => setField('hubspot_ref', e.target.value)}
                placeholder="HS-XXXXX"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Justificante bancario (URL)</label>
              <input
                type="url"
                value={form.bank_receipt_url}
                onChange={(e) => setField('bank_receipt_url', e.target.value)}
                placeholder="https://drive.google.com/..."
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Dirección de envío</label>
              <input
                type="text"
                value={form.shipping_address}
                onChange={(e) => setField('shipping_address', e.target.value)}
                placeholder="Calle Ejemplo 1, 28001 Madrid"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notas internas</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Información adicional relevante..."
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Artículos</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Añadir línea
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={item.product_name}
                    onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                    placeholder={`Producto ${index + 1}`}
                    className={inputClass}
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) =>
                      updateItem(
                        index,
                        'qty',
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    className={`${inputClass} text-center`}
                    title="Cantidad"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="flex-shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Eliminar línea"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Las líneas en blanco se ignorarán al guardar.
          </p>
        </div>

        {/* Error + Submit */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pb-8">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && (
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {saving ? 'Creando pedido...' : 'Crear pedido'}
          </button>
          <Link
            href="/orders"
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
