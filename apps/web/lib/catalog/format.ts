// =============================================================
// Formato de precios del catálogo.
//
// El catálogo web renderiza `499 €` (sin decimales cuando el importe es
// entero) y `83,60 €` cuando no lo es. formatEurosCents de lib/pricing.ts
// siempre pone dos decimales (`499,00 €`), que es lo correcto para el
// carrito y las facturas pero no es lo que se ve en la web.
//
// Así que el catálogo usa este formato y el carrito sigue con el de pricing:
// una diferencia deliberada, no un descuido.
// =============================================================

const NF = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const NF_DECIMALS = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** `49900` -> `"499"`, `8360` -> `"83,60"`. Sin el símbolo. */
export function formatCatalogAmount(cents: number): string {
  const euros = cents / 100
  return Number.isInteger(euros) ? NF.format(euros) : NF_DECIMALS.format(euros)
}

/** `49900` -> `"499 €"`. */
export function formatCatalogPrice(cents: number): string {
  return `${formatCatalogAmount(cents)} €`
}

/**
 * Sufijo fiscal de un precio de catálogo. Los SKU canarios llevan precio
 * FINAL (vat_rate 0), el resto se muestran sin IVA.
 */
export function priceSuffix(vatRate: number | null | undefined): string {
  return Number(vatRate ?? 21) === 0 ? 'Precio final' : '+ IVA'
}

/**
 * Normaliza para buscar sin acentos: "impresion" encuentra "impresión" y
 * viceversa. Portado literal del catálogo web (catalog-explorer.tsx).
 *
 * El rango ̀-ͯ son las marcas diacríticas combinantes que suelta
 * NFD; se escriben escapadas a propósito, para que no dependan de que el
 * fichero se guarde en UTF-8.
 */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
