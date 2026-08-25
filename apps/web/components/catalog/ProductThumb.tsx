import Image from 'next/image'
import type { Product } from '@/types/database'
import { productImageUrl } from '@/lib/product-rules'
import { categoryMeta } from '@/lib/catalog-taxonomy'
import { catalogIcon } from './catalog-icons'

/**
 * Miniatura cuadrada de producto para listas densas (modal de añadir
 * artículo). No usa las clases del catálogo: vive en superficies con la
 * estética del dashboard, así que va en Tailwind.
 */
export default function ProductThumb({
  product,
  size = 36,
}: {
  product: Product
  size?: number
}) {
  const src = productImageUrl(product)
  const Icon = catalogIcon(categoryMeta(product.category)?.icon ?? 'Package')

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-contain p-0.5"
        />
      ) : (
        <Icon size={size * 0.5} className="text-gray-400" aria-hidden="true" />
      )}
    </span>
  )
}
