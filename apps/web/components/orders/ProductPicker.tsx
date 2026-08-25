'use client'

import type { Product, ProductCategory } from '@/types/database'
import { CATEGORY_ORDER, categoryShortLabel } from '@/lib/catalog-taxonomy'
import { isFreePrice } from '@/lib/product-rules'

interface ProductPickerProps {
  value: string | null
  onChange: (productId: string) => void
  products: Product[]
  disabled?: boolean
}

export default function ProductPicker({
  value,
  onChange,
  products,
  disabled,
}: ProductPickerProps) {
  const grouped = new Map<ProductCategory, Product[]>()
  for (const p of products) {
    const list = grouped.get(p.category) ?? []
    list.push(p)
    grouped.set(p.category, list)
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-gray-50 disabled:text-gray-400"
    >
      <option value="">Selecciona un producto…</option>
      {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((category) => (
        <optgroup key={category} label={categoryShortLabel(category)}>
          {grouped.get(category)!.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {/* Los productos de precio libre no tienen precio que mostrar:
                  lo introduce el AE en la línea. */}
              {!isFreePrice(p) && ` — ${(p.price_cents / 100).toFixed(2)} €`}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
