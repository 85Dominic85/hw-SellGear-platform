-- =============================================================
-- Añadir columna orders.discount_global_pct para descuento a nivel
-- de pedido (adicional a los descuentos por línea de order_items).
--
-- Modelo:
--   * order_items.discount_pct: descuento por línea (0-100).
--   * orders.discount_global_pct: descuento adicional sobre la base
--     imponible ya reducida por los descuentos por línea. Se aplica
--     ANTES del IVA para que el desglose fiscal sea correcto.
--
-- Se aplica prorrateado sobre la base de cada línea (correcto con
-- IVA mixto Península 21% / Canarias 0%). Cálculo en
-- apps/web/lib/pricing.ts:cartTotals.
--
-- Aplicación: MANUAL en Supabase SQL Editor del proyecto principal.
-- Per CLAUDE.md los archivos en supabase/migrations/ son solo
-- trazabilidad/CI.
-- =============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_global_pct NUMERIC(5,2)
    DEFAULT 0
    CHECK (
      discount_global_pct IS NULL
      OR (discount_global_pct >= 0 AND discount_global_pct <= 100)
    );

COMMENT ON COLUMN public.orders.discount_global_pct IS
  'Descuento global (%) aplicado a la base imponible del pedido, '
  'adicional a los descuentos por línea de order_items.discount_pct. '
  'Rango 0-100. Se prorratea entre las bases de cada línea antes de '
  'calcular el IVA (fiscalmente correcto con IVA mixto).';

-- Verificación:
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name = 'orders'
--    AND column_name = 'discount_global_pct';
-- Esperado: discount_global_pct | numeric | YES | 0
