'use client'

import type { RequesterRankingRow } from '@/types/metrics'

interface RequesterPodiumProps {
  ranking: RequesterRankingRow[]
}

/**
 * Podium de los 3 solicitantes que más equipos físicos han vendido en
 * el periodo seleccionado, con tabla de rank #4-20 debajo.
 *
 * Estilo Qamarero:
 * - Cards `rounded-xl border bg-white shadow-sm`.
 * - Borde lateral accent por posición (gold/silver/bronze).
 * - Datos numéricos en font-mono (Space Mono).
 * - Empty state con borde discontinuo cuando no hay datos.
 */
export default function RequesterPodium({ ranking }: RequesterPodiumProps) {
  if (ranking.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="mb-3 h-10 w-10 text-gray-300"
        >
          {/* heroicons trophy */}
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
          />
        </svg>
        <p className="text-sm font-medium text-gray-500">
          Sin ventas en este periodo
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Ajusta el filtro de periodo o tipo de compra para ver el ranking.
        </p>
      </div>
    )
  }

  // Top 3 para el podium, resto para la tabla.
  const top3 = ranking.slice(0, 3)
  const rest = ranking.slice(3)

  // Para el orden visual del podium (2-1-3, convención olímpica):
  // - Centro: #1 (siempre presente si top3.length >= 1)
  // - Izquierda: #2 (presente si top3.length >= 2)
  // - Derecha: #3 (presente si top3.length >= 3)
  const second = top3[1] ?? null
  const first = top3[0] ?? null
  const third = top3[2] ?? null

  return (
    <div className="space-y-6">
      {/* Podium: 2-1-3 en desktop, 1-2-3 stacked en móvil */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        {/* Mobile: orden 1-2-3 (sm:order resetea en desktop) */}
        <PodiumCard rank={2} row={second} />
        <PodiumCard rank={1} row={first} highlighted />
        <PodiumCard rank={3} row={third} />
      </div>

      {/* Tabla con resto del ranking */}
      {rest.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-12">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Solicitante
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Equipos
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Pedidos
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rest.map((row, idx) => (
                <tr
                  key={row.requester_email}
                  className="transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-mono text-sm text-gray-400">
                    {idx + 4}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.requester_name?.trim() || row.requester_email}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-900">
                    {row.total_equipment_qty}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">
                    {row.total_orders}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ranking.length === 20 && (
        <p className="text-center text-xs text-gray-400">
          Mostrando los 20 solicitantes con más equipos vendidos.
        </p>
      )}
    </div>
  )
}

interface PodiumCardProps {
  rank: 1 | 2 | 3
  row: RequesterRankingRow | null
  highlighted?: boolean
}

function PodiumCard({ rank, row, highlighted }: PodiumCardProps) {
  // Color accent por posición. Solo borde-izquierdo, sin fondo.
  const accentBorder =
    rank === 1
      ? 'border-l-4 border-l-amber-400'
      : rank === 2
        ? 'border-l-4 border-l-gray-400'
        : 'border-l-4 border-l-orange-400'

  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'

  // Si no hay row (menos de 3 solicitantes), pintamos hueco gris claro.
  if (!row) {
    return (
      <div
        className={`rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm ${highlighted ? 'sm:py-7' : ''}`}
      >
        <div className="flex items-center gap-2 text-gray-300">
          <span className="text-2xl">{medal}</span>
          <span className="text-sm font-semibold uppercase tracking-wider">
            #{rank}
          </span>
        </div>
        <p className="mt-4 text-sm text-gray-300">—</p>
        <p className="mt-3 font-mono text-2xl font-bold text-gray-300">—</p>
        <p className="mt-1 text-xs text-gray-300">Sin datos</p>
      </div>
    )
  }

  const displayName = row.requester_name?.trim() || row.requester_email
  // Tamaño extra para el #1 en desktop (sm:py-7 vs py-5).
  const paddingClass = highlighted ? 'p-5 sm:py-7' : 'p-5'

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white ${paddingClass} shadow-sm ${accentBorder}`}
    >
      <div className="flex items-center gap-2 text-gray-500">
        <span className="text-2xl">{medal}</span>
        <span className="text-sm font-semibold uppercase tracking-wider">
          #{rank}
        </span>
      </div>
      <p
        className="mt-4 truncate text-sm font-medium text-gray-900"
        title={displayName}
      >
        {displayName}
      </p>
      <p
        className={`mt-2 font-mono font-bold text-gray-900 ${highlighted ? 'text-4xl' : 'text-3xl'}`}
      >
        {row.total_equipment_qty}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        equipos &nbsp;·&nbsp;{' '}
        <span className="font-mono">{row.total_orders}</span> pedido
        {row.total_orders === 1 ? '' : 's'}
      </p>
    </div>
  )
}
