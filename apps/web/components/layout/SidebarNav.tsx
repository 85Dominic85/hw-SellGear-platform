'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'
import { isAdminUser } from '@/lib/auth'

interface SidebarNavProps {
  userEmail?: string | null
  userRole?: UserRole | null
  badgeCounts?: Record<string, number>
  totalNew?: number
}

const NAV_ITEMS = [
  {
    label: 'Todos los pedidos',
    href: '/orders',
    type: null,
    icon: (
      <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: 'Nuevo pedido',
    href: '/orders/new',
    type: '__new__',
    icon: (
      <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
]

const CATEGORY_ITEMS = [
  {
    label: 'KIT Digital',
    type: 'kit_digital',
    icon: (
      <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Hardware One Off',
    type: 'hardware_one_off',
    icon: (
      <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: 'Hardware Financiacion',
    type: 'hardware_financiacion',
    icon: (
      <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    label: 'Transferencias SaaS',
    type: 'transferencias_saas',
    icon: (
      <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    label: 'Otro',
    type: 'otro',
    icon: (
      <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
      </svg>
    ),
  },
]

const ADMIN_ITEMS = [
  {
    label: 'Usuarios',
    href: '/admin/users',
    icon: (
      <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
]

const linkClass = (active: boolean) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
    active
      ? 'bg-white/15 text-white font-medium'
      : 'text-gray-400 hover:bg-white/10 hover:text-white'
  )

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export default function SidebarNav({ userEmail, userRole, badgeCounts = {}, totalNew = 0 }: SidebarNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const currentType = searchParams.get('type')
  const [clearing, setClearing] = useState(false)

  const isTodos = pathname === '/orders' && !currentType
  const isNew = pathname === '/orders/new'
  const showAdmin = isAdminUser(userEmail, userRole)

  const handleClearNotifications = async () => {
    setClearing(true)
    try {
      await fetch('/api/notifications/clear', { method: 'POST' })
      router.refresh()
    } finally {
      setClearing(false)
    }
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {/* Seccion principal */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Pedidos
          </p>
          {totalNew > 0 && (
            <button
              onClick={handleClearNotifications}
              disabled={clearing}
              className="text-[10px] text-gray-500 hover:text-white transition-colors disabled:opacity-50"
              title="Limpiar notificaciones"
            >
              {clearing ? '...' : 'Limpiar'}
            </button>
          )}
        </div>
        <Link href="/orders" className={linkClass(isTodos)}>
          {NAV_ITEMS[0].icon}
          Todos los pedidos
          <Badge count={totalNew} />
        </Link>
        <Link href="/orders/new" className={linkClass(isNew)}>
          {NAV_ITEMS[1].icon}
          Nuevo pedido
        </Link>
      </div>

      {/* Categorias */}
      <div className="space-y-1">
        <p className="px-2 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Categorias
        </p>
        {CATEGORY_ITEMS.map((item) => {
          const active = pathname === '/orders' && currentType === item.type
          return (
            <Link
              key={item.type}
              href={`/orders?type=${item.type}`}
              className={linkClass(active)}
            >
              {item.icon}
              {item.label}
              <Badge count={badgeCounts[item.type] ?? 0} />
            </Link>
          )
        })}
      </div>

      {/* Admin - solo visible para admins */}
      {showAdmin && (
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Administracion
          </p>
          {ADMIN_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(active)}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}
