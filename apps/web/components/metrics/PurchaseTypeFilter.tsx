'use client'

import { PURCHASE_TYPE_LABELS } from '@/lib/utils'
import type { PurchaseType } from '@/types/database'

interface PurchaseTypeFilterProps {
  value: PurchaseType | 'all'
  onChange: (value: PurchaseType | 'all') => void
}

export default function PurchaseTypeFilter({ value, onChange }: PurchaseTypeFilterProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PurchaseType | 'all')}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm"
    >
      <option value="all">Todos los tipos</option>
      {(Object.entries(PURCHASE_TYPE_LABELS) as [PurchaseType, string][]).map(([key, label]) => (
        <option key={key} value={key}>{label}</option>
      ))}
    </select>
  )
}
