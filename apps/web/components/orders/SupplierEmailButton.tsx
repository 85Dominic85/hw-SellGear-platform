'use client'

import { useState, useCallback } from 'react'
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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="flex-shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-100"
      title={`Copiar ${label}`}
    >
      {copied ? (
        <span className="text-green-600">Copiado</span>
      ) : (
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
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
  const [open, setOpen] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  if (!supplier) return null

  const emails = getSupplierEmails(supplier)
  if (emails.length === 0) return null

  const to = emails.join(', ')
  const subject = `Solicitud pedido ${operationId} — ${customerName}`

  const na = '—'

  const bodyLines: string[] = [
    'Hola,',
    '',
    'Os escribimos para solicitar el siguiente pedido:',
    '',
    `Referencia: ${operationId}`,
    `Cliente: ${customerName || na}`,
    `Local: ${venueName || na}`,
    `Teléfono: ${phone || na}`,
    `Email contacto: ${contactEmail || na}`,
  ]

  bodyLines.push('', 'Productos:')
  if (items.length > 0) {
    for (const item of items) {
      bodyLines.push(`- ${item.qty}x ${item.product_name}`)
    }
  } else {
    bodyLines.push(`(sin artículos)`)
  }

  bodyLines.push('', `Dirección de envío: ${shippingAddress || na}`)
  bodyLines.push('', `Notas: ${notes || na}`)

  bodyLines.push('', 'Gracias,', 'Equipo Hardware')

  const body = bodyLines.join('\n')

  const handleCopyAll = async () => {
    const full = `Para: ${to}\nAsunto: ${subject}\n\n${body}`
    await navigator.clipboard.writeText(full)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Preparar email a {supplier}
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">Plantilla de email — {supplier}</h3>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 px-5 py-4">
              {/* Para */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500">Para</label>
                  <CopyButton text={to} label="destinatarios" />
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900 select-all">{to}</div>
              </div>

              {/* Asunto */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500">Asunto</label>
                  <CopyButton text={subject} label="asunto" />
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900 select-all">{subject}</div>
              </div>

              {/* Cuerpo */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500">Cuerpo</label>
                  <CopyButton text={body} label="cuerpo" />
                </div>
                <div className="max-h-60 overflow-y-auto rounded-lg bg-gray-50 px-3 py-2 text-sm whitespace-pre-wrap text-gray-900 select-all">
                  {body}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
              >
                {copiedAll ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copiar todo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
