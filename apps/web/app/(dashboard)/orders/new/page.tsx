'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PurchaseType, Product } from '@/types/database'
import { isCanaryIslands } from '@/lib/utils'
import { fieldRequirementsFor } from '@/lib/order-requirements'
import type { CartLineState } from '@/components/orders/CartLine'
import CartSummary from '@/components/orders/CartSummary'
import ProductCatalog from '@/components/orders/ProductCatalog'
import FinancingCatalog from '@/components/orders/FinancingCatalog'
import FinancingSummary from '@/components/orders/FinancingSummary'
import { isFinanceableCode } from '@/lib/financing'
import BankReceiptInput from '@/components/orders/BankReceiptInput'
import WizardSteps from '@/components/orders/WizardSteps'
import PurchaseTypeTile, {
  PURCHASE_TYPE_ORDER,
} from '@/components/orders/PurchaseTypeTile'

// =============================================================
// Wizard de creacion de pedido manual.
//
// Paso 1: tipo de compra (tiles visuales). Condiciona obligatoriedad
//         del resto de campos (transferencias_saas = sin envio).
// Paso 2: datos del solicitante + cliente + refs + envio condicional.
// Paso 3: catálogo visual de productos + resumen + crear pedido.
// =============================================================

interface FormData {
  requester_name: string
  requester_email: string
  customer_name: string
  venue_name: string
  contact_email: string
  phone: string
  purchase_type: PurchaseType | ''
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
  hubspot_ref: '',
  bank_receipt_url: '',
  shipping_street: '',
  shipping_cp: '',
  shipping_city: '',
  shipping_province: '',
  notes: '',
}

type StepNum = 1 | 2 | 3

export default function NewOrderPage() {
  const router = useRouter()
  const [step, setStep] = useState<StepNum>(1)
  const [furthestReached, setFurthestReached] = useState<StepNum>(1)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  // Carrito vacío: las líneas se añaden vía tile del catálogo (estándar) o
  // botón "Añadir línea libre" (otro / saas_hardware). Sin placeholder inicial.
  const [items, setItems] = useState<CartLineState[]>([])
  // Descuento global (%) sobre la base imponible del pedido, adicional a
  // los descuentos por línea. Se aplica solo cuando purchase_type NO es
  // 'hardware_financiacion' (el plan de plazos es fijo).
  const [discountGlobalPct, setDiscountGlobalPct] = useState(0)
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

  // Reglas de obligatoriedad segun purchase_type (espejo del server).
  const purchaseTypeOrNull = form.purchase_type === '' ? null : form.purchase_type
  const req = fieldRequirementsFor(purchaseTypeOrNull)
  const isFinancing = form.purchase_type === 'hardware_financiacion'
  // IVA aplicable al plan de financiación: 0 si Canarias, 21 resto.
  const financingVatRate = isCanaryIslands(form.shipping_cp) ? 0 : 21

  // Cambiar el tipo de compra resetea el carrito al cruzar la frontera de
  // financiación (los productos financiables y el resto no son intercambiables).
  function selectPurchaseType(type: PurchaseType) {
    const wasFinancing = form.purchase_type === 'hardware_financiacion'
    const willBeFinancing = type === 'hardware_financiacion'
    if (wasFinancing !== willBeFinancing) {
      setItems([])
    }
    setField('purchase_type', type)
  }

  function goToStep(target: StepNum) {
    setError(null)
    setStep(target)
    setFurthestReached((prev) => (target > prev ? target : prev))
  }

  // ---- Step validations ---------------------------------------------------

  function validateStep1(): string | null {
    if (!form.purchase_type) return 'Selecciona un tipo de compra para continuar.'
    return null
  }

  function validateStep2(): string | null {
    if (req.requester_name && !form.requester_name.trim()) {
      return 'El nombre del solicitante es obligatorio.'
    }
    if (req.requester_email && !form.requester_email.trim()) {
      return 'El email del solicitante es obligatorio.'
    }
    if (req.customer_name && !form.customer_name.trim()) {
      return 'El nombre del cliente es obligatorio.'
    }
    if (req.contact_email && !form.contact_email.trim()) {
      return 'El email del cliente es obligatorio.'
    }
    if (req.phone && !form.phone.trim()) {
      return 'El teléfono del cliente es obligatorio.'
    }
    if (req.hubspot_ref && !form.hubspot_ref.trim()) {
      return 'La referencia de HubSpot es obligatoria.'
    }
    if (req.bank_receipt_url && !form.bank_receipt_url.trim()) {
      return 'El justificante bancario es obligatorio.'
    }
    if (req.shipping) {
      if (!form.shipping_street.trim()) return 'La dirección (calle) es obligatoria.'
      if (!form.shipping_cp.trim()) return 'El código postal es obligatorio.'
      if (!/^\d{5}$/.test(form.shipping_cp.trim())) {
        return 'El código postal debe tener 5 dígitos exactos.'
      }
      if (!form.shipping_city.trim()) return 'La ciudad es obligatoria.'
    }
    return null
  }

  function validateStep3(): string | null {
    const filled = items.filter((it) => it.product_id)
    if (filled.length === 0) {
      return isFinancing
        ? 'Selecciona un producto financiable.'
        : 'Debes añadir al menos un producto al pedido.'
    }
    if (isFinancing) {
      if (filled.length !== 1) {
        return 'Un pedido de financiación debe tener un único producto.'
      }
      const product = products.find((p) => p.id === filled[0].product_id)
      if (!product || !isFinanceableCode(product.code)) {
        return 'El producto seleccionado no es financiable.'
      }
      return null
    }
    for (const it of filled) {
      const product = products.find((p) => p.id === it.product_id)
      if (!product) {
        return 'Hay un producto del carrito que no existe en el catálogo.'
      }
      const isFree = product.code === 'otro' || product.category === 'saas_hardware'
      if (isFree) {
        if (!it.product_name_override.trim()) {
          return product.category === 'saas_hardware'
            ? 'Las líneas SaaS + Hardware requieren descripción de la oferta.'
            : 'Las líneas "Otro" requieren descripción del producto.'
        }
        if (it.unit_price_override_cents === null || it.unit_price_override_cents <= 0) {
          return product.category === 'saas_hardware'
            ? 'Las líneas SaaS + Hardware requieren un precio negociado mayor que 0.'
            : 'Las líneas "Otro" requieren un precio unitario mayor que 0.'
        }
      }
    }
    return null
  }

  // ---- Step navigation ----------------------------------------------------

  function nextStep() {
    setError(null)
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
      goToStep(2)
      return
    }
    if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }
      goToStep(3)
      return
    }
  }

  function prevStep() {
    setError(null)
    if (step === 3) goToStep(2)
    else if (step === 2) goToStep(1)
  }

  // ---- Submit -------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const err = validateStep1() ?? validateStep2() ?? validateStep3()
    if (err) { setError(err); return }

    const filledItems = items.filter((it) => it.product_id)

    setSaving(true)
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
          hubspot_ref: form.hubspot_ref.trim() || null,
          bank_receipt_url: form.bank_receipt_url.trim() || null,
          shipping_street: form.shipping_street.trim(),
          shipping_cp: form.shipping_cp.trim(),
          shipping_city: form.shipping_city.trim(),
          shipping_province: form.shipping_province.trim() || null,
          notes: form.notes.trim() || null,
          // Descuento global % sobre la base imponible del pedido (adicional
          // a los descuentos por línea). Se ignora en financiación en el
          // servidor.
          discount_global_pct: discountGlobalPct,
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
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
  const labelClass = 'block text-xs font-medium text-gray-700 mb-1'
  const sectionClass = 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm'

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <nav className="mb-2 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/orders" className="hover:text-gray-700">Pedidos</Link>
          <span>/</span>
          <span className="text-gray-900">Nuevo pedido</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">Crear pedido manual</h1>
      </div>

      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <WizardSteps
            current={step}
            furthestReached={furthestReached}
            onJump={goToStep}
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* =================================================================
              STEP 1: Tipo de compra
              ================================================================= */}
          {step === 1 && (
            <div className={sectionClass}>
              <h2 className="text-sm font-semibold text-gray-900">
                ¿Qué tipo de pedido estás creando?
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                El tipo condiciona qué información se solicita después.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PURCHASE_TYPE_ORDER.map((type) => (
                  <PurchaseTypeTile
                    key={type}
                    type={type}
                    selected={form.purchase_type === type}
                    onSelect={() => selectPurchaseType(type)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* =================================================================
              STEP 2: Datos del solicitante + cliente + envío condicional
              ================================================================= */}
          {step === 2 && (
            <>
              {/* Solicitante */}
              <div className={sectionClass}>
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Solicitante</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>
                      Nombre del solicitante <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.requester_name}
                      onChange={(e) => setField('requester_name', e.target.value)}
                      placeholder="Nombre de quien solicita el pedido"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Email del solicitante <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.requester_email}
                      onChange={(e) => setField('requester_email', e.target.value)}
                      placeholder="Para notificaciones si hay incidencias"
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Cliente */}
              <div className={sectionClass}>
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Datos del cliente</h2>
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
                    <label className={labelClass}>
                      Email del cliente <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.contact_email}
                      onChange={(e) => setField('contact_email', e.target.value)}
                      placeholder="contacto@empresa.com"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Teléfono
                      {req.phone && <span className="text-red-500"> *</span>}
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                      placeholder="+34 600 000 000"
                      required={req.phone}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Refs + Justificante */}
              <div className={sectionClass}>
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Referencias y justificante</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                </div>
              </div>

              {/* Direccion de envio (condicional) */}
              {req.shipping ? (
                <div className={sectionClass}>
                  <h2 className="mb-4 text-sm font-semibold text-gray-900">Dirección de envío</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>
                        Dirección (calle, número, piso) <span className="text-red-500">*</span>
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
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-blue-50 px-5 py-4 text-sm text-blue-800 ring-1 ring-blue-200">
                  <strong className="font-semibold">Transferencias SaaS</strong>: no requieren
                  dirección de envío. Si cambias el tipo de compra en el paso anterior, los
                  campos de dirección reaparecerán automáticamente.
                </div>
              )}

              {/* Notas */}
              <div className={sectionClass}>
                <label className={labelClass}>Notas internas</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Información adicional relevante..."
                  className={`${inputClass} resize-none`}
                />
              </div>
            </>
          )}

          {/* =================================================================
              STEP 3: Productos + resumen
              ================================================================= */}
          {step === 3 && (
            <>
              <div className={sectionClass}>
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {isFinancing ? 'Producto a financiar' : 'Productos'}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {isFinancing
                      ? 'Solo Pack Pro, Pack Premium y KDS Estándar admiten financiación. Selecciona uno.'
                      : 'Selecciona productos del catálogo Qamarero 2026 o añade una línea libre.'}
                  </p>
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
                  isFinancing ? (
                    <FinancingCatalog
                      products={products}
                      items={items}
                      onItemsChange={setItems}
                      vatRate={financingVatRate}
                    />
                  ) : (
                    <ProductCatalog
                      products={products}
                      items={items}
                      onItemsChange={setItems}
                      vatRateOverride={isCanaryIslands(form.shipping_cp) ? 0 : null}
                    />
                  )
                )}
              </div>

              {!loadingCatalog && !catalogError && (
                isFinancing ? (
                  <FinancingSummary
                    lines={items}
                    products={products}
                    vatRate={financingVatRate}
                  />
                ) : (
                  <CartSummary
                    lines={items}
                    products={products}
                    vatRateOverride={isCanaryIslands(form.shipping_cp) ? 0 : null}
                    discountGlobalPct={discountGlobalPct}
                    onDiscountGlobalChange={setDiscountGlobalPct}
                  />
                )
              )}
            </>
          )}

          {/* Error global */}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          {/* =================================================================
              Botones de navegacion
              ================================================================= */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-8">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={saving}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  ← Atrás
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/orders"
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                Cancelar
              </Link>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
                >
                  Continuar →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={saving || loadingCatalog || !!catalogError}
                  className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {saving ? 'Creando pedido...' : 'Crear pedido'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
