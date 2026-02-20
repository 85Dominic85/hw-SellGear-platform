import type { UserRole } from '@/types/database'

/** Emails con acceso admin hardcoded (fallback si el rol aún no está asignado en BD) */
const ADMIN_EMAILS = [
  'jj.gallego@qamarero.com',
  'domingo.bueno@qamarero.com',
]

export function isAdminUser(email?: string | null, role?: UserRole | null): boolean {
  if (role === 'admin') return true
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return true
  return false
}
