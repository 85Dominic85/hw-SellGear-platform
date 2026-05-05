import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import { canCreateFreeShipment } from '@/lib/auth'
import { loadServicesCatalog } from '@/lib/tipsa/services'
import ShipmentForm from '@/components/shipments/ShipmentForm'

export default async function NewShipmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canCreateFreeShipment(profile?.role as UserRole | undefined)) {
    redirect('/shipments')
  }

  const services = loadServicesCatalog()

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/shipments"
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Volver a envíos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Nuevo envío TIPSA</h1>
        <p className="mt-1 text-sm text-gray-500">
          Remitente y destinatario libres. Si necesitas re-usar direcciones frecuentes,
          guárdalas en la <Link href="/address-book" className="underline">agenda</Link>.
        </p>
      </div>
      <ShipmentForm services={services} />
    </div>
  )
}
