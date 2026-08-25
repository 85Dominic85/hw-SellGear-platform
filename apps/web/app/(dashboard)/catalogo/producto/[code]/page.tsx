import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { canCreateOrder } from '@/lib/auth'
import type { UserRole } from '@/types/database'
import { getCatalog, getCatalogProduct } from '@/lib/catalog/queries'
import { categoryLabel } from '@/lib/catalog-taxonomy'
import { isCatalogVisible, isHiddenFromCatalog } from '@/lib/product-rules'
import CatalogRoot from '@/components/catalog/CatalogRoot'
import ProductDetailBrowser from '@/components/catalog/ProductDetailBrowser'
import ProductGrid from '@/components/catalog/ProductGrid'
import RelatedProducts from '@/components/catalog/RelatedProducts'

interface Props {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: Props) {
  const { code } = await params
  const product = await getCatalogProduct(code)
  return { title: product?.name ?? 'Producto' }
}

export default async function ProductoPage({ params }: Props) {
  const { code } = await params
  const product = await getCatalogProduct(code)
  // `otro` es el mecanismo de línea libre, no un producto con ficha.
  if (!product || isHiddenFromCatalog(product)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user!.id)
    .single()
  const role = profile?.role as UserRole | undefined

  const products = await getCatalog()
  // Relacionados: misma familia Y misma región. Un TPV canario no debe
  // sugerir TPV peninsulares, porque son otra lista de precios.
  const related = products
    .filter(
      (p) =>
        p.id !== product.id &&
        p.category === product.category &&
        (p.region ?? 'peninsula') === (product.region ?? 'peninsula') &&
        isCatalogVisible(p, { region: product.region ?? 'peninsula' }),
    )
    .slice(0, 3)

  const backHref = `/catalogo/${product.region === 'canarias' ? 'canarias' : product.category}`

  return (
    <CatalogRoot fluid>
      <div className="section-shell" style={{ paddingTop: 24 }}>
        <Link href={backHref} className="back-link">
          <ArrowLeft size={16} aria-hidden="true" />{' '}
          {product.region === 'canarias'
            ? 'Productos para Canarias'
            : categoryLabel(product.category)}
        </Link>
      </div>

      <ProductDetailBrowser
        product={product}
        products={products}
        canCreateOrder={canCreateOrder(role)}
        related={
          related.length > 0 ? (
            <section className="related-section section-shell">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">También en esta familia</span>
                  <h2>Otras opciones</h2>
                </div>
              </div>
              <ProductGrid>
                <RelatedProducts products={related} />
              </ProductGrid>
            </section>
          ) : undefined
        }
      />
    </CatalogRoot>
  )
}
