'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Truck, Building2, Package } from 'lucide-react'

type ShippingOrigin = '' | 'enviado' | 'enviado_proveedor'

const OPTIONS: { value: ShippingOrigin; label: string; icon: typeof Truck }[] = [
  { value: '', label: 'Todos', icon: Package },
  { value: 'enviado', label: 'Oficina', icon: Building2 },
  { value: 'enviado_proveedor', label: 'Proveedor', icon: Truck },
]

export default function ShippingOriginFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentOrigin = (searchParams.get('shipping') ?? '') as ShippingOrigin

  function handleClick(origin: ShippingOrigin) {
    const params = new URLSearchParams(searchParams.toString())
    if (origin === '') {
      params.delete('shipping')
    } else {
      params.set('shipping', origin)
    }
    params.delete('status') // limpiar filtro de estado al filtrar por origen
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mr-1">Origen:</span>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => handleClick(value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            currentOrigin === value
              ? 'bg-gray-900 text-white'
              : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
          )}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  )
}
