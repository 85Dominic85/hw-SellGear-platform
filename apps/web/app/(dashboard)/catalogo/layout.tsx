import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CatalogSelectionProvider } from '@/components/catalog/CatalogSelectionProvider'

export const metadata = {
  title: 'Catálogo de hardware',
}

/**
 * El catálogo es CONSULTA, así que lo ve cualquier rol autenticado —
 * incluido `viewer`. Lo que se restringe es crear el pedido, y eso lo decide
 * CatalogSelectionBar con canCreateOrder.
 */
export default async function CatalogoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <CatalogSelectionProvider>{children}</CatalogSelectionProvider>
}
