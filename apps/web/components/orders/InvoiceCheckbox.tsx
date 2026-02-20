'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface InvoiceCheckboxProps {
  orderId: string
  currentValue: boolean
  readOnly?: boolean
}

export default function InvoiceCheckbox({ orderId, currentValue, readOnly }: InvoiceCheckboxProps) {
  const [invoiced, setInvoiced] = useState(currentValue)
  const [saving, setSaving] = useState(false)

  const handleToggle = async () => {
    if (readOnly) return
    const newValue = !invoiced
    setInvoiced(newValue)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ invoiced: newValue })
      .eq('id', orderId)

    setSaving(false)
    if (error) {
      setInvoiced(!newValue) // revert on error
    }
  }

  if (readOnly) {
    return (
      <span className={`text-sm ${invoiced ? 'font-medium text-green-700' : 'text-gray-500'}`}>
        {invoiced ? 'Facturado' : 'Sin facturar'}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      className="group flex items-center gap-2 disabled:opacity-50"
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
          invoiced
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-300 bg-white text-transparent group-hover:border-gray-400'
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className={`text-sm ${invoiced ? 'font-medium text-green-700' : 'text-gray-500'}`}>
        {saving ? 'Guardando...' : invoiced ? 'Facturado' : 'Sin facturar'}
      </span>
    </button>
  )
}
