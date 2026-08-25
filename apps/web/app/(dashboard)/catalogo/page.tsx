import { createClient } from '@/lib/supabase/server'
import { canCreateOrder } from '@/lib/auth'
import type { UserRole } from '@/types/database'
import { getCatalog } from '@/lib/catalog/queries'
import CatalogRoot from '@/components/catalog/CatalogRoot'
import CatalogHero from '@/components/catalog/CatalogHero'
import CatalogBrowser from '@/components/catalog/CatalogBrowser'
import { isCatalogVisible } from '@/lib/product-rules'

export default async function CatalogoPage() {
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
  // La fila de datos del hero cuenta lo peninsular: Canarias es otra lista.
  const peninsulaCount = products.filter((p) =>
    isCatalogVisible(p, { region: 'peninsula' }),
  ).length

  return (
    <CatalogRoot fluid>
      <CatalogHero productCount={peninsulaCount} />
      <CatalogBrowser
        products={products}
        canCreateOrder={canCreateOrder(role)}
      />
    </CatalogRoot>
  )
}
