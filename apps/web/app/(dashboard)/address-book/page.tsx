import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import { canEditAddressBook, canReadAddressBook } from '@/lib/auth'
import AddressBookTable from '@/components/address-book/AddressBookTable'

export default async function AddressBookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as UserRole | undefined
  if (!canReadAddressBook(role)) {
    redirect('/orders')
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <p className="mt-1 text-sm text-gray-500">
          Direcciones de clientes para envíos TIPSA libres y formularios.
        </p>
      </div>
      <AddressBookTable canEdit={canEditAddressBook(role)} />
    </div>
  )
}
