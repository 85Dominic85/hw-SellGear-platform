-- =============================================================
-- Implementación Pro: 500 € de tarifa, ajustable en la línea del pedido.
--
-- PROBLEMA
--   `implementacion-pro` tenía `pricing_mode = 'free_price'` y, por el CHECK
--   `products_free_price_zero_chk`, `price_cents` forzado a 0. Consecuencias
--   en la app:
--     · la tarjeta del catálogo ponía «Precio a medida» y el comercial tenía
--       que saberse la tarifa de memoria;
--     · el paso 2 del wizard exigía el importe pero no ofrecía dónde
--       escribirlo, así que quedaba bloqueado en «Falta el precio de
--       Implementación Pro» sin salida posible.
--   El histórico confirma que sí hay tarifa y que lo que varía es el
--   descuento: 5 líneas a 350 €, 1 a 500 € y 1 a 251 € (order_items,
--   jul-ago 2026).
--
-- DECISIÓN
--   En los modos de precio libre, `price_cents` pasa a ser un PRECIO DE
--   REFERENCIA: se muestra en la tarjeta y prerrellena la línea, pero el
--   importe que se factura sigue siendo el snapshot
--   `order_items.unit_price_cents` que introduce el AE. Eso ya es así en el
--   servidor sin tocar nada: en POST /api/orders el override SIEMPRE
--   sobreescribe `product.price_cents` y es obligatorio (>0), así que una
--   tarifa desactualizada no puede colarse en una factura.
--
--   `free_price_named` (línea libre `otro`, oferta mixta `saas_hardware`) se
--   queda obligado a 0: ahí el AE escribe también la descripción, así que no
--   hay producto tarifado del que hablar.
--
--   `software-qamarero` se queda a 0 a propósito: se cotiza de cero y sigue
--   mostrando «Precio a medida».
--
-- REQUISITO DE ORDEN
--   El código que lee el precio de referencia (lib/product-rules.ts →
--   `referencePriceCents`) tolera los dos estados: con `price_cents = 0`
--   devuelve null y la tarjeta sigue diciendo «Precio a medida». Se puede
--   aplicar antes o después del despliegue.
-- =============================================================

BEGIN;

-- 1. El CHECK deja de exigir 0 en 'free_price'.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_free_price_zero_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_free_price_zero_chk
  CHECK (pricing_mode <> 'free_price_named' OR price_cents = 0);

COMMENT ON COLUMN public.products.pricing_mode IS
  'catalog = precio fijo de tarifa. free_price = el AE introduce el importe en la línea; price_cents es el precio de REFERENCIA (0 = a convenir). free_price_named = además escribe la descripción, y price_cents debe ser 0.';

-- 2. Tarifa de Implementación Pro.
UPDATE public.products
   SET price_cents = 50000
 WHERE code = 'implementacion-pro'
   AND pricing_mode = 'free_price';

COMMIT;

-- -------------------------------------------------------------
-- Post-comprobación (ejecutar aparte y revisar a ojo)
-- -------------------------------------------------------------
--   -- esperado: implementacion-pro | free_price | 50000 | t
--   SELECT code, pricing_mode, price_cents, allows_discount
--     FROM public.products
--    WHERE pricing_mode <> 'catalog'
--    ORDER BY code;
--
--   -- esperado: 0 filas (nadie más con tarifa en modo libre por descuido)
--   SELECT code, pricing_mode, price_cents
--     FROM public.products
--    WHERE pricing_mode = 'free_price_named' AND price_cents <> 0;
