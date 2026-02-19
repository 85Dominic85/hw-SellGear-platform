'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'forgot'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!email.endsWith('@qamarero.com')) {
      setError('Solo se permiten cuentas @qamarero.com')
      setLoading(false)
      return
    }

    const supabase = createClient()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : error.message)
      else window.location.href = '/orders'
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
      })
      if (error) {
        setError(error.message.includes('already registered')
          ? 'Este email ya tiene cuenta. Usa "Iniciar sesión".'
          : error.message)
      } else {
        setSuccess('Revisa tu email para confirmar la cuenta.')
      }
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      })
      if (error) setError(error.message)
      else setSuccess('Email de recuperación enviado. Revisa tu bandeja.')
    }

    setLoading(false)
  }

  const titles: Record<Mode, string> = {
    login:  'Iniciar sesión',
    signup: 'Crear cuenta',
    forgot: 'Recuperar contraseña',
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white px-8 py-10 shadow-lg ring-1 ring-gray-200">

          {/* Branding */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gray-900">
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">MainOperation</h1>
            <p className="mt-1 text-sm text-gray-500">Hardware · Gestión de Pedidos</p>
          </div>

          <h2 className="mb-6 text-center text-lg font-semibold text-gray-700">
            {titles[mode]}
          </h2>

          {/* Feedback */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Email <span className="text-gray-400">(@qamarero.com)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@qamarero.com"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : '••••••••'}
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Un momento...' : titles[mode]}
            </button>
          </form>

          {/* Navigation links */}
          <div className="mt-5 flex flex-col items-center gap-2 text-sm">
            {mode === 'login' && (
              <>
                <button onClick={() => { setMode('forgot'); setError(null); setSuccess(null) }}
                  className="text-gray-500 hover:text-gray-900 hover:underline">
                  ¿Olvidaste tu contraseña?
                </button>
                <button onClick={() => { setMode('signup'); setError(null); setSuccess(null) }}
                  className="text-gray-500 hover:text-gray-900 hover:underline">
                  Crear cuenta nueva
                </button>
              </>
            )}
            {(mode === 'signup' || mode === 'forgot') && (
              <button onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
                className="text-gray-500 hover:text-gray-900 hover:underline">
                ← Volver a iniciar sesión
              </button>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-gray-400">
            Acceso restringido al equipo de Qamarero.
          </p>
        </div>
      </div>
    </div>
  )
}
