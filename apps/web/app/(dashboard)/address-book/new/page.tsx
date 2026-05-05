import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import { canCreateAddressBook } from '@/lib/auth'
import AddressBookForm from '@/components/address-book/AddressBookForm'

export default async function NewAddressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canCreateAddressBook(profile?.role as UserRole | undefined)) {
    redirect('/address-book')
  }

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/address-book"
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Volver a la agenda
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Nueva dirección</h1>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <AddressBookForm mode="create" />
      </div>
    </div>
  )
}
