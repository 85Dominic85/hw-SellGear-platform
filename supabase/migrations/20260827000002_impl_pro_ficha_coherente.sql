-- =============================================================
-- Implementación Pro: la ficha comercial decía «A medida» junto a los 500 €.
--
-- 20260827000001 le dio tarifa, pero dejó intacta la copia que había escrito
-- 20260825000002 cuando el producto no tenía precio. Resultado en /catalogo:
-- la tarjeta pinta «500 € · ajustable en el pedido» y a dos centímetros el
-- badge «A medida» y el highlight «Precio acordado con el cliente»; en la
-- ficha, la fila Precio de specifications sigue diciendo «A medida, lo
-- introduce el AE en el pedido». Justo la duda que la migración anterior venía
-- a quitar.
--
-- `software-qamarero` conserva «A medida» a propósito: ese sí se cotiza de cero.
-- =============================================================

BEGIN;

-- 1. Copia comercial coherente con la tarifa.
UPDATE public.products
   SET badge      = 'Servicio'
     , summary    = 'Puesta en marcha completa del local por el equipo de Qamarero. Tarifa de 500 €, ajustable en la línea del pedido.'
     , highlights = ARRAY[
         'Tarifa de 500 €, ajustable en el pedido'
       , 'Incluye configuración y formación'
       , 'Puede incluir tablet KDS de regalo'
       ]
     , specifications = '[
         {"label":"Modalidad","value":"Servicio profesional, no hardware"}
       , {"label":"Precio","value":"500 € sin IVA de tarifa. El comercial puede ajustar el importe o aplicar descuento en la línea del pedido."}
       , {"label":"Extras","value":"Al añadirlo, el wizard pregunta por la Tablet Lenovo Tab Plus como regalo"}
       ]'::jsonb
 WHERE code = 'implementacion-pro';

-- 2. El constraint de 20260827000001 conserva un nombre que ya no describe su
--    contrato: se llama products_free_price_zero_chk pero ya no exige 0 en
--    'free_price'. Quien mire \d+ products sin leer el fichero deduce lo
--    contrario de lo que hace.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_free_price_zero_chk;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_free_price_named_zero_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_free_price_named_zero_chk
  CHECK (pricing_mode <> 'free_price_named' OR price_cents = 0);

-- 3. El COMMENT de price_cents seguía siendo el de 20260427000001 y no
--    mencionaba el rol nuevo. Es donde mira un DBA antes que en las
--    migraciones.
COMMENT ON COLUMN public.products.price_cents IS
  'Precio en céntimos SIN IVA. Con pricing_mode = ''catalog'' es el precio de tarifa que se factura. Con ''free_price'' es un precio de REFERENCIA: se muestra en el catálogo y prerrellena la línea, pero lo que se factura es el snapshot order_items.unit_price_cents que introduce el AE (0 = a convenir, sin cifra que mostrar). Con ''free_price_named'' debe ser 0.';

COMMIT;

-- -------------------------------------------------------------
-- Post-comprobación
--
-- Sustituye a la segunda comprobación de 20260827000001, que era vacua: su
-- WHERE miraba pricing_mode = 'free_price_named', que es precisamente lo que
-- el CHECK ya garantiza, así que nunca podía devolver filas. El riesgo que
-- decía cubrir es el otro: un dedazo que deje tarifa en un 'free_price' que no
-- debería tenerla, porque entonces la tarjeta la muestra como precio firme y
-- applyAddProduct la prerrellena en la línea del pedido.
-- -------------------------------------------------------------
--   -- esperado: solo implementacion-pro | 50000
--   SELECT code, pricing_mode, price_cents
--     FROM public.products
--    WHERE pricing_mode = 'free_price' AND price_cents <> 0
--    ORDER BY code;
--
--   -- esperado: 0 filas
--   SELECT code FROM public.products
--    WHERE pricing_mode = 'free_price_named' AND price_cents <> 0;
--
--   -- esperado: badge 'Servicio' y ninguna mención a "A medida"
--   SELECT badge, highlights[1], specifications->1->>'value'
--     FROM public.products WHERE code = 'implementacion-pro';

-- -------------------------------------------------------------
-- Vuelta atrás (el ORDEN importa)
--
-- Restaurar el CHECK original antes de devolver el precio a 0 falla, porque
-- implementacion-pro sigue a 50000. Primero los datos, después el constraint:
--
--   BEGIN;
--   UPDATE public.products SET price_cents = 0 WHERE code = 'implementacion-pro';
--   ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_free_price_named_zero_chk;
--   ALTER TABLE public.products ADD  CONSTRAINT products_free_price_zero_chk
--     CHECK (pricing_mode = 'catalog' OR price_cents = 0);
--   COMMIT;
--
-- OJO: mientras el CHECK relajado esté puesto, re-ejecutar
-- 20260825000001 contra esta BD aborta — su ADD CONSTRAINT recrea el CHECK
-- estricto sin condiciones y la fila de implementacion-pro lo viola, lo que
-- hace ROLLBACK de todo ese fichero. Para un replay desde cero no hay
-- problema (el orden por nombre aplica esta después).
