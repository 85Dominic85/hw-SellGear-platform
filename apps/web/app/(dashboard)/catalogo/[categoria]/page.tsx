import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Palmtree } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { canCreateOrder } from '@/lib/auth'
import type { UserRole } from '@/types/database'
import { getCatalog } from '@/lib/catalog/queries'
import { catalogTab, isCatalogTabKey } from '@/lib/catalog-taxonomy'
import { isCatalogVisible } from '@/lib/product-rules'
import CatalogRoot from '@/components/catalog/CatalogRoot'
import CatalogBrowser from '@/components/catalog/CatalogBrowser'

interface Props {
  params: Promise<{ categoria: string }>
}

export async function generateMetadata({ params }: Props) {
  const { categoria } = await params
  const tab = isCatalogTabKey(categoria) ? catalogTab(categoria) : null
  return { title: tab ? tab.label : 'Catálogo' }
}

export default async function CategoriaPage({ params }: Props) {
  const { categoria } = await params
  if (!isCatalogTabKey(categoria) || categoria === 'all') notFound()
  const tab = catalogTab(categoria)
  if (!tab) notFound()

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
  const count = products
    .filter((p) => isCatalogVisible(p, { region: tab.region }))
    .filter((p) => (tab.category ? p.category === tab.category : true)).length

  const isCanarias = tab.key === 'canarias'

  return (
    <CatalogRoot fluid>
      <section className={isCanarias ? 'page-hero canarias-hero' : 'page-hero'}>
        <div className="section-shell">
          <Link href="/catalogo" className="back-link">
            <ArrowLeft size={16} aria-hidden="true" /> Volver al catálogo
          </Link>
          <span className="eyebrow">
            {isCanarias && (
              <Palmtree
                size={14}
                aria-hidden="true"
                style={{ marginRight: 6, verticalAlign: '-2px' }}
              />
            )}
            {tab.prompt}
          </span>
          <h1>{tab.label}</h1>
          <p>{tab.description}</p>
          {isCanarias && (
            <p className="canarias-tax-note">
              Precio final, sin IVA. Solo para envíos a Canarias.
            </p>
          )}
          <p className="page-hero-count">
            {count} {count === 1 ? 'producto' : 'productos'}
          </p>
        </div>
      </section>

      <div className="category-products section-shell">
        <CatalogBrowser
          products={products}
          canCreateOrder={canCreateOrder(role)}
          lockedTab={tab.key}
          showHeading={false}
        />
      </div>
    </CatalogRoot>
  )
}
