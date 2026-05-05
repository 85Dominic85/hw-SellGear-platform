import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import { canCreateFreeShipment, canReadFreeShipments } from '@/lib/auth'
import ShipmentsTable from '@/components/shipments/ShipmentsTable'

export default async function ShipmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as UserRole | undefined
  if (!canReadFreeShipments(role)) redirect('/orders')

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Envíos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Etiquetas TIPSA con remitente y destinatario libres (recogidas, envíos entre clientes…).
        </p>
      </div>
      <ShipmentsTable canCreate={canCreateFreeShipment(role)} />
    </div>
  )
}
