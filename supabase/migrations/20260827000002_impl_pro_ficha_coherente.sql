-- =============================================================
-- Implementación Pro: la ficha comercial decía «A medida» junto a los 500 €.
--
-- 20260827000001 le dio tarifa, pero dejó intacta la copia que había escrito
-- 20260825000002 cuando el producto no tenía precio. Resultado en /catalogo:
-- la tarjeta pinta «500 € · ajustable en el pedido» y a dos centímetros el
-- badge «A medida» y el highlight «Precio acordado con el cliente»; en la
-- ficha, la fila Precio de specifications seguía diciendo «A medida, lo
-- introduce el AE en el pedido». Justo la duda que la migración anterior venía
-- a quitar.
--
-- `software-qamarero` conserva «A medida» a propósito: ese sí se cotiza de cero.
--
-- IDEMPOTENTE. Se puede pegar dos veces sin miedo:
--   · precondición que aborta si falta 20260827000001 o si el producto no está;
--   · el UPDATE no escribe nada si los cuatro campos ya son los de destino,
--     así que no dispara el trigger de updated_at ni ensucia el histórico;
--   · el constraint solo se rehace si aún tiene el nombre viejo;
--   · el COMMENT es idempotente por naturaleza.
-- Termina con un SELECT de comprobación, que es lo que se ve en el editor.
-- =============================================================

-- -------------------------------------------------------------
-- 0. Precondición
-- -------------------------------------------------------------
DO $guard$
DECLARE
  v_mode  TEXT;
  v_price INTEGER;
BEGIN
  SELECT pricing_mode, price_cents INTO v_mode, v_price
    FROM public.products WHERE code = 'implementacion-pro';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'No existe el producto implementacion-pro. ¿Base de datos equivocada?';
  END IF;

  IF v_mode <> 'free_price' OR v_price <> 50000 THEN
    RAISE EXCEPTION
      'Falta aplicar 20260827000001: implementacion-pro está en pricing_mode=% y price_cents=% (se esperaba free_price / 50000).',
      v_mode, v_price;
  END IF;
END
$guard$;

BEGIN;

-- -------------------------------------------------------------
-- 1. Copia comercial coherente con la tarifa.
--    Los valores de destino se escriben UNA vez, en el CTE, y la comparación
--    fila a fila decide si hay algo que cambiar. Si ya está aplicada, el
--    UPDATE afecta a 0 filas.
-- -------------------------------------------------------------
WITH objetivo AS (
  SELECT
    'Servicio'::TEXT AS badge,
    'Puesta en marcha completa del local por el equipo de Qamarero. Tarifa de 500 €, ajustable en la línea del pedido.'::TEXT AS summary,
    ARRAY[
      'Tarifa de 500 €, ajustable en el pedido'
    , 'Incluye configuración y formación'
    , 'Puede incluir tablet KDS de regalo'
    ]::TEXT[] AS highlights,
    '[
       {"label":"Modalidad","value":"Servicio profesional, no hardware"}
     , {"label":"Precio","value":"500 € sin IVA de tarifa. El comercial puede ajustar el importe o aplicar descuento en la línea del pedido."}
     , {"label":"Extras","value":"Al añadirlo, el wizard pregunta por la Tablet Lenovo Tab Plus como regalo"}
     ]'::JSONB AS specifications
)
UPDATE public.products p
   SET badge          = o.badge
     , summary        = o.summary
     , highlights     = o.highlights
     , specifications = o.specifications
  FROM objetivo o
 WHERE p.code = 'implementacion-pro'
   AND (p.badge, p.summary, p.highlights, p.specifications)
       IS DISTINCT FROM (o.badge, o.summary, o.highlights, o.specifications);

-- -------------------------------------------------------------
-- 2. El constraint de 20260827000001 conserva un nombre que ya no describe su
--    contrato: se llama products_free_price_zero_chk pero ya no exige 0 en
--    'free_price'. Quien lo lea en el esquema sin abrir este fichero deduce lo
--    contrario de lo que hace.
--
--    Solo se rehace si el nombre nuevo no está: repetir el DROP + ADD
--    revalidaría la tabla entera sin necesidad.
-- -------------------------------------------------------------
DO $chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.products'::REGCLASS
       AND conname  = 'products_free_price_named_zero_chk'
  ) THEN
    ALTER TABLE public.products
      DROP CONSTRAINT IF EXISTS products_free_price_zero_chk;
    ALTER TABLE public.products
      ADD  CONSTRAINT products_free_price_named_zero_chk
      CHECK (pricing_mode <> 'free_price_named' OR price_cents = 0);
  END IF;
END
$chk$;

-- -------------------------------------------------------------
-- 3. El COMMENT de price_cents seguía siendo el de 20260427000001 y no
--    mencionaba el rol nuevo. Es donde mira un DBA antes que en las
--    migraciones.
-- -------------------------------------------------------------
COMMENT ON COLUMN public.products.price_cents IS
  'Precio en céntimos SIN IVA. Con pricing_mode = ''catalog'' es el precio de tarifa que se factura. Con ''free_price'' es un precio de REFERENCIA: se muestra en el catálogo y prerrellena la línea, pero lo que se factura es el snapshot order_items.unit_price_cents que introduce el AE (0 = a convenir, sin cifra que mostrar). Con ''free_price_named'' debe ser 0.';

COMMIT;

-- -------------------------------------------------------------
-- 4. Comprobación. Debe devolver una fila con todo a OK.
-- -------------------------------------------------------------
SELECT
    p.code
  , p.pricing_mode
  , p.price_cents
  , p.badge
  , p.highlights[1]                      AS highlight_1
  , p.specifications->1->>'value'        AS spec_precio
  , (p.badge = 'Servicio')               AS copia_ok
  , EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.products'::REGCLASS
         AND conname  = 'products_free_price_named_zero_chk'
    )                                    AS constraint_ok
  FROM public.products p
 WHERE p.code = 'implementacion-pro';

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
--
-- La segunda post-comprobación de 20260827000001 era vacua: su WHERE miraba
-- pricing_mode = 'free_price_named', que es justo lo que el CHECK garantiza,
-- así que nunca podía devolver filas. La correcta es la de arriba, más:
--
--   -- esperado: solo implementacion-pro | 50000
--   SELECT code, pricing_mode, price_cents FROM public.products
--    WHERE pricing_mode = 'free_price' AND price_cents <> 0 ORDER BY code;
