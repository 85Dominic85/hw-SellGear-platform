'use client'

import {
  cartTotals,
  effectiveTaxLabel,
  formatEurosCents,
} from '@/lib/pricing'
import {
  cartLineDetails,
  totalPackages as totalPackagesOf,
  totalsInput,
  type CartLineDetail,
} from '@/lib/cart-detail'
import type { Product } from '@/types/database'
import type { CartLineState } from './CartLine'

interface CartSummaryProps {
  lines: CartLineState[]
  products: Product[]
  /**
   * Si se provee, sobreescribe vat_rate para todas las lineas en el preview.
   * Lo usa NewOrderPage para mostrar IGIC 7 % cuando el shipping_cp es canario.
   * Es solo preview UI; el servidor recalcula al insertar.
   */
  vatRateOverride?: number | null
  /**
   * Descuento global (%) del pedido. Se aplica sobre la base imponible
   * agregada, prorrateado por línea antes del IVA. Se muestra como fila
   * "Descuento global" y modifica el TOTAL. Si el callback está presente,
   * se renderiza un input editable dentro del resumen.
   */
  discountGlobalPct?: number
  onDiscountGlobalChange?: (pct: number) => void
}

interface RowProps {
  label: React.ReactNode
  value: React.ReactNode
  bold?: boolean
  highlight?: boolean
}

function Row({ label, value, bold, highlight }: RowProps) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? 'text-base font-semibold' : 'text-sm'
      } ${highlight ? 'text-gray-900' : 'text-gray-700'}`}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  )
}

/**
 * Una línea del pedido en el resumen.
 *
 * El resumen solo enseñaba los totales. Al sustituir ProductCatalog (que
 * pintaba un CartLine por línea) por el catálogo en tarjetas, el comercial se
 * quedó sin ver QUÉ había elegido: para comprobarlo tenía que abrir el popup
 * del botón flotante o volver a recorrer el catálogo mirando los contadores.
 */
function LineRow({ detail }: { detail: CartLineDetail }) {
  const { name, qty, unitPriceCents, discountPct, discountCents, netCents } =
    detail

  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {detail.isGift && <span aria-hidden="true">🎁 </span>}
          {name}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {detail.product === null ? (
            <span className="text-brand-hover">Elige el producto</span>
          ) : detail.pendingPrice ? (
            <span className="text-brand-hover">Falta el precio acordado</span>
          ) : (
            <>
              {qty} × {formatEurosCents(unitPriceCents)}
              {discountPct > 0 && (
                <span className="text-brand-hover">
                  {' · '}
                  {detail.isGift ? 'regalo' : `−${discountPct} %`}
                  {' ('}−{formatEurosCents(discountCents)})
                </span>
              )}
            </>
          )}
        </p>
      </div>
      <span className="shrink-0 font-mono text-sm font-medium tabular-nums text-gray-900">
        {detail.product === null || detail.pendingPrice
          ? '—'
          : formatEurosCents(netCents)}
      </span>
    </li>
  )
}

export default function CartSummary({
  lines,
  products,
  vatRateOverride = null,
  discountGlobalPct = 0,
  onDiscountGlobalChange,
}: CartSummaryProps) {
  // Un único cálculo por línea para la lista Y para los totales (lib/cart-detail).
  // Antes cada bloque hacía el suyo y podían desviarse por un redondeo distinto.
  const detailed = cartLineDetails(lines, products, vatRateOverride)
  const computed = totalsInput(detailed)
  const totals = cartTotals(computed, discountGlobalPct)
  const totalPackages = totalPackagesOf(detailed)
  const editable = typeof onDiscountGlobalChange === 'function'
  // Se cuenta lo MISMO que pinta la lista de abajo (y que el botón flotante).
  // Antes se contaban solo las líneas con producto, así que la cabecera decía
  // "1 línea" con dos filas debajo.
  const unidades = detailed.reduce((n, d) => n + d.qty, 0)
  // El TOTAL no incluye las líneas de precio libre sin importe: hay que
  // decirlo, o el resumen promete una cifra que va a subir.
  const pendientes = detailed.filter((d) => d.pendingPrice).length

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Total del pedido</h3>
        {detailed.length > 0 && (
          <span className="text-xs text-gray-500">
            {detailed.length} {detailed.length === 1 ? 'línea' : 'líneas'} ·{' '}
            {unidades} ud.
          </span>
        )}
      </div>

      {/* Lista de productos */}
      {detailed.length === 0 ? (
        <p className="mb-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
          Todavía no has añadido ningún producto.
        </p>
      ) : (
        <>
        {/* Rótulo de la columna. CartLine, tres bloques más arriba, pinta la
            misma línea con su "Total c/IVA": sin decir de qué base habla cada
            una, el AE veía dos cifras con un 21 % de diferencia para el mismo
            producto. Aquí es s/IVA porque así la lista suma exactamente la
            base imponible de abajo. */}
        <p className="mb-1 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Importe s/IVA
        </p>
        <ul className="mb-3 divide-y divide-gray-100 border-y border-gray-100">
          {detailed.map((d) => (
            <LineRow key={d.index} detail={d} />
          ))}
        </ul>
        </>
      )}

      <div className="space-y-1.5">
        <Row label="Subtotal s/IVA" value={formatEurosCents(totals.subtotalCents)} />
        {totals.lineDiscountCents > 0 && (
          <Row
            label="Descuentos por línea"
            value={`− ${formatEurosCents(totals.lineDiscountCents)}`}
          />
        )}

        {/* Descuento global editable (o solo lectura si no hay callback) */}
        {(editable || totals.globalDiscountCents > 0) && (
          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>Descuento global (%)</span>
            <div className="flex items-center gap-2">
              {editable ? (
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={discountGlobalPct}
                  onChange={(e) => {
                    const raw = parseInt(e.target.value, 10)
                    const clamped = Number.isFinite(raw)
                      ? Math.max(0, Math.min(100, raw))
                      : 0
                    onDiscountGlobalChange!(clamped)
                  }}
                  className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-right font-mono text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  title="Descuento global sobre la base imponible del pedido (0-100)"
                />
              ) : (
                <span className="text-sm text-gray-700">{discountGlobalPct}%</span>
              )}
              <span className="font-mono tabular-nums text-red-500">
                {totals.globalDiscountCents > 0
                  ? `− ${formatEurosCents(totals.globalDiscountCents)}`
                  : '—'}
              </span>
            </div>
          </div>
        )}

        <Row
          label="Base imponible"
          value={formatEurosCents(totals.taxableCents)}
        />
        <Row
          label={effectiveTaxLabel(computed.map((c) => c.vatRate))}
          value={`+ ${formatEurosCents(totals.vatCents)}`}
        />
        <div className="my-2 border-t border-gray-200" />
        <Row
          label="TOTAL"
          value={formatEurosCents(totals.totalCents)}
          bold
          highlight
        />
        {/* El total omite las líneas de precio libre sin importe: entran con
            precio 0 y totalsInput solo descarta las que no tienen producto.
            El botón flotante ya lo avisaba, pero el FAB solo existe en el
            paso 2 y este resumen también se pinta en el paso 3. */}
        {pendientes > 0 && (
          <p className="pt-1 text-xs text-brand-hover">
            {pendientes} {pendientes === 1 ? 'línea' : 'líneas'} sin precio: el
            TOTAL todavía no {pendientes === 1 ? 'la' : 'las'} incluye.
          </p>
        )}
        {/* En transferencias SaaS no hay envío, así que una fila de bultos a 0
            solo sería ruido. */}
        {totalPackages > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
            <span>Bultos TIPSA (estimado)</span>
            <span className="font-mono tabular-nums">{totalPackages}</span>
          </div>
        )}
      </div>
    </div>
  )
}
