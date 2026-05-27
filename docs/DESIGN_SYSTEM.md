# Design System — Qamarero

La app adopta los **tokens oficiales de Qamarero** (Figma), entregados por
Diseño. Integrados el 2026-05-27.

## Origen

Diseño entregó `global.css` + `tokens.css`. Se portaron **solo los valores
de token** a [`apps/web/app/globals.css`](../apps/web/app/globals.css); **no**
se importan esos ficheros tal cual (su reset reemplaza el Preflight de
Tailwind y su CSS BEM de marketing chocaría con el enfoque utility-first de
esta app).

## Tokens

- **Marca**: naranja `--brand #ff592f` (hover `--brand-hover #c03818`,
  texto `--brand-foreground #fff`). Cumple AA (4.6:1 sobre blanco).
- **Escalas de color** (50→900): orange, gray, red, green, blue, amber,
  purple — con los hex oficiales de Figma.
- **Semánticos**: `--success #02995d`, `--info #0370dd`, `--warning #ffaa00`,
  `--destructive #f50a48`.
- **Focus ring**: `--ring` = marca naranja.
- **Radios**: `--radius-sm/md/lg` = 6/8/10px. **Sombras**: `--shadow-soft`,
  `--shadow-light`.
- **Tipografía**: **DM Sans** (texto/títulos) + **Space Mono** (números/datos),
  cargadas con `next/font/google` en [`layout.tsx`](../apps/web/app/layout.tsx).

## Cómo se aplica (Tailwind v4)

Vía `@theme inline` en `globals.css`:

- **Utilities de marca**: `bg-brand`, `text-brand`, `ring-brand`,
  `bg-brand-hover`, y semánticos `bg-success/info/warning/destructive`.
- **Override de escalas**: `gray-*`, `red-*`, `green-*`, `blue-*`, `amber-*`,
  `purple-*` y `orange-*` apuntan a los hex Qamarero. Así cualquier clase
  existente (`bg-gray-50`, `text-red-700`, `bg-green-100`…) usa los tonos
  oficiales **sin tocar componente a componente**.
- **Color de acción**: los botones primarios usan `bg-brand hover:bg-brand-hover`;
  los estados seleccionados (tiles del wizard, filtros activos, sidebar
  activo) y el focus usan la marca.

Light-first: no hay dark mode automático del SO.

## Logo

Pendiente del SVG oficial. Cuando esté, soltar `logo.svg` en
[`apps/web/public/`](../apps/web/public/) y sustituir el wordmark
"MainOperation / Hardware" del sidebar ([`(dashboard)/layout.tsx`](<../apps/web/app/(dashboard)/layout.tsx>))
y del login ([`(auth)/login/page.tsx`](<../apps/web/app/(auth)/login/page.tsx>)).
La caja del logo ya usa `bg-brand`.

## Fotos de producto

Catálogo en [`apps/web/public/products/{code}.png`](../apps/web/public/products/)
con fondo transparente (convención por `code`, fallback a icono de categoría).
