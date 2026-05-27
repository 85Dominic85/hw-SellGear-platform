'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export const SUPPLIERS = [
  { name: 'Aqprox', emails: ['anazaragoza@mylar.es'] },
  { name: 'JassWay', emails: ['joseluis@jassway.es'] },
  { name: 'Pedro Porto', emails: ['jose.romero@pedroporto.pt'] },
  { name: 'PosiFlex', emails: ['mario.guillem@posiflex.es', 'miriam.ballester@posiflex.es'] },
  { name: 'PC Mira', emails: ['ramon.martinez@pcmira.com', 'lidia.alonso@pcmira.com'] },
  { name: 'Mayorista Canario', emails: ['comercial@mayoristacanario.com'] },
] as const

export function getSupplierEmails(name: string): readonly string[] {
  return SUPPLIERS.find((s) => s.name === name)?.emails ?? []
}

interface SupplierSelectProps {
  orderId: string
  currentSupplier: string | null
  onSupplierChange?: (supplier: string) => void
}

export default function SupplierSelect({ orderId, currentSupplier, onSupplierChange }: SupplierSelectProps) {
  const [supplier, setSupplier] = useState(currentSupplier ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setSupplier(currentSupplier ?? '') }, [currentSupplier])
  const [saved, setSaved] = useState(false)

  const handleChange = async (value: string) => {
    setSupplier(value)
    onSupplierChange?.(value)
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
      >
        <option value="">Sin proveedor</option>
        {SUPPLIERS.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name}
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
