-- =============================================================
-- Corrección: los validadores de jsonb no detectaban una clave AUSENTE.
--
-- Los tres validadores de 20260825000001 usaban:
--     jsonb_typeof(e->'label') <> 'string'
--
-- Cuando la clave no existe, `e->'label'` es NULL, `jsonb_typeof(NULL)` es
-- NULL, y `NULL <> 'string'` es NULL — que NO es TRUE. Así que la fila no
-- satisface el WHERE, el EXISTS no la ve, el NOT EXISTS pasa y el CHECK
-- acepta el valor. Lógica ternaria de SQL.
--
-- Consecuencia: `[{"foo":"bar"}]` colaba en specifications, price_breakdown
-- y model_options. Todo lo demás sí se rechazaba correctamente (tipo
-- equivocado, cadena vacía, no-array, número negativo, URL remota), así que
-- el agujero era justo el caso de escribir la clave mal.
--
-- Arreglo: IS DISTINCT FROM, que trata NULL como distinto.
--
-- No hay datos que corregir: las 35 filas actuales son válidas. Al final se
-- revalidan explícitamente, porque CREATE OR REPLACE FUNCTION no vuelve a
-- comprobar las filas existentes.
--
-- Aplicación manual en Supabase SQL Editor.
-- =============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.jsonb_is_label_value_array(v JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $fn$
  SELECT v IS NULL OR (
    jsonb_typeof(v) = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v) e
       WHERE jsonb_typeof(e)          IS DISTINCT FROM 'object'
          OR jsonb_typeof(e->'label') IS DISTINCT FROM 'string'
          OR jsonb_typeof(e->'value') IS DISTINCT FROM 'string'
          OR coalesce(length(e->>'label'), 0) = 0
    )
  );
$fn$;

CREATE OR REPLACE FUNCTION public.jsonb_is_price_breakdown(v JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $fn$
  SELECT v IS NULL OR (
    jsonb_typeof(v) = 'array' AND jsonb_array_length(v) > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v) e
       WHERE jsonb_typeof(e)                IS DISTINCT FROM 'object'
          OR jsonb_typeof(e->'label')       IS DISTINCT FROM 'string'
          OR coalesce(length(e->>'label'), 0) = 0
          OR jsonb_typeof(e->'price_cents') IS DISTINCT FROM 'number'
          OR (e->>'price_cents')::numeric   <  0
          OR (e->>'price_cents')::numeric   <> trunc((e->>'price_cents')::numeric)
          OR (e ? 'quantity' AND (
               jsonb_typeof(e->'quantity')  IS DISTINCT FROM 'number'
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
       WHERE jsonb_typeof(e)              IS DISTINCT FROM 'object'
          OR jsonb_typeof(e->'name')      IS DISTINCT FROM 'string'
          OR coalesce(length(e->>'name'), 0) = 0
          OR jsonb_typeof(e->'image_url') IS DISTINCT FROM 'string'
          OR (e->>'image_url') NOT LIKE '/products/%'
    )
  );
$fn$;

-- -------------------------------------------------------------
-- Revalidacion explicita.
--
-- CREATE OR REPLACE FUNCTION no vuelve a comprobar las filas existentes, asi
-- que los CHECK quedarian "confiando" en un validador que ya no es el que
-- las aprobo. Aqui se pasan las 35 filas por los validadores nuevos y, si
-- alguna no cumple, la transaccion se revierte con el detalle.
-- -------------------------------------------------------------
DO $revalida$
DECLARE
  malas text;
BEGIN
  SELECT string_agg(code || ' (' || motivo || ')', ', ')
    INTO malas
    FROM (
      SELECT code, 'specifications' AS motivo FROM public.products
       WHERE NOT public.jsonb_is_label_value_array(specifications)
      UNION ALL
      SELECT code, 'price_breakdown' FROM public.products
       WHERE NOT public.jsonb_is_price_breakdown(price_breakdown)
      UNION ALL
      SELECT code, 'model_options' FROM public.products
       WHERE NOT public.jsonb_is_model_options(model_options)
    ) t;

  IF malas IS NOT NULL THEN
    RAISE EXCEPTION
      'Los validadores corregidos rechazan filas que ya estan en la tabla: %. Corrigelas antes de reintentar.',
      malas;
  END IF;

  RAISE NOTICE 'Revalidacion OK: las % filas pasan los validadores corregidos.',
    (SELECT count(*) FROM public.products);
END
$revalida$;

COMMIT;

-- -------------------------------------------------------------
-- Comprobación DESPUÉS de aplicar: las tres escrituras siguientes deben
-- fallar. Antes de esta migración, las tres pasaban.
-- -------------------------------------------------------------
--   UPDATE public.products SET specifications  = '[{"foo":"bar"}]'::jsonb WHERE code = 'router-opal';
--   UPDATE public.products SET price_breakdown = '[{"foo":"bar"}]'::jsonb WHERE code = 'router-opal';
--   UPDATE public.products SET model_options   = '[{"foo":"bar"}]'::jsonb WHERE code = 'router-opal';
--
--   -- Y estas deben seguir funcionando:
--   SELECT code FROM public.products
--    WHERE NOT public.jsonb_is_label_value_array(specifications)
--       OR NOT public.jsonb_is_price_breakdown(price_breakdown)
--       OR NOT public.jsonb_is_model_options(model_options);
--   -- esperado: 0 filas
