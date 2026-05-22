'use client'

import EditableField from './EditableField'
import FileUploadField from './FileUploadField'
import InvoiceCheckbox from './InvoiceCheckbox'
import OrderCheckbox from './OrderCheckbox'
import ShippingLabelViewer from './ShippingLabelViewer'
import { formatCurrency, formatDate, PURCHASE_TYPE_LABELS, isCanaryIslands } from '@/lib/utils'
import {
  computeOrderTotals,
  effectiveTaxLabel,
  formatEurosCents,
} from '@/lib/pricing'
import type { PurchaseType, OrderItem, Order } from '@/types/database'

interface OrderData {
  id: string
  operation_id: string
  purchase_type: string | null
  amount: number | null
  invoiced: boolean
  contact_email: string | null
  phone: string | null
  source: string
  source_department: string | null
  requester_name: string | null
  requester_email: string | null
  bank_receipt_url: string | null
  created_at: string
  updated_at: string
  ae_ref: string | null
  hubspot_ref: string | null
  invoice_ref: string | null
  prepared: boolean
  shipped: boolean
  shipping_label_url: string | null
  tracking_number: string | null
  shipping_address: string | null
  shipping_street: string | null
  shipping_cp: string | null
  shipping_city: string | null
  shipping_province: string | null
  notes: string | null
  // Items con desglose moderno (unit_price_cents). Opcional: si no hay
  // items o todos son legacy, se muestra el "Importe" plano editable.
  order_items?: OrderItem[] | null
}

interface OrderDetailFieldsProps {
  order: OrderData
  canEdit: boolean
  isViewer: boolean
}

const PURCHASE_TYPE_OPTIONS = Object.entries(PURCHASE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export default function OrderDetailFields({ order, canEdit, isViewer }: OrderDetailFieldsProps) {
  // Desglose economico desde order_items modernos. Si null -> fallback al
  // amount plano editable (pedidos legacy de Typeform sin desglose por linea).
  const totals = computeOrderTotals({
    order_items: order.order_items ?? [],
  } as Order)
  const taxRates = (order.order_items ?? [])
    .filter((i) => i.unit_price_cents !== null && i.unit_price_cents !== undefined)
    .map((i) => i.vat_rate ?? 21)
  const taxRowLabel = effectiveTaxLabel(taxRates)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">Detalles del pedido</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {/* operation_id — always read-only */}
        <div>
          <dt className="text-xs text-gray-500">ID de operacion</dt>
          <dd className="mt-0.5 font-mono text-sm font-medium text-gray-900">
            {order.operation_id}
          </dd>
        </div>

        {/* purchase_type — editable select */}
        <EditableField
          orderId={order.id}
          fieldName="purchase_type"
          value={order.purchase_type}
          fieldType="select"
          canEdit={canEdit}
          label="Tipo de compra"
          options={PURCHASE_TYPE_OPTIONS}
          formatDisplay={(v) =>
            v ? PURCHASE_TYPE_LABELS[v as PurchaseType] ?? String(v) : null
          }
        />

        {/* Importe: desglose si el pedido tiene order_items modernos (unit_price_cents);
            fallback al campo editable plano para pedidos legacy (Typeform sin desglose). */}
        {totals ? (
          <div className="sm:col-span-1">
            <dt className="text-xs text-gray-500">Importe</dt>
            <dd className="mt-1 space-y-0.5">
              <div className="flex items-baseline justify-between text-xs text-gray-600">
                <span>Base imponible</span>
                <span className="font-mono tabular-nums">
                  {formatEurosCents(totals.taxableCents)}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs text-gray-600">
                <span>{taxRowLabel}</span>
                <span className="font-mono tabular-nums">
                  {formatEurosCents(totals.vatCents)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between border-t border-gray-100 pt-1 text-sm font-semibold text-gray-900">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {formatEurosCents(totals.totalCents)}
                </span>
              </div>
            </dd>
          </div>
        ) : (
          <EditableField
            orderId={order.id}
            fieldName="amount"
            value={order.amount}
            fieldType="number"
            canEdit={canEdit}
            label="Importe"
            formatDisplay={(v) => formatCurrency(v as number | null)}
          />
        )}

        {/* invoiced — dedicated component */}
        <div>
          <dt className="text-xs text-gray-500">Factura</dt>
          <dd className="mt-1">
            <InvoiceCheckbox orderId={order.id} currentValue={order.invoiced} readOnly={isViewer} />
          </dd>
        </div>

        {/* contact_email — editable email */}
        <EditableField
          orderId={order.id}
          fieldName="contact_email"
          value={order.contact_email}
          fieldType="email"
          canEdit={canEdit}
          label="Email de contacto"
          formatDisplay={(v) =>
            v ? (
              <a href={`mailto:${v}`} className="text-blue-600 hover:underline">
                {String(v)}
              </a>
            ) : null
          }
        />

        {/* phone — editable text */}
        <EditableField
          orderId={order.id}
          fieldName="phone"
          value={order.phone}
          fieldType="text"
          canEdit={canEdit}
          label="Telefono"
        />

        {/* source — read-only */}
        <div>
          <dt className="text-xs text-gray-500">Origen</dt>
          <dd className="mt-0.5 text-sm capitalize text-gray-900">{order.source}</dd>
        </div>

        {/* source_department — editable text */}
        <EditableField
          orderId={order.id}
          fieldName="source_department"
          value={order.source_department}
          fieldType="text"
          canEdit={canEdit}
          label="Departamento"
        />

        {/* requester_name — editable text */}
        <EditableField
          orderId={order.id}
          fieldName="requester_name"
          value={order.requester_name}
          fieldType="text"
          canEdit={canEdit}
          label="Solicitante"
        />

        {/* requester_email — editable email */}
        <EditableField
          orderId={order.id}
          fieldName="requester_email"
          value={order.requester_email}
          fieldType="email"
          canEdit={canEdit}
          label="Email solicitante"
          formatDisplay={(v) =>
            v ? (
              <a href={`mailto:${v}`} className="text-blue-600 hover:underline">
                {String(v)}
              </a>
            ) : null
          }
        />

        {/* bank_receipt_url — editable url */}
        <EditableField
          orderId={order.id}
          fieldName="bank_receipt_url"
          value={order.bank_receipt_url}
          fieldType="url"
          canEdit={canEdit}
          label="Justificante bancario"
          formatDisplay={(v) =>
            v ? (
              <a
                href={String(v)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Ver justificante
              </a>
            ) : null
          }
        />

        {/* created_at — read-only */}
        <div>
          <dt className="text-xs text-gray-500">Fecha de creacion</dt>
          <dd className="mt-0.5 text-sm text-gray-900">{formatDate(order.created_at)}</dd>
        </div>

        {/* updated_at — read-only */}
        <div>
          <dt className="text-xs text-gray-500">Ultima actualizacion</dt>
          <dd className="mt-0.5 text-sm text-gray-900">{formatDate(order.updated_at)}</dd>
        </div>

        {/* ae_ref — editable text monospace */}
        <EditableField
          orderId={order.id}
          fieldName="ae_ref"
          value={order.ae_ref}
          fieldType="text"
          canEdit={canEdit}
          label="Ref AE"
          monospace
        />

        {/* hubspot_ref — editable url, shown as link */}
        <EditableField
          orderId={order.id}
          fieldName="hubspot_ref"
          value={order.hubspot_ref}
          fieldType="text"
          canEdit={canEdit}
          label="Ref HubSpot"
          formatDisplay={(v) =>
            v ? (
              <a
                href={String(v)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Ver HubSpot
              </a>
            ) : null
          }
        />

        {/* invoice_ref — file upload */}
        <FileUploadField
          orderId={order.id}
          fieldName="invoice_ref"
          value={order.invoice_ref}
          canEdit={canEdit}
          label="Ref factura"
          linkLabel="Ver factura"
        />

        {/* prepared — checkbox */}
        <div>
          <dt className="text-xs text-gray-500">Preparado</dt>
          <dd className="mt-1">
            <OrderCheckbox
              orderId={order.id}
              fieldName="prepared"
              currentValue={order.prepared}
              labelChecked="Preparado"
              labelUnchecked="Sin preparar"
              readOnly={isViewer}
              colorClass={{ border: 'border-blue-500', bg: 'bg-blue-500', text: 'text-blue-700' }}
            />
          </dd>
        </div>

        {/* shipped — checkbox */}
        <div>
          <dt className="text-xs text-gray-500">Enviado</dt>
          <dd className="mt-1">
            <OrderCheckbox
              orderId={order.id}
              fieldName="shipped"
              currentValue={order.shipped}
              labelChecked="Enviado"
              labelUnchecked="Sin enviar"
              readOnly={isViewer}
              colorClass={{ border: 'border-purple-500', bg: 'bg-purple-500', text: 'text-purple-700' }}
            />
          </dd>
        </div>

        {/* tracking_number — editable text */}
        <EditableField
          orderId={order.id}
          fieldName="tracking_number"
          value={order.tracking_number}
          fieldType="text"
          canEdit={canEdit}
          label="Tracking number"
          monospace
        />

        {/* shipping_label_url — file upload + viewer */}
        <FileUploadField
          orderId={order.id}
          fieldName="shipping_label_url"
          value={order.shipping_label_url}
          canEdit={canEdit}
          label="Etiqueta de envio"
          linkLabel="Ver etiqueta"
          viewerComponent={ShippingLabelViewer}
        />

        {/* Direccion estructurada: 4 campos + persona contacto.
            Se regenera shipping_address serializado automaticamente al guardar. */}
        <EditableField
          orderId={order.id}
          fieldName="shipping_street"
          value={order.shipping_street}
          fieldType="text"
          canEdit={canEdit}
          label={<>Calle / dirección{isCanaryIslands(order.shipping_cp ?? order.shipping_address) && <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Canarias</span>}</>}
          fullWidth
        />

        <EditableField
          orderId={order.id}
          fieldName="shipping_cp"
          value={order.shipping_cp}
          fieldType="text"
          canEdit={canEdit}
          label="Código postal"
        />

        <EditableField
          orderId={order.id}
          fieldName="shipping_city"
          value={order.shipping_city}
          fieldType="text"
          canEdit={canEdit}
          label="Ciudad"
        />

        <EditableField
          orderId={order.id}
          fieldName="shipping_province"
          value={order.shipping_province}
          fieldType="text"
          canEdit={canEdit}
          label="Provincia"
        />

        {/* shipping_address legacy: solo mostrar para pedidos Typeform que aun no tienen los 4 campos estructurados */}
        {!order.shipping_street && order.shipping_address && (
          <div className="col-span-full">
            <dt className="text-xs text-gray-500">Dirección heredada (Typeform)</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-600">
              {order.shipping_address}
            </dd>
            <p className="mt-1 text-xs text-amber-700">
              Rellena los 4 campos estructurados arriba para mejorar la etiqueta TIPSA.
            </p>
          </div>
        )}

        {/* notes — editable textarea full width */}
        <EditableField
          orderId={order.id}
          fieldName="notes"
          value={order.notes}
          fieldType="textarea"
          canEdit={canEdit}
          label="Notas"
          fullWidth
        />
      </dl>
    </div>
  )
}
