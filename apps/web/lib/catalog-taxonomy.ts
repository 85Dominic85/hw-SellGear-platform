// =============================================================
// Taxonomía del catálogo: fuente única de categorías y pestañas.
//
// Sustituye a las 4 estructuras que estaban duplicadas y ya desincronizadas:
//   ProductCatalog.tsx  CATEGORY_FILTERS (7 entradas, omitía 2 categorías)
//   ProductCatalog.tsx  CATEGORY_ICON    (8 entradas, emojis)
//   ProductPicker.tsx   CATEGORY_LABELS  (8 entradas)
//   ProductPicker.tsx   CATEGORY_ORDER   (8 entradas)
//
// Las etiquetas y descripciones vienen del catálogo comercial web
// (hw-qamarero-catalog/lib/catalog.ts), para que la app y la web digan lo
// mismo. Los iconos son nombres lucide; el mapa a componentes vive en el
// cliente para que este módulo siga siendo server-safe.
// =============================================================

import type { ProductCategory, ProductRegion } from '@/types/database'

export interface CategoryMeta {
  key: ProductCategory
  /** Título largo, para el hero de la vista de categoría. */
  label: string
  /** Etiqueta corta, para la pestaña. */
  short: string
  /** Qué resuelve, en lenguaje de cliente. */
  description: string
  /** Frase de "elige por necesidad" que acompaña a la pestaña. */
  prompt: string
  /** Nombre del icono lucide. */
  icon: string
  /** Si aparece como pestaña del explorador. */
  tab: boolean
  order: number
}

export const PRODUCT_CATEGORIES: readonly CategoryMeta[] = [
  {
    key: 'pack',
    label: 'Packs de Hardware',
    short: 'Packs',
    description: 'Soluciones completas, configuradas y listas para empezar.',
    prompt: 'Montar un puesto completo',
    icon: 'Package',
    tab: true,
    order: 1,
  },
  {
    key: 'tpv',
    label: 'Pantallas TPV',
    short: 'TPV',
    description: 'Terminales profesionales para el ritmo diario de hostelería.',
    prompt: 'Renovar caja o punto de venta',
    icon: 'Monitor',
    tab: true,
    order: 2,
  },
  {
    key: 'kds',
    label: 'Pantallas de cocina KDS',
    short: 'KDS',
    description: 'Comandas claras y operativa coordinada entre sala y cocina.',
    prompt: 'Pasar la cocina a pantalla',
    icon: 'ChefHat',
    tab: true,
    order: 3,
  },
  {
    key: 'printer',
    label: 'Impresoras',
    short: 'Impresoras',
    description: 'Impresión térmica para tickets y comandas en barra o cocina.',
    prompt: 'Imprimir en barra o cocina',
    icon: 'Printer',
    tab: true,
    order: 4,
  },
  {
    key: 'accessory',
    label: 'Periféricos y avisadores',
    short: 'Periféricos',
    description: 'Cajón, báscula y avisadores para completar el puesto.',
    prompt: 'Avisar a clientes o vender al peso',
    icon: 'BellRing',
    tab: true,
    order: 5,
  },
  {
    key: 'network',
    label: 'Routers',
    short: 'Red',
    description: 'Conectividad estable y aislada para los dispositivos del local.',
    prompt: 'Estabilizar la red del local',
    icon: 'Router',
    tab: true,
    order: 6,
  },
  {
    key: 'service',
    label: 'Servicios y SaaS',
    short: 'Servicios',
    description: 'Implementación, licencias y ofertas mixtas con precio a medida.',
    prompt: 'Contratar software o implementación',
    icon: 'Sparkles',
    tab: true,
    order: 7,
  },
  {
    key: 'custom',
    label: 'Fuera de catálogo',
    short: 'Otros',
    description: 'Solicitudes puntuales con descripción y precio libres.',
    prompt: 'Pedir algo que no está en catálogo',
    icon: 'PencilLine',
    tab: false,
    order: 98,
  },
  {
    // @deprecated — migrado a 'service'. Se mantiene mientras el union de
    // ProductCategory lo conserve, para que un producto con la categoría
    // vieja no quede huérfano de etiqueta durante la ventana de despliegue.
    key: 'saas_hardware',
    label: 'Servicios y SaaS',
    short: 'Servicios',
    description: 'Implementación, licencias y ofertas mixtas con precio a medida.',
    prompt: 'Contratar software o implementación',
    icon: 'Sparkles',
    tab: false,
    order: 99,
  },
]

/**
 * Canarias NO es una categoría, es una `region`: un TPV canario sigue siendo
 * category = 'tpv'. Pero en el explorador se presenta como una pestaña más,
 * porque el comercial elige entre "hardware peninsular" y "hardware canario"
 * como si fueran familias — y son dos listas de precios que no se mezclan.
 */
export const CANARIAS_TAB = {
  key: 'canarias',
  label: 'Productos para Canarias',
  short: 'Canarias',
  description: 'Equipos para las Islas Canarias con precio final, sin IVA.',
  prompt: 'Comprar desde Canarias',
  icon: 'Palmtree',
  order: 8,
} as const

/** Clave de pestaña del explorador: una categoría, Canarias, o "todo". */
export type CatalogTabKey = ProductCategory | 'canarias' | 'all'

export interface CatalogTab {
  key: CatalogTabKey
  label: string
  short: string
  description: string
  prompt: string
  icon: string
  /** Región que filtra la pestaña. */
  region: ProductRegion
  /** Categoría que filtra, o null si la pestaña filtra por región. */
  category: ProductCategory | null
}

/** Las 8 pestañas del explorador, en orden comercial. */
export const CATALOG_TABS: readonly CatalogTab[] = [
  ...PRODUCT_CATEGORIES.filter((c) => c.tab)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      key: c.key as CatalogTabKey,
      label: c.label,
      short: c.short,
      description: c.description,
      prompt: c.prompt,
      icon: c.icon,
      region: 'peninsula' as ProductRegion,
      category: c.key,
    })),
  {
    key: CANARIAS_TAB.key,
    label: CANARIAS_TAB.label,
    short: CANARIAS_TAB.short,
    description: CANARIAS_TAB.description,
    prompt: CANARIAS_TAB.prompt,
    icon: CANARIAS_TAB.icon,
    region: 'canarias' as ProductRegion,
    category: null,
  },
]

const BY_KEY = new Map<ProductCategory, CategoryMeta>(
  PRODUCT_CATEGORIES.map((c) => [c.key, c]),
)

export function categoryMeta(key: ProductCategory | null | undefined): CategoryMeta | null {
  return key ? (BY_KEY.get(key) ?? null) : null
}

/** Etiqueta corta con degradación segura si llega una categoría desconocida. */
export function categoryShortLabel(key: ProductCategory | null | undefined): string {
  return categoryMeta(key)?.short ?? 'Otros'
}

export function categoryLabel(key: ProductCategory | null | undefined): string {
  return categoryMeta(key)?.label ?? 'Otros'
}

export function catalogTab(key: CatalogTabKey | null | undefined): CatalogTab | null {
  return CATALOG_TABS.find((t) => t.key === key) ?? null
}

export function isCatalogTabKey(value: string): value is CatalogTabKey {
  return value === 'all' || CATALOG_TABS.some((t) => t.key === value)
}

/**
 * Orden de los `<optgroup>` del selector de producto del carrito. Deriva del
 * mismo `order`, así que no puede desincronizarse de las pestañas — que es
 * exactamente lo que le pasaba a CATEGORY_ORDER de ProductPicker.
 */
export const CATEGORY_ORDER: readonly ProductCategory[] = PRODUCT_CATEGORIES
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((c) => c.key)
