'use client'

import { useMemo, useState } from 'react'
import { Gift, Palmtree, PlusCircle } from 'lucide-react'
import type { Product, ProductRegion, PurchaseType } from '@/types/database'
import { formatEurosCents } from '@/lib/pricing'
import { isFreePrice } from '@/lib/product-rules'
import {
  IMPL_PRO_CODE,
  TABLET_GIFT_CODE,
  applyAddFreeLine,
  applyAddProduct,
  applyAddTabletGift,
  applyAdjustQty,
  applyDeclineTabletGift,
  applyRemoveLine,
  applyUpdateLine,
  findByCode,
  hasProduct,
  qtyByProduct,
  tabletGiftIndex,
  type CartLineState,
} from '@/lib/catalog/rules'
import CatalogRoot from '@/components/catalog/CatalogRoot'
import CatalogExplorer from '@/components/catalog/CatalogExplorer'
import ProductDetailModal from '@/components/catalog/ProductDetailModal'
import CartLine from './CartLine'

interface Step2CatalogProps {
  products: Product[]
  items: CartLineState[]
  onItemsChange: (items: CartLineState[]) => void
  /** Override de IVA para el preview de las líneas (CP canario). */
  vatRateOverride?: number | null
  purchaseType?: PurchaseType | ''
  /** Región elegida en el paso 2; prerrellena el CP del paso 3. */
  region: ProductRegion
  onRegionChange: (region: ProductRegion) => void
}

/**
 * Paso 2 del wizard con la estética del catálogo comercial.
 *
 * Sustituye a ProductCatalog.tsx manteniendo TODAS sus reglas — solo que
 * ahora viven en lib/catalog/rules.ts y las comparte con /catalogo:
 *   · tablet regalo al añadir Implementación Pro (y se retira con él)
 *   · línea libre para producto fuera de catálogo u oferta mixta
 *   · transferencias SaaS solo muestra software e implementación
 *
 * Lo nuevo es el toggle de región: el CP se pide en el paso 3, así que sin
 * esto el comercial podría mezclar precios peninsulares y canarios, que son
 * dos listas distintas. El servidor lo rechaza igualmente, pero descubrirlo
 * al confirmar el pedido sería el peor momento.
 */
export default function Step2Catalog({
  products,
  items,
  onItemsChange,
  vatRateOverride = null,
  purchaseType = '',
  region,
  onRegionChange,
}: Step2CatalogProps) {
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  // Marca local para no volver a preguntar por el regalo si ya dijo que no.
  const [giftDeclined, setGiftDeclined] = useState(false)

  const isSaasOnly = purchaseType === 'transferencias_saas'
  const implPro = useMemo(() => findByCode(products, IMPL_PRO_CODE), [products])
  const tablet = useMemo(() => findByCode(products, TABLET_GIFT_CODE), [products])
  const qtyMap = useMemo(() => qtyByProduct(items), [items])

  const hasImplPro = implPro !== null && hasProduct(items, implPro.id)
  const hasGift = tabletGiftIndex(items, tablet) >= 0
  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  )

  /** Líneas libres: se editan con CartLine, el resto se toca desde la tarjeta. */
  const freeLineIdx = items
    .map((line, idx) => ({ line, idx }))
    .filter(({ line }) => {
      if (!line.product_id) return true
      const p = productById.get(line.product_id)
      return p ? isFreePrice(p) && p.category === 'custom' : true
    })
    .map(({ idx }) => idx)

  /** Solo los SKU que admiten descripción libre pueden elegirse en una línea libre. */
  const freeLineProducts = useMemo(
    () => products.filter((p) => isFreePrice(p) && p.category === 'custom'),
    [products],
  )

  return (
    <CatalogRoot fluid>
      {isSaasOnly && (
        <div className="mb-4 rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-800 ring-1 ring-blue-200">
          Transferencias SaaS solo comercializa software (sin envío físico).
          Selecciona Software Qamarero y/o Implementación Pro y define el precio
          acordado con el cliente.
        </div>
      )}

      {/* Toggle de región. Oculto en transferencias SaaS: no hay envío. */}
      {!isSaasOnly && (
        <label className="mb-4 flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed border-brand/40 bg-brand/5 px-4 py-3">
          <input
            type="checkbox"
            checked={region === 'canarias'}
            onChange={(e) =>
              onRegionChange(e.target.checked ? 'canarias' : 'peninsula')
            }
            className="h-4 w-4 accent-brand"
          />
          <Palmtree size={17} className="text-brand" aria-hidden="true" />
          <span className="flex-1 min-w-[240px]">
            <span className="block text-sm font-medium text-gray-900">
              ¿El envío es a Canarias?
            </span>
            <span className="mt-0.5 block text-xs text-gray-600">
              Canarias tiene su propia lista de precios, con importes finales sin
              IVA. Al marcarlo, el catálogo muestra solo esos productos.
            </span>
          </span>
        </label>
      )}

      <CatalogExplorer
        products={products}
        qtyByProductId={qtyMap}
        mode="inline"
        onOpenDetail={setDetailProduct}
        purchaseType={purchaseType}
        showHeading={false}
        lockedTab={isSaasOnly ? 'service' : undefined}
        onAdd={(p) => onItemsChange(applyAddProduct(items, p))}
        onInc={(p) => onItemsChange(applyAdjustQty(items, p.id, 1))}
        onDec={(p) => {
          const next = applyAdjustQty(items, p.id, -1, { implPro, tablet })
          if (implPro && p.id === implPro.id) setGiftDeclined(false)
          onItemsChange(next)
        }}
      />

      {/* Panel de tablet regalo. La regla es de cliente: en la BD la línea es
          un descuento del 100 %, indistinguible de uno manual. */}
      {!isSaasOnly && hasImplPro && tablet && (
        <div
          className={`mt-5 rounded-xl border p-4 ${
            hasGift
              ? 'border-brand/40 bg-brand/5'
              : 'border-dashed border-brand/30 bg-brand/5'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Gift size={20} className="text-brand" aria-hidden="true" />
            <div className="min-w-[240px] flex-1">
              <h4 className="text-sm font-medium text-gray-900">
                ¿Este pedido incluye {tablet.name} como regalo?
              </h4>
              <p className="mt-0.5 text-xs text-gray-600">
                Añade una línea con 100 % de descuento (valor{' '}
                <span className="font-mono">
                  {formatEurosCents(tablet.price_cents)}
                </span>
                ). Marca «Sí» solo si el paquete acordado la incluye.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onItemsChange(applyAddTabletGift(items, tablet))
                  setGiftDeclined(false)
                }}
                disabled={hasGift}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  hasGift
                    ? 'cursor-default bg-brand text-white'
                    : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-brand hover:text-white'
                }`}
              >
                Sí, añadir
              </button>
              <button
                type="button"
                onClick={() => {
                  setGiftDeclined(true)
                  onItemsChange(applyDeclineTabletGift(items, tablet))
                }}
                disabled={!hasGift && giftDeclined}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  !hasGift && giftDeclined
                    ? 'cursor-default bg-gray-200 text-gray-700'
                    : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100'
                }`}
              >
                No, sin tablet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Línea libre: producto fuera de catálogo u oferta SaaS + Hardware. */}
      {!isSaasOnly && (
        <div className="mt-5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-[220px] flex-1">
              <h4 className="text-sm font-medium text-gray-900">
                Producto fuera de catálogo o SaaS + Hardware
              </h4>
              <p className="mt-0.5 text-xs text-gray-600">
                Para solicitudes puntuales u ofertas mixtas, con descripción y
                precio negociados por el AE.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onItemsChange(applyAddFreeLine(items))}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-100"
            >
              <PlusCircle size={15} aria-hidden="true" /> Añadir línea libre
            </button>
          </div>
        </div>
      )}

      {/* Solo las líneas libres necesitan CartLine: el resto se ajusta desde
          la tarjeta, así que repetir aquí un selector deshabilitado con el
          producto ya elegido —como hacía ProductCatalog— era ruido. */}
      {freeLineIdx.length > 0 && (
        <div className="mt-5 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Líneas libres
          </h4>
          {freeLineIdx.map((idx) => (
            <CartLine
              key={idx}
              index={idx}
              line={items[idx]}
              products={freeLineProducts}
              canRemove
              onChange={(i, partial) => onItemsChange(applyUpdateLine(items, i, partial))}
              onRemove={(i) => onItemsChange(applyRemoveLine(items, i))}
              vatRateOverride={vatRateOverride}
              lockProduct={false}
            />
          ))}
        </div>
      )}

      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          qty={qtyMap.get(detailProduct.id) ?? 0}
          onClose={() => setDetailProduct(null)}
          onAdd={(p) => onItemsChange(applyAddProduct(items, p))}
          onInc={(p) => onItemsChange(applyAdjustQty(items, p.id, 1))}
          onDec={(p) =>
            onItemsChange(applyAdjustQty(items, p.id, -1, { implPro, tablet }))
          }
        />
      )}
    </CatalogRoot>
  )
}
