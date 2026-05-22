// =============================================================
// Registro central de purchase_type
//
// Antes (commit dea6301) había 4 Sets duplicados en endpoints distintos.
// Al añadir 'saas_hardware' al union PurchaseType, dos de esos Sets se
// quedaron desactualizados (PATCH /api/orders/[id] y hwtoolbox/orders),
// causando el bug del badge "Error" al reclasificar pedidos en el detalle.
//
// El patrón `satisfies Record<PurchaseType, true>` fuerza exhaustividad
// en compile-time: si en el futuro se añade un valor al union PurchaseType
// y no se actualiza este registro, `tsc` rompe. Esto NO ocurre con un
// `new Set<PurchaseType>([...])` porque éste solo valida que cada literal
// del array PERTENEZCA al union, no que estén TODOS.
// =============================================================

import type { PurchaseType } from '@/types/database'

const PURCHASE_TYPES = {
  kit_digital:           true,
  hardware_one_off:      true,
  hardware_financiacion: true,
  transferencias_saas:   true,
  saas_hardware:         true,
  otro:                  true,
} as const satisfies Record<PurchaseType, true>

export const VALID_PURCHASE_TYPES: ReadonlySet<PurchaseType> = new Set(
  Object.keys(PURCHASE_TYPES) as PurchaseType[],
)

/**
 * Type guard: comprueba que `v` es un PurchaseType válido.
 *
 * NOTA: el wildcard `'all'` que usa /api/external/metrics como filtro NO
 * es un PurchaseType: los callers deben tratarlo aparte ANTES de invocar
 * este helper.
 */
export function isValidPurchaseType(v: unknown): v is PurchaseType {
  return typeof v === 'string' && VALID_PURCHASE_TYPES.has(v as PurchaseType)
}
