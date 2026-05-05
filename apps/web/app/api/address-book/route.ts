import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildAddressBookFilter,
  buildMultiFieldOr,
} from '@/lib/address-book/query'
import { validateAddressBookInput } from '@/lib/address-book/validate'
import { canCreateAddressBook } from '@/lib/auth'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const limit = clampInt(searchParams.get('limit'), 1, MAX_LIMIT, DEFAULT_LIMIT)
  const page = clampInt(searchParams.get('page'), 1, 10000, 1)
  const offset = (page - 1) * limit

  const filter = buildAddressBookFilter(q)

  let query = supabase
    .from('address_book')
    .select(
      'id, created_at, updated_at, created_by, alias, name, venue_name, address, cp, city, province, phone, email, contact_person, notes',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filter.mode === 'cp') {
    query = query.eq('cp', filter.value)
  } else if (filter.mode === 'multi') {
    const or = buildMultiFieldOr(filter.value)
    if (or) query = query.or(or)
  }

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    entries: data ?? [],
    total: count ?? 0,
    page,
    limit,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canCreateAddressBook(profile?.role as UserRole | undefined)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const validation = validateAddressBookInput(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('address_book')
    .insert({ ...validation.data, created_by: user.id })
    .select(
      'id, created_at, updated_at, created_by, alias, name, venue_name, address, cp, city, province, phone, email, contact_person, notes',
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry: data }, { status: 201 })
}
