// =============================================================
// Validaciones puras (testeables) para pedidos.
// =============================================================

import { allowsLineDiscount, type ProductLike } from '@/lib/product-rules'

/** Rango permitido para descuentos (por línea y global). */
export const MIN_DISCOUNT_PCT = 0
export const MAX_DISCOUNT_PCT = 100

/**
 * Valida un descuento por línea (order_items.discount_pct).
 *
 * Reglas de negocio (2026-07):
 *   - Rango libre 0-100 (entero). Antes existía un set fijo
 *     {0, 10, 100} con la promo "Printer 100%"; ahora cualquier
 *     categoría puede aplicar cualquier descuento entre 0 y 100.
 *   - Los productos con `allows_discount = false` (hoy solo SaaS + Hardware)
 *     fuerzan 0: el precio negociado por el AE/AM ES el precio final
 *     acordado con el cliente. El dato vive en la fila, no en un `code`
 *     hardcodeado — ver lib/product-rules.ts.
 *   - Los pedidos de financiación (`hardware_financiacion`) siguen
 *     rechazando descuentos en el POST /api/orders (plan de plazos
 *     fijo), pero la validación aquí no lo sabe — el caller (route)
 *     tiene la responsabilidad de comprobar purchase_type.
 *
 * Devuelve `{ ok: true, pct }` o `{ ok: false, error }` para que el
 * caller decida código HTTP y mensaje al usuario.
 */
export function validateLineDiscount(
  pct: unknown,
  product: ProductLike | null | undefined,
): { ok: true; pct: number } | { ok: false; error: string } {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    return { ok: false, error: 'Descuento inválido.' }
  }
  // Aceptamos enteros 0-100. Rechazamos decimales para mantener un modelo
  // simple: los descuentos son "10%", "25%", "50%", no "12.5%".
  if (!Number.isInteger(pct)) {
    return { ok: false, error: 'El descuento debe ser un número entero.' }
  }
  if (pct < MIN_DISCOUNT_PCT || pct > MAX_DISCOUNT_PCT) {
    return {
      ok: false,
      error: `Descuento fuera de rango: debe estar entre ${MIN_DISCOUNT_PCT}% y ${MAX_DISCOUNT_PCT}%.`,
    }
  }
  // Ofertas de precio cerrado: el número introducido en
  // unit_price_override_cents ES el precio final acordado con el cliente, así
  // que un descuento encima no tiene sentido.
  if (pct !== 0 && !allowsLineDiscount(product)) {
    return {
      ok: false,
      error:
        'Las líneas SaaS + Hardware no admiten descuento (el precio negociado ya es el final).',
    }
  }
  return { ok: true, pct }
}

/**
 * Valida un descuento global a nivel de pedido (orders.discount_global_pct).
 *
 * Mismo rango 0-100 entero. No depende de categoría (aplica al pedido
 * entero). Los pedidos de financiación no admiten descuento global — la
 * comprobación de purchase_type queda en el caller.
 */
export function validateGlobalDiscount(
  pct: unknown,
): { ok: true; pct: number } | { ok: false; error: string } {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    return { ok: false, error: 'Descuento global inválido.' }
  }
  if (!Number.isInteger(pct)) {
    return { ok: false, error: 'El descuento global debe ser un número entero.' }
  }
  if (pct < MIN_DISCOUNT_PCT || pct > MAX_DISCOUNT_PCT) {
    return {
      ok: false,
      error: `Descuento global fuera de rango: debe estar entre ${MIN_DISCOUNT_PCT}% y ${MAX_DISCOUNT_PCT}%.`,
    }
  }
  return { ok: true, pct }
}

/**
 * Tope de `order_items.unit_price_cents`, que es INTEGER
 * (migración 20260427000002): 2 147 483 647 céntimos ≈ 21,47 M €.
 *
 * No es un límite de negocio, es el de la columna, y hay que comprobarlo
 * ANTES de crear nada. `orders.amount` es NUMERIC(12,2) y aguanta mucho más,
 * así que un importe entre los dos límites deja el pedido insertado y el
 * insert de líneas reventado con «value out of range for type integer». Como
 * ese fallo hoy solo se registra con `console.error` (ver
 * app/api/orders/route.ts, tras el insert de order_items), la API responde 200
 * con el id, el AE aterriza en un pedido con importe y cero artículos, y Slack
 * recibe un aviso con productos que no existen en la base de datos.
 *
 * Rechazarlo aquí cierra ese camino sin tocar la decisión de qué debe hacer el
 * endpoint cuando el insert de líneas falla por otro motivo.
 */
export const MAX_UNIT_PRICE_CENTS = 2147483647

/**
 * Tope de `order_items.qty` (INT, con CHECK `qty > 0` en el esquema).
 */
export const MAX_LINE_QTY = 2147483647

export function validateUnitPriceCents(
  cents: unknown,
  label: string,
): { ok: true; cents: number } | { ok: false; error: string } {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) {
    return { ok: false, error: `Precio inválido en "${label}".` }
  }
  if (!Number.isInteger(cents) || cents < 0) {
    return {
      ok: false,
      error: `Precio inválido en "${label}": debe ser un importe positivo.`,
    }
  }
  if (cents > MAX_UNIT_PRICE_CENTS) {
    return {
      ok: false,
      error: `El precio de "${label}" supera el máximo admitido (${Math.floor(
        MAX_UNIT_PRICE_CENTS / 100,
      ).toLocaleString('es-ES')} €).`,
    }
  }
  return { ok: true, cents }
}
