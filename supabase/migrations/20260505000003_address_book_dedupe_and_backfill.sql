-- =============================================================
-- Address book: dedupe natural + backfill desde orders
-- Migration: 20260505000003_address_book_dedupe_and_backfill
-- Tipo: aditiva. A~ade columnas generadas + UNIQUE constraint y
--   carga las direcciones existentes en orders con dedupe.
-- =============================================================
--
-- Decisiones:
--   * Dedupe natural por (LOWER(TRIM(name)), cp, LOWER(TRIM(address))).
--     Se materializan name_norm/address_norm como columnas STORED para
--     poder usar UNIQUE constraint (las constraints UNIQUE no admiten
--     expresiones directamente; con columnas generadas SI).
--   * UNIQUE permite usar PostgREST `upsert` con onConflict desde el
--     codigo (helper upsertAddressFromOrder).
--   * Backfill solo desde pedidos con direccion estructurada
--     (shipping_street + shipping_cp 5 digitos + shipping_city).
--   * ON CONFLICT DO NOTHING para idempotencia: la migration es segura
--     de re-aplicar y respeta cualquier entrada que ya hayas creado
--     manualmente con la misma clave.

-- -----------------------------------------------------------------
-- 1. Columnas generadas para dedupe natural
-- -----------------------------------------------------------------
ALTER TABLE public.address_book
  ADD COLUMN IF NOT EXISTS name_norm TEXT
    GENERATED ALWAYS AS (LOWER(TRIM(name))) STORED;

ALTER TABLE public.address_book
  ADD COLUMN IF NOT EXISTS address_norm TEXT
    GENERATED ALWAYS AS (LOWER(TRIM(address))) STORED;

-- -----------------------------------------------------------------
-- 2. UNIQUE constraint sobre la clave natural normalizada
-- -----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'address_book_unique_natural'
      AND conrelid = 'public.address_book'::regclass
  ) THEN
    ALTER TABLE public.address_book
      ADD CONSTRAINT address_book_unique_natural
      UNIQUE (name_norm, cp, address_norm);
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 3. Backfill desde orders (estructuradas)
-- -----------------------------------------------------------------
INSERT INTO public.address_book
  (name, venue_name, address, cp, city, province, phone, email)
SELECT DISTINCT ON (
  LOWER(TRIM(o.customer_name)),
  o.shipping_cp,
  LOWER(TRIM(o.shipping_street))
)
  TRIM(o.customer_name),
  NULLIF(TRIM(o.venue_name), ''),
  TRIM(o.shipping_street),
  o.shipping_cp,
  TRIM(o.shipping_city),
  NULLIF(TRIM(o.shipping_province), ''),
  NULLIF(TRIM(o.phone), ''),
  NULLIF(TRIM(o.contact_email), '')
FROM public.orders o
WHERE o.shipping_street IS NOT NULL
  AND TRIM(o.shipping_street) <> ''
  AND o.shipping_cp ~ '^\d{5}$'
  AND o.shipping_city IS NOT NULL
  AND TRIM(o.shipping_city) <> ''
  AND o.customer_name IS NOT NULL
  AND TRIM(o.customer_name) <> ''
ORDER BY
  LOWER(TRIM(o.customer_name)),
  o.shipping_cp,
  LOWER(TRIM(o.shipping_street)),
  o.created_at DESC
ON CONFLICT ON CONSTRAINT address_book_unique_natural DO NOTHING;

-- ROLLBACK manual:
--   ALTER TABLE public.address_book DROP CONSTRAINT IF EXISTS address_book_unique_natural;
--   ALTER TABLE public.address_book DROP COLUMN IF EXISTS address_norm;
--   ALTER TABLE public.address_book DROP COLUMN IF EXISTS name_norm;
--   -- Las filas creadas por el backfill se quedan; identificalas con created_by IS NULL si quieres limpiarlas.
