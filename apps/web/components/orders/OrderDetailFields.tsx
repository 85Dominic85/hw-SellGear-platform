'use client'

import EditableField from './EditableField'
import InvoiceCheckbox from './InvoiceCheckbox'
import OrderCheckbox from './OrderCheckbox'
import ShippingLabelViewer from './ShippingLabelViewer'
import { formatCurrency, formatDate, PURCHASE_TYPE_LABELS } from '@/lib/utils'
import type { PurchaseType } from '@/types/database'

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
  notes: string | null
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

        {/* amount — editable number */}
        <EditableField
          orderId={order.id}
          fieldName="amount"
          value={order.amount}
          fieldType="number"
          canEdit={canEdit}
          label="Importe"
          formatDisplay={(v) => formatCurrency(v as number | null)}
        />

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

        {/* invoice_ref — editable text monospace */}
        <EditableField
          orderId={order.id}
          fieldName="invoice_ref"
          value={order.invoice_ref}
          fieldType="text"
          canEdit={canEdit}
          label="Ref factura"
          monospace
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

        {/* shipping_label_url — editable url + viewer */}
        <EditableField
          orderId={order.id}
          fieldName="shipping_label_url"
          value={order.shipping_label_url}
          fieldType="url"
          canEdit={canEdit}
          label="Etiqueta de envio"
          formatDisplay={(v) =>
            v ? <ShippingLabelViewer url={String(v)} /> : null
          }
        />

        {/* shipping_address — editable textarea full width */}
        <EditableField
          orderId={order.id}
          fieldName="shipping_address"
          value={order.shipping_address}
          fieldType="textarea"
          canEdit={canEdit}
          label="Direccion de envio"
          fullWidth
        />

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
