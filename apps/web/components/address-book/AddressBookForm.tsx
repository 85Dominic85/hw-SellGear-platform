'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AddressBookEntry, AddressBookInput } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500'

const labelClass = 'mb-1 block text-xs font-medium text-gray-700'

const EMPTY: AddressBookInput = {
  alias: null,
  name: '',
  venue_name: null,
  address: '',
  cp: '',
  city: '',
  province: null,
  phone: null,
  email: null,
  contact_person: null,
  notes: null,
}

interface AddressBookFormProps {
  mode: 'create' | 'edit'
  initial?: AddressBookEntry
}

export default function AddressBookForm({ mode, initial }: AddressBookFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<AddressBookInput>(
    initial
      ? {
          alias: initial.alias,
          name: initial.name,
          venue_name: initial.venue_name,
          address: initial.address,
          cp: initial.cp,
          city: initial.city,
          province: initial.province,
          phone: initial.phone,
          email: initial.email,
          contact_person: initial.contact_person,
          notes: initial.notes,
        }
      : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = <K extends keyof AddressBookInput>(key: K, value: AddressBookInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const url =
        mode === 'create' ? '/api/address-book' : `/api/address-book/${initial?.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      router.push('/address-book')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial) return
    if (!confirm(`¿Eliminar "${initial.name}"? Esta accion no se puede deshacer.`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/address-book/${initial.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar')
      router.push('/address-book')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Nombre / Razón social <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Bar Manolo S.L."
            className={inputClass}
            required
            maxLength={200}
          />
        </div>
        <div>
          <label className={labelClass}>Nombre del local</label>
          <input
            type="text"
            value={form.venue_name ?? ''}
            onChange={(e) => update('venue_name', e.target.value || null)}
            placeholder="Bar Manolo"
            className={inputClass}
            maxLength={200}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Alias / apodo libre</label>
          <input
            type="text"
            value={form.alias ?? ''}
            onChange={(e) => update('alias', e.target.value || null)}
            placeholder="Bar Manolo - local 1"
            className={inputClass}
            maxLength={100}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>
            Dirección <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            placeholder="Calle Mayor 12, 1ºB"
            className={inputClass}
            required
            maxLength={300}
          />
        </div>
        <div>
          <label className={labelClass}>
            CP <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.cp}
            onChange={(e) => update('cp', e.target.value)}
            placeholder="28013"
            className={inputClass}
            required
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
          />
        </div>
        <div>
          <label className={labelClass}>
            Ciudad <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            placeholder="Madrid"
            className={inputClass}
            required
            maxLength={100}
          />
        </div>
        <div>
          <label className={labelClass}>Provincia</label>
          <input
            type="text"
            value={form.province ?? ''}
            onChange={(e) => update('province', e.target.value || null)}
            placeholder="Madrid"
            className={inputClass}
            maxLength={100}
          />
        </div>
        <div>
          <label className={labelClass}>Teléfono</label>
          <input
            type="tel"
            value={form.phone ?? ''}
            onChange={(e) => update('phone', e.target.value || null)}
            placeholder="912345678"
            className={inputClass}
            maxLength={30}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={form.email ?? ''}
            onChange={(e) => update('email', e.target.value || null)}
            placeholder="contacto@bar.com"
            className={inputClass}
            maxLength={200}
          />
        </div>
        <div>
          <label className={labelClass}>Persona de contacto</label>
          <input
            type="text"
            value={form.contact_person ?? ''}
            onChange={(e) => update('contact_person', e.target.value || null)}
            placeholder="Manolo Pérez"
            className={inputClass}
            maxLength={200}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Notas</label>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => update('notes', e.target.value || null)}
            placeholder="Horario de entrega, instrucciones especiales..."
            className={`${inputClass} min-h-[80px]`}
            maxLength={1000}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
        {mode === 'edit' ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/address-book')}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </form>
  )
}
