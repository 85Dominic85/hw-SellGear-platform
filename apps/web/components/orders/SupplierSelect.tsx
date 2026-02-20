'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SUPPLIERS = [
  'Aqprox',
  'JassWay',
  'Pedro Porto',
  'PosiFlex',
  'Mayorista Canario',
] as const

interface SupplierSelectProps {
  orderId: string
  currentSupplier: string | null
}

export default function SupplierSelect({ orderId, currentSupplier }: SupplierSelectProps) {
  const [supplier, setSupplier] = useState(currentSupplier ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleChange = async (value: string) => {
    setSupplier(value)
    setSaving(true)
    setSaved(false)

    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ supplier: value || null })
      .eq('id', orderId)

    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Proveedor</h3>
      <p className="mb-3 text-xs text-gray-500">Selecciona el proveedor para este pedido</p>

      <select
        value={supplier}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
      >
        <option value="">Sin proveedor</option>
        {SUPPLIERS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <div className="mt-2 h-5">
        {saving && (
          <p className="text-xs text-gray-400">Guardando...</p>
        )}
        {saved && (
          <p className="text-xs text-green-600">Proveedor guardado</p>
        )}
      </div>
    </div>
  )
}
