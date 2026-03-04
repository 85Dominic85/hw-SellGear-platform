'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OrderCheckboxProps {
  orderId: string
  fieldName: string
  currentValue: boolean
  labelChecked: string
  labelUnchecked: string
  readOnly?: boolean
  colorClass?: {
    border: string
    bg: string
    text: string
  }
}

const DEFAULT_COLOR = {
  border: 'border-green-500',
  bg: 'bg-green-500',
  text: 'text-green-700',
}

export default function OrderCheckbox({
  orderId,
  fieldName,
  currentValue,
  labelChecked,
  labelUnchecked,
  readOnly,
  colorClass = DEFAULT_COLOR,
}: OrderCheckboxProps) {
  const [checked, setChecked] = useState(currentValue)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setChecked(currentValue) }, [currentValue])

  const handleToggle = async () => {
    if (readOnly) return
    const newValue = !checked
    setChecked(newValue)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ [fieldName]: newValue })
      .eq('id', orderId)

    setSaving(false)
    if (error) {
      setChecked(!newValue) // revert on error
    }
  }

  if (readOnly) {
    return (
      <span className={`text-sm ${checked ? `font-medium ${colorClass.text}` : 'text-gray-500'}`}>
        {checked ? labelChecked : labelUnchecked}
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
          checked
            ? `${colorClass.border} ${colorClass.bg} text-white`
            : 'border-gray-300 bg-white text-transparent group-hover:border-gray-400'
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className={`text-sm ${checked ? `font-medium ${colorClass.text}` : 'text-gray-500'}`}>
        {saving ? 'Guardando...' : checked ? labelChecked : labelUnchecked}
      </span>
    </button>
  )
}
