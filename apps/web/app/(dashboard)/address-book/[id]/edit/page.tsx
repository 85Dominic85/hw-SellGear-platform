import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { AddressBookEntry, UserRole } from '@/types/database'
import { canEditAddressBook } from '@/lib/auth'
import AddressBookForm from '@/components/address-book/AddressBookForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditAddressPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canEditAddressBook(profile?.role as UserRole | undefined)) {
    redirect('/address-book')
  }

  const { data: entry, error } = await supabase
    .from('address_book')
    .select(
      'id, created_at, updated_at, created_by, alias, name, venue_name, address, cp, city, province, phone, email, contact_person, notes',
    )
    .eq('id', id)
    .single<AddressBookEntry>()

  if (error || !entry) notFound()

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/address-book"
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Volver a la agenda
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Editar dirección</h1>
        <p className="mt-1 text-sm text-gray-500">{entry.name}</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <AddressBookForm mode="edit" initial={entry} />
      </div>
    </div>
  )
}
