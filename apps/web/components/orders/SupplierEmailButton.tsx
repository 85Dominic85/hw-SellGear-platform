'use client'

import { getSupplierEmails } from './SupplierSelect'

interface OrderItem {
  product_name: string
  qty: number
}

interface SupplierEmailButtonProps {
  supplier: string | null
  operationId: string
  customerName: string
  venueName?: string | null
  phone?: string | null
  contactEmail?: string | null
  shippingAddress?: string | null
  notes?: string | null
  items: OrderItem[]
}

export default function SupplierEmailButton({
  supplier,
  operationId,
  customerName,
  venueName,
  phone,
  contactEmail,
  shippingAddress,
  notes,
  items,
}: SupplierEmailButtonProps) {
  if (!supplier) return null

  const emails = getSupplierEmails(supplier)
  if (emails.length === 0) return null

  const subject = `Solicitud pedido ${operationId} — ${customerName}`

  const bodyLines: string[] = [
    'Hola,',
    '',
    'Os escribimos para solicitar el siguiente pedido:',
    '',
    `Referencia: ${operationId}`,
    `Cliente: ${customerName}`,
  ]

  if (venueName) bodyLines.push(`Local: ${venueName}`)
  if (phone) bodyLines.push(`Teléfono: ${phone}`)
  if (contactEmail) bodyLines.push(`Email contacto: ${contactEmail}`)

  if (items.length > 0) {
    bodyLines.push('', 'Productos:')
    for (const item of items) {
      bodyLines.push(`- ${item.qty}x ${item.product_name}`)
    }
  }

  if (shippingAddress) {
    bodyLines.push('', `Dirección de envío: ${shippingAddress}`)
  }

  if (notes) {
    bodyLines.push('', `Notas: ${notes}`)
  }

  bodyLines.push('', 'Gracias,', 'Equipo Hardware')

  const body = bodyLines.join('\n')
  const mailto = `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  return (
    <a
      href={mailto}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
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
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
      Enviar email a {supplier}
    </a>
  )
}
