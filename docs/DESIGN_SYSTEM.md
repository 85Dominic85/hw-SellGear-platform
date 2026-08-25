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

Catálogo en [`apps/web/public/products/{code}.webp`](../apps/web/public/products/),
fondo transparente. La ruta ya **no se deriva del `code` en el cliente**: la
fuente de verdad es `products.image_url`, y `productImageUrl()`
([`lib/product-rules.ts`](../apps/web/lib/product-rules.ts)) devuelve `null`
cuando el producto no tiene foto, para que la tarjeta pinte el icono de su
familia. Los modelos alternativos van en `products/models/`.

Las imágenes vienen del repo comercial `hw-qamarero-catalog`. Para reimportarlas:

```bash
python scripts/import-catalog-images.py <ruta-al-repo-catalogo>
```

Convierte a WebP con lado largo máximo de 1200 px y calidad 88 (no 75: el
optimizador de `next/image` reencoda a 75, y partir de una fuente ya muy
comprimida produce doble pérdida visible en los degradados de las carcasas).
Reduce los 8,2 MB del origen a ~1,5 MB.

## Estética del catálogo comercial

El catálogo web es **CSS plano con clases semánticas**, no Tailwind. Se porta
tal cual en [`apps/web/app/catalog.css`](../apps/web/app/catalog.css), escopado
bajo la clase raíz `.qc`, en vez de traducirse a utilidades: la fidelidad
pedida era literal y traducir es una transformación con pérdida que ningún test
detecta.

**La frontera es la procedencia, no la complejidad**: lo que viene del catálogo
web vive en `catalog.css`; lo que escribimos nosotros (stepper de cantidad,
paneles de tablet regalo y de línea libre, toggle de Canarias) usa Tailwind.
Así la regla es decidible.

Dos clases raíz, vía [`CatalogRoot`](../apps/web/components/catalog/CatalogRoot.tsx):

| Clase | Uso |
|---|---|
| `.qc` | tokens y línea base. Para modales por portal a `<body>`. |
| `.qc-fluid` | añade `container-type: inline-size`. Para el contenido en flujo. |

Están separadas porque el containment crea contexto de posicionamiento para
descendientes `fixed`: un overlay `fixed inset-0` dentro de `.qc-fluid` se
quedaría encajonado en la caja del catálogo.

Los breakpoints del origen (1080/800/600 px) son **container queries**, no media
queries: el dashboard tiene un sidebar de 240 px, así que en un monitor de
1280 px el catálogo dispone de 1040 px y con `@media` caería al layout móvil por
error.

Dos detalles de cascada que hay que conocer antes de tocar la hoja:

- Tailwind v4 emite sus utilidades dentro de `@layer`, y el CSS **sin capa gana
  a cualquier capa** independientemente del orden. Por eso las reglas `.qc`
  ganan sin `!important`, y por eso el `@import "./catalog.css"` puede ir arriba
  (donde la especificación exige que estén los `@import`).
- El Preflight de Tailwind pone todos los márgenes a 0 y quita los bullets de
  `ul`, cosas en las que el origen sí se apoya. `catalog.css` restaura esa línea
  base dentro de `.qc`.

El botón primario del catálogo usa `--cta` (`#c03818`), no `--brand`. No es un
color nuevo — ya es `--brand-hover` — pero allí es el color en reposo, y en el
hero convive con `--brand` para dar jerarquía. Contraste 5,9:1 frente a 4,6:1.
