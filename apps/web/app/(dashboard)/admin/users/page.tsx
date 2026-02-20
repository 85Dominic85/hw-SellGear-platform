'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { UserProfile, UserRole } from '@/types/database'

const ROLE_LABELS: Record<UserRole, string> = {
  creator: 'Creador',
  hardware: 'Hardware',
  manager: 'Manager',
  admin: 'Admin',
}

const ROLE_COLORS: Record<UserRole, string> = {
  creator: 'bg-blue-100 text-blue-800',
  hardware: 'bg-purple-100 text-purple-800',
  manager: 'bg-green-100 text-green-800',
  admin: 'bg-red-100 text-red-800',
}

type EditingUser = {
  id: string
  full_name: string
  role: UserRole
  department: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [editing, setEditing] = useState<EditingUser | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando usuarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const handleEdit = (user: UserProfile) => {
    setEditing({
      id: user.id,
      full_name: user.full_name ?? '',
      role: user.role,
      department: user.department ?? '',
    })
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)

    try {
      const res = await fetch(`/api/admin/users/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editing.full_name,
          role: editing.role,
          department: editing.department,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setUsers((prev) =>
        prev.map((u) => (u.id === editing.id ? { ...u, ...data.user } : u))
      )
      setEditing(null)
      showFeedback('success', 'Usuario actualizado correctamente')
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async (userId: string, email: string) => {
    if (!confirm(`Se enviara un email de recuperacion a ${email}. ¿Continuar?`)) return

    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      showFeedback('success', data.message)
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Error al enviar reset')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`¿Estas seguro de que quieres eliminar a "${name}"? Esta accion no se puede deshacer.`)) return

    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setUsers((prev) => prev.filter((u) => u.id !== userId))
      showFeedback('success', 'Usuario eliminado correctamente')
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setActionLoading(null)
    }
  }

  // Filtrado
  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.department ?? '').toLowerCase().includes(search.toLowerCase())

    const matchesRole = !roleFilter || u.role === roleFilter

    return matchesSearch && matchesRole
  })

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando usuarios...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="rounded-lg bg-red-50 px-6 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestion de Usuarios</h1>
        <p className="mt-1 text-sm text-gray-500">
          {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            'mb-4 rounded-lg px-4 py-3 text-sm ring-1',
            feedback.type === 'success'
              ? 'bg-green-50 text-green-700 ring-green-200'
              : 'bg-red-50 text-red-700 ring-red-200'
          )}
        >
          {feedback.message}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre, email o departamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        >
          <option value="">Todos los roles</option>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Usuario</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Rol</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Departamento</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Registro</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                          {(user.full_name ?? user.email ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">
                          {user.full_name ?? '(sin nombre)'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          ROLE_COLORS[user.role]
                        )}
                      >
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.department ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(user)}
                          disabled={actionLoading === user.id}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                          title="Editar usuario"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleResetPassword(user.id, user.email ?? '')}
                          disabled={actionLoading === user.id || !user.email}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
                          title="Enviar email de reset de contrasena"
                        >
                          {actionLoading === user.id ? '...' : 'Reset pwd'}
                        </button>
                        <button
                          onClick={() => handleDelete(user.id, user.full_name ?? user.email ?? '')}
                          disabled={actionLoading === user.id}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Eliminar usuario"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edicion */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Editar usuario</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Rol
                </label>
                <select
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value as UserRole })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Departamento
                </label>
                <input
                  type="text"
                  value={editing.department}
                  onChange={(e) => setEditing({ ...editing, department: e.target.value })}
                  placeholder="Ej: Ventas, Hardware, IT..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
