import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase para el proyecto secundario de **inventario**
 * (hw_staging.hw_inventory, hw_staging.hw_articles).
 *
 * Vive en un Supabase distinto al principal (olcxbtvjkjmofrbvzpat),
 * por eso necesitamos un cliente aparte con sus propias credenciales.
 *
 * - Solo server-side. Nunca exponer al cliente (la key es service_role).
 * - Sin sesión, sin cookies (el cliente no está vinculado a un user).
 * - La autorización del CALLER (qué usuario puede consultar inventario)
 *   se hace en la página `/inventory` contra el proyecto principal,
 *   antes de invocar este cliente.
 *
 * Devuelve `null` si las envs no están configuradas (en lugar de lanzar),
 * para que la página pueda mostrar un mensaje útil al admin en vez de
 * crashear.
 */
export function createInventoryClient() {
  const url = process.env.INVENTORY_SUPABASE_URL
  const key = process.env.INVENTORY_SUPABASE_SERVICE_KEY

  if (!url || !key) {
    return null
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
