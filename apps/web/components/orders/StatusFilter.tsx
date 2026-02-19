'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { STATUS_LABELS } from '@/lib/utils'
import type { OrderStatus } from '@/types/database'
import { cn } from '@/lib/utils'

const ALL_STATUSES = Object.keys(STATUS_LABELS) as OrderStatus[]

export default function StatusFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentStatus = searchParams.get('status') ?? ''

  function handleClick(status: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (status === '') {
      params.delete('status')
    } else {
      params.set('status', status)
    }
    // Reset to first page when filtering
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => handleClick('')}
        className={cn(
          'rounded-full px-3 py-1 text-sm font-medium transition-colors',
          currentStatus === ''
            ? 'bg-gray-900 text-white'
            : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
        )}
      >
        Todos
      </button>
      {ALL_STATUSES.map((status) => (
        <button
          key={status}
          onClick={() => handleClick(status)}
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium transition-colors',
            currentStatus === status
              ? 'bg-gray-900 text-white'
              : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
          )}
        >
          {STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  )
}
