'use client'

import type { PurchaseType } from '@/types/database'
import { PURCHASE_TYPE_LABELS } from '@/lib/utils'

interface PurchaseTypeTileProps {
  type: PurchaseType
  selected: boolean
  onSelect: () => void
}

// Iconos por tipo de compra. Mismos trazos que home/CategoryTile para
// que el AE reconozca al instante el tile en el dashboard.
const ICONS: Record<PurchaseType, React.ReactNode> = {
  kit_digital: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  hardware_one_off: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  hardware_financiacion: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  transferencias_saas: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  saas_hardware: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6" />
    </svg>
  ),
  otro: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  ),
}

const DESCRIPTIONS: Record<PurchaseType, string> = {
  kit_digital:           'Pack subvencionado KIT Digital con factura para el cliente.',
  hardware_one_off:      'Venta puntual de hardware. Pago único.',
  hardware_financiacion: 'Venta de hardware con financiación / pago aplazado.',
  transferencias_saas:   'Transferencia bancaria por acuerdo SaaS. Sin envío físico.',
  saas_hardware:         'Oferta mixta SaaS + Hardware con precio negociado por el AE.',
  otro:                  'Otros casos no cubiertos por las categorías anteriores.',
}

const PURCHASE_TYPE_ORDER: PurchaseType[] = [
  'hardware_one_off',
  'hardware_financiacion',
  'kit_digital',
  'saas_hardware',
  'transferencias_saas',
  'otro',
]

export { PURCHASE_TYPE_ORDER }

export default function PurchaseTypeTile({
  type,
  selected,
  onSelect,
}: PurchaseTypeTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex flex-col gap-3 rounded-xl border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md ${
        selected
          ? 'border-gray-900 ring-2 ring-gray-900'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            selected
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 group-hover:bg-gray-200'
          }`}
        >
          {ICONS[type]}
        </span>
        <h3 className="text-sm font-semibold text-gray-900">
          {PURCHASE_TYPE_LABELS[type]}
        </h3>
      </div>
      <p className="text-xs leading-relaxed text-gray-600">{DESCRIPTIONS[type]}</p>
    </button>
  )
}
