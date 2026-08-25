// Mapa de nombre de icono -> componente lucide.
//
// lib/catalog-taxonomy.ts guarda el NOMBRE del icono (string) para poder ser
// server-safe; la resolución a componente vive aquí, en el cliente.

import {
  BellRing,
  ChefHat,
  Monitor,
  Package,
  Palmtree,
  PencilLine,
  Printer,
  Router,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  Package,
  Monitor,
  ChefHat,
  Printer,
  BellRing,
  Router,
  Sparkles,
  PencilLine,
  Palmtree,
}

/** Devuelve el icono, con `Package` como respaldo si el nombre no existe. */
export function catalogIcon(name: string): LucideIcon {
  return ICONS[name] ?? Package
}
