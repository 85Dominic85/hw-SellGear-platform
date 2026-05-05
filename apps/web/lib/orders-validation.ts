// =============================================================
// Validaciones puras (testeables) para pedidos.
// =============================================================

import type { Product } from '@/types/database'

export const ALLOWED_DISCOUNTS = [0, 10, 100] as const
export type AllowedDiscount = (typeof ALLOWED_DISCOUNTS)[number]

/**
 * Valida que un descuento de linea sea coherente con la categoria
 * del producto. La promocion 100% solo aplica a categoria 'printer'.
 *
 * Devuelve `{ ok: true }` o `{ ok: false, error }` para que el
 * caller decida codigo HTTP y mensaje al usuario.
 */
export function validateLineDiscount(
  pct: unknown,
  category: Product['category'] | null | undefined,
): { ok: true; pct: AllowedDiscount } | { ok: false; error: string } {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    return { ok: false, error: 'Descuento invalido.' }
  }
  if (!ALLOWED_DISCOUNTS.includes(pct as AllowedDiscount)) {
    return {
      ok: false,
      error: 'Descuento permitido: 0, 10 o 100.',
    }
  }
  if (pct === 100 && category !== 'printer') {
    return {
      ok: false,
      error: 'La promocion 100% solo aplica a productos de categoria printer.',
    }
  }
  return { ok: true, pct: pct as AllowedDiscount }
}
