'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PurchaseType, Product } from '@/types/database'
import { PURCHASE_TYPE_LABELS, isCanaryIslands } from '@/lib/utils'
import CartLine, { EMPTY_LINE, type CartLineState } from '@/components/orders/CartLine'
import CartSummary from '@/components/orders/CartSummary'
import BankReceiptInput from '@/components/orders/BankReceiptInput'

interface FormData {
  requester_name: string
  requester_email: string
  customer_name: string
  venue_name: string
  contact_email: string
  phone: string
  purchase_type: PurchaseType | ''
  ae_ref: string
  hubspot_ref: string
  bank_receipt_url: string
  shipping_street: string
  shipping_cp: string
  shipping_city: string
  shipping_province: string
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
  ae_ref: '',
  hubspot_ref: '',
  bank_receipt_url: '',
  shipping_street: '',
  shipping_cp: '',
  shipping_city: '',
  shipping_province: '',
  notes: '',
}

export default function NewOrderPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [items, setItems] = useState<CartLineState[]>([{ ...EMPTY_LINE }])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await fetch('/api/products')
        const data = await res.json()
        if (!res.ok) {
          setCatalogError(data.error ?? 'Error al cargar el catálogo.')
          return
        }
        setProducts(data.products ?? [])
      } catch {
        setCatalogError('Error de conexión al cargar el catálogo.')
      } finally {
        setLoadingCatalog(false)
      }
    }
    loadCatalog()
  }, [])

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_LINE }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, partial: Partial<CartLineState>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...partial } : item)),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_name.trim()) {
      setError('El nombre del cliente es obligatorio.')
      return
    }
    if (!form.phone.trim()) {
      setError('El teléfono del cliente es obligatorio.')
      return
    }
    if (!form.shipping_street.trim()) {
      setError('La dirección (calle) es obligatoria.')
      return
    }
    if (!form.shipping_cp.trim()) {
      setError('El código postal es obligatorio.')
      return
    }
    if (!/^\d{5}$/.test(form.shipping_cp.trim())) {
      setError('El código postal debe tener 5 dígitos exactos.')
      return
    }
    if (!form.shipping_city.trim()) {
      setError('La ciudad es obligatoria.')
      return
    }
    if (!form.hubspot_ref.trim()) {
      setError('La referencia de HubSpot es obligatoria.')
      return
    }
    if (!form.bank_receipt_url.trim()) {
      setError('El justificante bancario es obligatorio.')
      return
    }

    // Validación carrito
    const filledItems = items.filter((it) => it.product_id)
    if (filledItems.length === 0) {
      setError('Debes añadir al menos un producto al pedido.')
      return
    }

    for (const it of filledItems) {
      const product = products.find((p) => p.id === it.product_id)
      if (!product) {
        setError('Hay un producto del carrito que no existe en el catálogo.')
        return
      }
      if (product.code === 'otro') {
        if (!it.product_name_override.trim()) {
          setError('Las líneas "Otro (fuera de catálogo)" requieren descripción.')
          return
        }
        if (
          it.unit_price_override_cents === null ||
          it.unit_price_override_cents <= 0
        ) {
          setError('Las líneas "Otro" requieren un precio unitario mayor que 0.')
          return
        }
      }
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
          phone: form.phone.trim(),
          purchase_type: form.purchase_type || null,
          ae_ref: form.ae_ref.trim() || null,
          hubspot_ref: form.hubspot_ref.trim() || null,
          bank_receipt_url: form.bank_receipt_url.trim() || null,
          shipping_street: form.shipping_street.trim(),
          shipping_cp: form.shipping_cp.trim(),
          shipping_city: form.shipping_city.trim(),
          shipping_province: form.shipping_province.trim() || null,
          notes: form.notes.trim() || null,
          items: filledItems.map((it) => ({
            product_id: it.product_id,
            qty: it.qty,
            discount_pct: it.discount_pct,
            product_name_override: it.product_name_override.trim() || null,
            unit_price_override_cents: it.unit_price_override_cents,
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
              <label className={labelClass}>
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="+34 600 000 000"
                required
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
            <div className="sm:col-span-2">
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
              <label className={labelClass}>
                Ref. HubSpot <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.hubspot_ref}
                onChange={(e) => setField('hubspot_ref', e.target.value)}
                placeholder="HS-XXXXX"
                required
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Justificante bancario <span className="text-red-500">*</span>
              </label>
              <BankReceiptInput
                value={form.bank_receipt_url}
                onChange={(v) => setField('bank_receipt_url', v)}
                className={inputClass}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Dirección (calle, número, piso){' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.shipping_street}
                onChange={(e) => setField('shipping_street', e.target.value)}
                placeholder="Ej: Gran Vía 1, 3ºB"
                maxLength={200}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                Código postal <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{5}"
                value={form.shipping_cp}
                onChange={(e) =>
                  setField('shipping_cp', e.target.value.replace(/\D/g, '').slice(0, 5))
                }
                placeholder="28001"
                maxLength={5}
                required
                className={inputClass}
              />
              {form.shipping_cp.length > 0 && form.shipping_cp.length !== 5 && (
                <p className="mt-1 text-xs text-red-600">Debe tener 5 dígitos.</p>
              )}
            </div>
            <div>
              <label className={labelClass}>
                Ciudad <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.shipping_city}
                onChange={(e) => setField('shipping_city', e.target.value)}
                placeholder="Madrid"
                maxLength={100}
                required
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Provincia</label>
              <input
                type="text"
                value={form.shipping_province}
                onChange={(e) => setField('shipping_province', e.target.value)}
                placeholder="Ej: Sevilla, Madrid, A Coruña (opcional)"
                maxLength={50}
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

        {/* Cart: artículos */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Artículos</h2>
            <button
              type="button"
              onClick={addItem}
              disabled={loadingCatalog || !!catalogError}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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

          {loadingCatalog && (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              Cargando catálogo de productos…
            </div>
          )}

          {catalogError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {catalogError}
            </div>
          )}

          {!loadingCatalog && !catalogError && (
            <div className="space-y-3">
              {items.map((line, index) => (
                <CartLine
                  key={index}
                  index={index}
                  line={line}
                  products={products}
                  canRemove={items.length > 1}
                  onChange={updateItem}
                  onRemove={removeItem}
                  vatRateOverride={isCanaryIslands(form.shipping_cp) ? 0 : null}
                />
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-gray-400">
            Selecciona &quot;Otro (fuera de catálogo)&quot; para introducir productos puntuales con descripción y precio libres.
          </p>
        </div>

        {/* Cart summary */}
        {!loadingCatalog && !catalogError && (
          <CartSummary
            lines={items}
            products={products}
            vatRateOverride={isCanaryIslands(form.shipping_cp) ? 0 : null}
          />
        )}

        {/* Error + Submit */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pb-8">
          <button
            type="submit"
            disabled={saving || loadingCatalog || !!catalogError}
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
