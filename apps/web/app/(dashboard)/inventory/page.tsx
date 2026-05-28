import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

// Solo internos. viewer no entra (ni siquiera ve el item en el sidebar).
const ALLOWED_ROLES: UserRole[] = ['admin', 'manager', 'hardware', 'commercial']

interface InventoryRow {
  tipo_articulo: string
  total_unidades_nuevas: number
}

interface RawRow {
  tipo_articulo: string
  total_unidades_nuevas: number | string // BIGINT puede venir como string
}

export default async function InventoryPage() {
  const supabase = await createClient()

  // 1. Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // 2. Role check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !ALLOWED_ROLES.includes(profile.role as UserRole)) {
    redirect('/')
  }

  // 3. RPC: trae unidades disponibles + nuevas agrupadas por article_type.
  //    La función vive en public.get_inventory_by_type() y encapsula el
  //    acceso a hw_staging con SECURITY DEFINER + role check.
  const { data: rawRows, error } = await supabase.rpc('get_inventory_by_type')

  const rows: InventoryRow[] = (rawRows as RawRow[] | null ?? []).map((r) => ({
    tipo_articulo: r.tipo_articulo,
    total_unidades_nuevas: Number(r.total_unidades_nuevas),
  }))
  const total = rows.reduce((acc, r) => acc + r.total_unidades_nuevas, 0)
  const tiposCount = rows.length

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="mt-1 text-sm text-gray-500">
          Unidades nuevas disponibles agrupadas por tipo de artículo.
        </p>
      </div>

      {/* KPI hero */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">
            Stock total nuevo disponible
          </p>
          <p className="mt-2 font-mono text-3xl font-bold text-gray-900">{total}</p>
          <p className="mt-1 text-xs text-gray-400">
            {tiposCount} tipo{tiposCount === 1 ? '' : 's'} de artículo
          </p>
        </div>
        {/* Huecos intencionados en el grid para futuras métricas
            (usadas, en mantenimiento, etc.) sin tocar layout. */}
      </div>

      {/* Tabla / estados */}
      {error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          Error al cargar el inventario: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="mb-4 h-12 w-12 text-gray-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
          <p className="text-sm font-medium text-gray-500">
            No hay unidades disponibles
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Cuando lleguen nuevas unidades nuevas aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tipo de artículo
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Unidades nuevas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr
                  key={row.tipo_articulo}
                  className="transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.tipo_articulo}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-900">
                    {row.total_unidades_nuevas}
                  </td>
                </tr>
              ))}
              {/* Fila Total — coherente con el patrón thead (bg-gray-50 +
                  uppercase tracking-wider + text-gray-500) pero el número
                  en font-bold para destacar el agregado. */}
              <tr className="bg-gray-50">
                <td className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm font-bold text-gray-900">
                  {total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
