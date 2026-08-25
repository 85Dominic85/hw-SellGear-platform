# ADR — Importar el catálogo comercial web a la app

**Fecha**: 2026-08-25 · **Estado**: implementado, pendiente de aplicar el SQL

## Contexto

El catálogo comercial de Qamarero vivía en un repo aparte,
`qamarero/hw-qamarero-catalog`: una app Next.js autónoma sin base de datos,
cuya única fuente era `lib/catalog.ts` (29 productos en 7 categorías) con
fichas completas — marca, modelo, resumen, «ideal para», highlights,
especificaciones, componentes, desglose de precio con ahorro del pack y
modelos alternativos.

En MainOperation el catálogo eran 22 filas con `name`, `description`,
`category` y `price_cents`, sin ningún metadato comercial, y solo existía
dentro del wizard de pedidos: no había página de catálogo ni buscador.
Faltaban 13 productos que sí se venden.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| 1 | El catálogo vive en Supabase `products` con metadatos ricos | `order_items.product_id` referencia `products.id`: es la única forma de que todo sea comprable |
| 2 | En los conflictos manda el catálogo web | Pack Basic 759 → 539 €, KDS Estándar 693 → 549 € |
| 3 | Se adoptan los nombres del catálogo web | Que la web y la app digan lo mismo. **Excepción**: la tablet mantiene «Tablet Lenovo Tab Plus», porque ese nombre se congela en `order_items.product_name` y viaja a TIPSA y Slack, donde «Tablet KDS» no le dice nada a almacén |
| 4 | Canarias es un eje `region`, no una categoría | Las 7 categorías del origen mezclan dos ejes: 6 son familias y `canarias` es geografía. Con `region` ortogonal, un KDS canario sigue siendo `category='kds'` y conserva filtros y productos relacionados coherentes |
| 5 | Los SKU canarios llevan precio FINAL con `vat_rate = 0` | No es una exención sobre el precio peninsular: es **otra lista de precios** (TPV Pro 627 € + IVA vs 539,07 € finales). El modelo por CP no puede representarlo |
| 6 | `pricing_mode` y `allows_discount` declarativos | El predicado «precio libre» estaba replicado 9 veces en 7 ficheros porque el hecho no estaba en la BD |
| 7 | Categoría nueva `service` para Implementación Pro, Software Qamarero y SaaS + Hardware | Son productos nuestros, no están en el catálogo web, y estaban repartidos entre `accessory` y `saas_hardware` |
| 8 | Se retira `picho-wifi`; el cajón portamonedas se mantiene | Lo físico que no está en el catálogo se quita. El cajón es una divergencia consciente, para poder vender repuestos |
| 9 | El CSS del catálogo se **porta**, no se traduce a Tailwind | La fidelidad pedida era literal; traducir es una transformación con pérdida que ningún test detecta. Ver `docs/DESIGN_SYSTEM.md` |
| 10 | Los breakpoints pasan a container queries | El sidebar de 240 px hace que el ancho de viewport no diga nada sobre el espacio real del catálogo |
| 11 | El puente `/catalogo` → wizard va en la URL (`?sel=`) | Compartible, sobrevive al refresh, legible en servidor. Se descartaron `sessionStorage` como handoff, un context compartido (árboles de rutas distintos) y una tabla de borradores |
| 12 | El puente **no** salta el paso 1 del wizard | `purchase_type` gobierna los requisitos posteriores y `selectPurchaseType` vacía el carrito al cruzar la frontera de financiación. Llegar precargado y que el carrito se vaciara en silencio sería el peor resultado |

## Hallazgos durante la implementación

**Hueco fiscal cerrado.** El IVA se decide por CP en `api/orders/route.ts`. Un
SKU canario (precio final, `vat_rate = 0`) enviado a Madrid se habría facturado
al 0 % con precio canario. Ahora `POST /api/orders` y
`POST /api/orders/[id]/items` lo rechazan con 400. El caso inverso (SKU
peninsular con CP canario) se mantiene permitido: ya funcionaba así y hay
pedidos históricos con ese patrón.

**Bug de orden en `/api/products`.** Ordenaba por `category` antes que por
`sort_order`, y `category` es TEXT: los accesorios salían antes que los packs y
el TPV al final. `ProductCatalog` lo tapaba reordenando en cliente, pero
`AddOrderItemModal` no y mostraba el orden roto. Corregido: con las bandas de
100 por pestaña, `ORDER BY sort_order` a secas ya da el orden comercial.

**`kds-estandar` cambia de equipo, no solo de precio.** Nuestro «KDS Estandar»
de 693 € es «Intel J6412, 8GB+128GB, IP65» — el **mismo equipo** que el
`kds-canarias` del catálogo (10POS 10D-215, J6412, IP65, 699 € finales), no el
AIMV Android de 549 € que el catálogo lista como KDS Standard peninsular. Es
decir: la migración discontinúa de facto el KDS J6412 en península. **Pendiente
de confirmar con producto antes de aplicar el SQL.**

**Regresión de accesibilidad corregida de paso.** Los steppers de cantidad del
`ProductTile` anterior eran de 28 px, por debajo del objetivo táctil. El nuevo
`AddToOrderButton` lleva todos los controles a 44 px.

## Pendientes anotados

- **Financiación desalineada**: `FINANCING_PLANS['kds-estandar']` son 770 € de
  base frente a 549 € de contado — un 40 % de sobrecoste, contra el 9 % de Pack
  Pro y el 17 % de Pack Premium. Fuera de alcance por decisión explícita.
- **Métricas históricas**: el RPC `by_product` agrupa por
  `order_items.product_name` en texto, así que renombrar 5 productos crea
  etiquetas nuevas y deja las antiguas colgando. Conviene una migración que
  agrupe por clave estable.
- **`package_count`**: no se toca en las filas existentes (prerrellena
  `shipping_packages` de TIPSA). Las 13 nuevas reciben un valor derivado de las
  cantidades de `price_breakdown` excluyendo la preconfiguración, **a validar
  con logística**.
- **Fallback legacy**: `lib/product-rules.ts` deduce las reglas por `code`
  mientras las columnas no estén pobladas. Borrar cuando `20260825000002` esté
  aplicada en producción, junto con `'saas_hardware'` del union
  `ProductCategory` — al quitarlo, TypeScript señalará los restos.

## Orden de aplicación del SQL

El SQL se aplica **a mano** en el SQL Editor (`CLAUDE.md`), así que siempre hay
una ventana con BD y código desalineados. El orden importa:

1. `20260825000001_products_rich_metadata.sql` — aditiva pura, no toca filas.
2. Desplegar el código (ya toleraba la BD vieja mediante el fallback).
3. `20260825000002_products_pricing_flags.sql` — flags + ficha de los servicios.
   **Requiere el paso 2 desplegado**: mueve `saas_hardware` de `category` a
   `service`, y hasta que el código lea `allows_discount` esa oferta admitiría
   descuentos.
4. `20260825000003_catalog_import_web_2026.sql` — 17 UPDATE + 13 INSERT + la
   retirada de `picho-wifi` + el `CHECK` de `category`. En una transacción, con
   la foto previa guardada.

Comprobaciones antes y después: al final de cada fichero de migración.
