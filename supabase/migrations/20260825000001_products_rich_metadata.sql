-- =============================================================
-- products: metadatos ricos del catálogo comercial web.
--
-- Trae a Supabase la ficha completa que hoy vive en el repo aparte
-- hw-qamarero-catalog (lib/catalog.ts): marca, modelo, resumen,
-- "ideal para", highlights, especificaciones, componentes, desglose de
-- precio y modelos alternativos. Añade además tres ejes de negocio que
-- hasta ahora estaban hardcodeados en el cliente:
--
--   region          -> peninsula | canarias. Canarias son SKU propios con
--                      precio FINAL y vat_rate = 0. Es un eje ORTOGONAL a
--                      category: un TPV canario sigue siendo category=tpv.
--   pricing_mode    -> sustituye al predicado "precio libre" que hoy está
--                      replicado 9 veces por code en 7 ficheros.
--   allows_discount -> sustituye al hardcode category=saas_hardware de
--                      lib/orders-validation.ts.
--
-- Migración ADITIVA e IDEMPOTENTE: no toca ninguna fila ni borra nada.
-- Los datos llegan en 20260825000002 y 20260825000003.
--
-- Aplicación manual en Supabase SQL Editor.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Columnas
-- -------------------------------------------------------------
ALTER TABLE public.products
  -- Linaje de importación
  ADD COLUMN IF NOT EXISTS catalog_slug            TEXT,
  -- Ficha comercial (escalares)
  ADD COLUMN IF NOT EXISTS brand                   TEXT,
  ADD COLUMN IF NOT EXISTS model                   TEXT,
  ADD COLUMN IF NOT EXISTS summary                 TEXT,
  ADD COLUMN IF NOT EXISTS ideal_for               TEXT,
  ADD COLUMN IF NOT EXISTS badge                   TEXT,
  ADD COLUMN IF NOT EXISTS internal_note           TEXT,
  ADD COLUMN IF NOT EXISTS availability_note       TEXT,
  ADD COLUMN IF NOT EXISTS model_availability_note TEXT,
  ADD COLUMN IF NOT EXISTS price_prefix            TEXT,
  ADD COLUMN IF NOT EXISTS image_url               TEXT,
  -- Ejes de negocio
  ADD COLUMN IF NOT EXISTS region                  TEXT    NOT NULL DEFAULT 'peninsula',
  ADD COLUMN IF NOT EXISTS pricing_mode            TEXT    NOT NULL DEFAULT 'catalog',
  ADD COLUMN IF NOT EXISTS allows_discount         BOOLEAN NOT NULL DEFAULT TRUE,
  -- Listas planas ordenadas
  ADD COLUMN IF NOT EXISTS highlights              TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS components              TEXT[]  NOT NULL DEFAULT '{}',
  -- Estructuras ordenadas (arrays jsonb: el orden de un ARRAY sí se preserva)
  ADD COLUMN IF NOT EXISTS specifications          JSONB   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS price_breakdown         JSONB,
  ADD COLUMN IF NOT EXISTS model_options           JSONB,
  -- Derivado por trigger desde price_breakdown
  ADD COLUMN IF NOT EXISTS standalone_price_cents  INTEGER;

COMMENT ON COLUMN public.products.catalog_slug IS
  'id del producto en el catálogo web (hw-qamarero-catalog/lib/catalog.ts). Solo linaje de importación: permite reimportar sin adivinar el mapeo cuando code != id de origen (ej. printer-cable <- impresora-cable). NO es la clave de rutas: las URLs usan code.';
COMMENT ON COLUMN public.products.brand IS
  'Marca del fabricante (Syrion, 10POS, AIMV, JASSWAY, GL.iNet, Epelsa, Aqprox, HPRT, Lenovo, Qamarero...).';
COMMENT ON COLUMN public.products.model IS
  'Referencia del fabricante cuando aporta información (Galia, Tab Plus, 56PPI-15, CT-P531, 10D-215).';
COMMENT ON COLUMN public.products.summary IS
  'One-liner comercial del catálogo web. Las tarjetas y la ficha muestran summary; description queda como descripción técnica/ops para hardware.';
COMMENT ON COLUMN public.products.ideal_for IS
  'A qué tipo de local le encaja. Es el texto que la tarjeta usa como cuerpo.';
COMMENT ON COLUMN public.products.badge IS
  'Etiqueta comercial de la esquina de la tarjeta (Popular, Recomendado, Premium, Canarias...).';
COMMENT ON COLUMN public.products.internal_note IS
  'Nota INTERNA para el comercial. Nunca debe salir en PDF ni en comunicación al cliente.';
COMMENT ON COLUMN public.products.region IS
  'peninsula | canarias. Los SKU canarios llevan precio FINAL y vat_rate=0. Eje ortogonal a category. Se valida contra shipping_cp en POST /api/orders.';
COMMENT ON COLUMN public.products.pricing_mode IS
  'catalog = precio de catálogo | free_price = el AE introduce el precio | free_price_named = el AE introduce precio Y descripción. Sustituye a los predicados hardcodeados por code.';
COMMENT ON COLUMN public.products.allows_discount IS
  'FALSE = la línea no admite discount_pct != 0 (precio negociado = precio final).';
COMMENT ON COLUMN public.products.highlights IS
  'Bullets cortos de la tarjeta, en orden. 3 para productos sueltos, 4 para packs.';
COMMENT ON COLUMN public.products.components IS
  'Qué incluye la caja. Solo packs. Ojo: no es lo mismo que package_count, que son bultos de envío TIPSA.';
COMMENT ON COLUMN public.products.specifications IS
  'ARRAY jsonb [{label,value}] — array y NO objeto, porque jsonb no preserva el orden de claves de un objeto y la ficha necesita el orden curado (Pantalla -> Procesador -> Memoria...).';
COMMENT ON COLUMN public.products.price_breakdown IS
  'ARRAY jsonb [{label, price_cents, quantity?}]. price_cents en CÉNTIMOS (convención de la casa), no en euros como el catálogo web.';
COMMENT ON COLUMN public.products.model_options IS
  'ARRAY jsonb [{name, image_url}]. Modelos alternativos que se envían según disponibilidad (TPV Pro: Aqprox appTPV05 o 10POS). La ficha no debe prometer una marca única.';
COMMENT ON COLUMN public.products.standalone_price_cents IS
  'Suma de price_breakdown (price_cents * quantity). Mantenido por trigger. El ahorro del pack = standalone_price_cents - price_cents.';
COMMENT ON COLUMN public.products.image_url IS
  'Ruta bajo /products/. Sustituye la derivación /products/{code}.png|svg que hacía el cliente con una cadena de onError.';

-- -------------------------------------------------------------
-- 2. Validadores IMMUTABLE
--    Permiten poner CHECK sobre la FORMA del jsonb, que es lo que
--    mantiene la promesa de "validaciones server-side" de CLAUDE.md en
--    una tabla que se edita a mano en el SQL Editor.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jsonb_is_label_value_array(v JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $fn$
  SELECT v IS NULL OR (
    jsonb_typeof(v) = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v) e
       WHERE jsonb_typeof(e)          <> 'object'
          OR jsonb_typeof(e->'label') <> 'string'
          OR jsonb_typeof(e->'value') <> 'string'
          OR length(e->>'label') = 0
    )
  );
$fn$;

CREATE OR REPLACE FUNCTION public.jsonb_is_price_breakdown(v JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $fn$
  SELECT v IS NULL OR (
    jsonb_typeof(v) = 'array' AND jsonb_array_length(v) > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v) e
       WHERE jsonb_typeof(e)                <> 'object'
          OR jsonb_typeof(e->'label')       <> 'string'
          OR length(e->>'label') = 0
          OR jsonb_typeof(e->'price_cents') <> 'number'
          OR (e->>'price_cents')::numeric   <  0
          OR (e->>'price_cents')::numeric   <> trunc((e->>'price_cents')::numeric)
          OR (e ? 'quantity' AND (
               jsonb_typeof(e->'quantity')  <> 'number'
               OR (e->>'quantity')::numeric <  1
               OR (e->>'quantity')::numeric <> trunc((e->>'quantity')::numeric)
             ))
    )
  );
$fn$;

CREATE OR REPLACE FUNCTION public.jsonb_is_model_options(v JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $fn$
  SELECT v IS NULL OR (
    jsonb_typeof(v) = 'array' AND jsonb_array_length(v) > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v) e
       WHERE jsonb_typeof(e)              <> 'object'
          OR jsonb_typeof(e->'name')      <> 'string'
          OR length(e->>'name') = 0
          OR jsonb_typeof(e->'image_url') <> 'string'
          OR (e->>'image_url') NOT LIKE '/products/%'
    )
  );
$fn$;

COMMENT ON FUNCTION public.jsonb_is_label_value_array(JSONB) IS
  'Valida [{label:string, value:string}]. La usa el CHECK de products.specifications.';
COMMENT ON FUNCTION public.jsonb_is_price_breakdown(JSONB) IS
  'Valida [{label:string, price_cents:int>=0, quantity?:int>=1}]. La usa el CHECK de products.price_breakdown.';
COMMENT ON FUNCTION public.jsonb_is_model_options(JSONB) IS
  'Valida [{name:string, image_url bajo /products/}]. La usa el CHECK de products.model_options.';

-- -------------------------------------------------------------
-- 3. CHECKs
--    Patrón DROP IF EXISTS + ADD: ADD CONSTRAINT no admite IF NOT EXISTS.
-- -------------------------------------------------------------
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_region_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_region_chk
  CHECK (region IN ('peninsula', 'canarias'));

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_pricing_mode_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_pricing_mode_chk
  CHECK (pricing_mode IN ('catalog', 'free_price', 'free_price_named'));

-- Precio libre => price_cents = 0. El importe real vive en el snapshot
-- order_items.unit_price_cents, que es lo que introduce el AE.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_free_price_zero_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_free_price_zero_chk
  CHECK (pricing_mode = 'catalog' OR price_cents = 0);

-- Canarias => precio FINAL sin impuesto. Convención de lib/pricing.ts:
-- vat_rate = 0 se etiqueta "Exento (Canarias)".
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_canarias_vat_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_canarias_vat_chk
  CHECK (region <> 'canarias' OR vat_rate = 0);

-- image_url solo rutas locales: next.config.ts no define
-- images.remotePatterns, así que una URL remota rompería next/image.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_image_url_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_image_url_chk
  CHECK (image_url IS NULL OR image_url ~ '^/products/[A-Za-z0-9._/-]+[.](png|webp|svg|jpg|jpeg)$');

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_specifications_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_specifications_chk
  CHECK (public.jsonb_is_label_value_array(specifications));

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_price_breakdown_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_price_breakdown_chk
  CHECK (public.jsonb_is_price_breakdown(price_breakdown));

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_model_options_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_model_options_chk
  CHECK (public.jsonb_is_model_options(model_options));

-- -------------------------------------------------------------
-- 4. standalone_price_cents por trigger
--    No puede ser GENERATED: jsonb_array_elements es set-returning y
--    Postgres no lo admite en la expresión de una columna generada.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.products_sync_standalone_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.price_breakdown IS NULL THEN
    NEW.standalone_price_cents := NULL;
  ELSE
    SELECT COALESCE(SUM((e->>'price_cents')::int * COALESCE((e->>'quantity')::int, 1)), 0)
      INTO NEW.standalone_price_cents
      FROM jsonb_array_elements(NEW.price_breakdown) e;
  END IF;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.products_sync_standalone_price() IS
  'Mantiene products.standalone_price_cents como suma de price_breakdown. El ahorro del pack se calcula una vez, en la BD, y queda ordenable en SQL.';

DROP TRIGGER IF EXISTS trg_products_standalone_price ON public.products;
CREATE TRIGGER trg_products_standalone_price
  BEFORE INSERT OR UPDATE OF price_breakdown ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_sync_standalone_price();

-- -------------------------------------------------------------
-- 5. Índices
--    Con ~35 filas todo es seq scan: el índice único de catalog_slug es
--    por CORRECCIÓN (evita que dos SKU apunten al mismo origen), no por
--    velocidad.
-- -------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_catalog_slug
  ON public.products (catalog_slug) WHERE catalog_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_active_region_sort
  ON public.products (active, region, sort_order);

-- -------------------------------------------------------------
-- 6. RLS: declarar WITH CHECK explícito.
--    Higiene, no corrección: en FOR ALL Postgres ya deriva WITH CHECK de
--    USING cuando se omite. Dejarlo escrito evita tener que recordarlo.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "products: admin full" ON public.products;
CREATE POLICY "products: admin full" ON public.products FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "products: manager full" ON public.products;
CREATE POLICY "products: manager full" ON public.products FOR ALL
  USING (public.get_my_role() = 'manager')
  WITH CHECK (public.get_my_role() = 'manager');
