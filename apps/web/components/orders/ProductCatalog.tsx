'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import type { Product, ProductCategory } from '@/types/database'
import { formatEurosCents } from '@/lib/pricing'
import CartLine, { EMPTY_LINE, type CartLineState } from './CartLine'

interface ProductCatalogProps {
  products: Product[]
  items: CartLineState[]
  onItemsChange: (items: CartLineState[]) => void
  /**
   * Override de vat_rate para el preview de las lineas libres (CartLine).
   * El catalogo visual NO suma IVA aqui (cada tile muestra el precio s/IVA
   * + IVA por separado, igual que el catalogo en papel).
   */
  vatRateOverride?: number | null
}

interface CategoryFilter {
  key: ProductCategory | 'all'
  label: string
}

const CATEGORY_FILTERS: CategoryFilter[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pack', label: 'Packs' },
  { key: 'tpv', label: 'TPV' },
  { key: 'kds', label: 'KDS' },
  { key: 'printer', label: 'Impresoras' },
  { key: 'accessory', label: 'Accesorios' },
  { key: 'network', label: 'Red / WiFi' },
]

const CATEGORY_ICON: Record<ProductCategory, string> = {
  pack: '📦',
  tpv: '🖥️',
  kds: '🍳',
  printer: '🧾',
  accessory: '💼',
  network: '📡',
  saas_hardware: '🧩',
  custom: '✏️',
}

/**
 * Catalogo visual de productos. Reemplaza el ProductPicker (select plano)
 * con tiles tipo e-commerce: imagen + precio + descripcion + boton add.
 *
 * Productos visibles: todos los activos excepto los SKUs especiales
 *   - 'otro' (custom, fuera de catalogo)
 *   - cualquiera en category='saas_hardware' (oferta interna libre)
 * Esos dos se anaden via boton "Anadir linea libre" que abre CartLine
 * con su UI extra de descripcion + precio negociado.
 */
export default function ProductCatalog({
  products,
  items,
  onItemsChange,
  vatRateOverride = null,
}: ProductCatalogProps) {
  const [activeCategory, setActiveCategory] = useState<
    ProductCategory | 'all'
  >('all')

  // Productos visibles en el catalogo publico.
  const visibleProducts = useMemo(
    () =>
      products
        .filter(
          (p) =>
            p.code !== 'otro' &&
            p.category !== 'saas_hardware' &&
            p.category !== 'custom',
        )
        .filter(
          (p) => activeCategory === 'all' || p.category === activeCategory,
        )
        .sort((a, b) => a.sort_order - b.sort_order),
    [products, activeCategory],
  )

  // Mapa producto -> qty actual en el carrito (para mostrar badge en el tile).
  const qtyByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const it of items) {
      if (!it.product_id) continue
      map.set(it.product_id, (map.get(it.product_id) ?? 0) + it.qty)
    }
    return map
  }, [items])

  // Lineas libres = product_id null (recien anadidas) o con SKU 'otro' /
  // category 'saas_hardware'. Estas mantienen CartLine completo.
  const freeLineIndexes: number[] = items
    .map((it, idx) => {
      if (!it.product_id) return idx
      const p = products.find((x) => x.id === it.product_id)
      return p?.code === 'otro' || p?.category === 'saas_hardware' ? idx : -1
    })
    .filter((idx) => idx >= 0)

  function addProduct(product: Product) {
    // Si la unica linea es la EMPTY inicial, sustituyela en vez de anadir.
    if (
      items.length === 1 &&
      items[0].product_id === null &&
      items[0].product_name_override === '' &&
      items[0].unit_price_override_cents === null
    ) {
      onItemsChange([
        { ...EMPTY_LINE, product_id: product.id, qty: 1 },
      ])
      return
    }
    // Si ya hay una linea con este producto, +1 qty.
    const idx = items.findIndex((it) => it.product_id === product.id)
    if (idx >= 0) {
      const next = [...items]
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
      onItemsChange(next)
      return
    }
    // Anadir linea nueva.
    onItemsChange([
      ...items,
      { ...EMPTY_LINE, product_id: product.id, qty: 1 },
    ])
  }

  function adjustQty(productId: string, delta: number) {
    const idx = items.findIndex((it) => it.product_id === productId)
    if (idx < 0) return
    const next = [...items]
    const newQty = next[idx].qty + delta
    if (newQty <= 0) {
      next.splice(idx, 1)
      onItemsChange(next.length === 0 ? [{ ...EMPTY_LINE }] : next)
      return
    }
    next[idx] = { ...next[idx], qty: newQty }
    onItemsChange(next)
  }

  function addFreeLine() {
    onItemsChange([...items, { ...EMPTY_LINE }])
  }

  function updateLine(index: number, partial: Partial<CartLineState>) {
    onItemsChange(items.map((it, i) => (i === index ? { ...it, ...partial } : it)))
  }

  function removeLine(index: number) {
    const next = items.filter((_, i) => i !== index)
    onItemsChange(next.length === 0 ? [{ ...EMPTY_LINE }] : next)
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_FILTERS.map((f) => (
          <button
            type="button"
            key={f.key}
            onClick={() => setActiveCategory(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === f.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid de productos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProducts.map((p) => (
          <ProductTile
            key={p.id}
            product={p}
            qty={qtyByProduct.get(p.id) ?? 0}
            onAdd={() => addProduct(p)}
            onInc={() => adjustQty(p.id, 1)}
            onDec={() => adjustQty(p.id, -1)}
          />
        ))}
        {visibleProducts.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            No hay productos en esta categoría.
          </div>
        )}
      </div>

      {/* Linea libre: boton */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[200px]">
            <h4 className="text-sm font-medium text-gray-900">
              Producto fuera de catálogo o SaaS + Hardware
            </h4>
            <p className="mt-0.5 text-xs text-gray-600">
              Para solicitudes puntuales o ofertas mixtas con descripción y precio
              negociados por el AE.
            </p>
          </div>
          <button
            type="button"
            onClick={addFreeLine}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-100"
          >
            + Añadir línea libre
          </button>
        </div>
      </div>

      {/* Lineas libres existentes (CartLine completo con UI de overrides).
          El picker se restringe a SKUs libres ('otro' / 'saas_hardware')
          para evitar que el AE pique productos estandar aqui (esos van por
          tiles del catalogo). */}
      {freeLineIndexes.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Líneas libres
          </h4>
          {freeLineIndexes.map((idx) => (
            <CartLine
              key={idx}
              index={idx}
              line={items[idx]}
              products={products.filter(
                (p) => p.code === 'otro' || p.category === 'saas_hardware',
              )}
              canRemove
              onChange={updateLine}
              onRemove={removeLine}
              vatRateOverride={vatRateOverride}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// ProductTile (inline component, no se exporta — uso interno)
// ============================================================

interface ProductTileProps {
  product: Product
  qty: number
  onAdd: () => void
  onInc: () => void
  onDec: () => void
}

function ProductTile({ product, qty, onAdd, onInc, onDec }: ProductTileProps) {
  const [imgError, setImgError] = useState(false)
  const inCart = qty > 0

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-white shadow-sm transition-all hover:shadow-md ${
        inCart ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'
      }`}
    >
      {/* Imagen */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-gray-50">
        {!imgError ? (
          <Image
            src={`/products/${product.code}.png`}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-contain p-3"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-4xl">
            <span aria-hidden="true">{CATEGORY_ICON[product.category]}</span>
          </div>
        )}
        {inCart && (
          <span className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
            × {qty}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold text-gray-900 leading-tight">
          {product.name}
        </h3>
        {product.description && (
          <p className="line-clamp-2 text-xs text-gray-600 leading-snug">
            {product.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-base font-bold text-gray-900">
            {formatEurosCents(product.price_cents)}
            <span className="ml-1 text-xs font-normal text-gray-500">+ IVA</span>
          </span>

          {!inCart ? (
            <button
              type="button"
              onClick={onAdd}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700"
            >
              + Añadir
            </button>
          ) : (
            <div className="flex items-center gap-0 rounded-lg ring-1 ring-gray-200">
              <button
                type="button"
                onClick={onDec}
                className="h-7 w-7 rounded-l-lg text-sm font-bold text-gray-600 transition-colors hover:bg-gray-100"
                aria-label={`Quitar uno de ${product.name}`}
              >
                −
              </button>
              <span className="min-w-[1.5rem] px-1 text-center text-sm font-medium text-gray-900">
                {qty}
              </span>
              <button
                type="button"
                onClick={onInc}
                className="h-7 w-7 rounded-r-lg text-sm font-bold text-gray-600 transition-colors hover:bg-gray-100"
                aria-label={`Añadir uno de ${product.name}`}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
