-- =============================================================================
-- order_items: campos para modo carrito (FK products + snapshot precio/IVA/desc)
-- Migration: 20260427000002_order_items_cart_mode
-- Tipo: aditiva, idempotente.
-- Objetivo: que las lineas del pedido referencien al catalogo (product_id) y
--           guarden snapshot inmutable del precio sin IVA, IVA y descuento
--           aplicados al crear el pedido. Asi no se distorsionan totales si
--           luego cambia products.price_cents.
-- Compat: product_name (texto libre legacy) sigue NULLable. Pedidos antiguos
--         con product_id IS NULL siguen mostrandose; nuevos pedidos del form
--         /orders/new siempre rellenan product_id.
-- =============================================================================

-- -----------------------------------------------
-- 1. Columnas nuevas
-- -----------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_id        UUID         REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS unit_price_cents  INTEGER      CHECK (unit_price_cents IS NULL OR unit_price_cents >= 0),
  ADD COLUMN IF NOT EXISTS discount_pct      NUMERIC(5,2) DEFAULT 0 CHECK (discount_pct IS NULL OR (discount_pct >= 0 AND discount_pct <= 100)),
  ADD COLUMN IF NOT EXISTS vat_rate          NUMERIC(5,2) DEFAULT 21.00 CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));

COMMENT ON COLUMN public.order_items.product_id        IS 'FK al catalogo. NULL solo en pedidos legacy o Typeform con product_name texto libre.';
COMMENT ON COLUMN public.order_items.unit_price_cents  IS 'Precio unitario SIN IVA en centimos. Snapshot inmutable al crear el pedido. Override permitido para code=otro.';
COMMENT ON COLUMN public.order_items.discount_pct      IS 'Descuento % aplicado por el AE (rango UI: 0 o 10). El CHECK admite hasta 100 para flexibilidad futura.';
COMMENT ON COLUMN public.order_items.vat_rate          IS 'IVA % snapshot al crear el pedido (default 21).';

-- -----------------------------------------------
-- 2. Indice para joins/lookups por catalogo
-- -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items (product_id)
  WHERE product_id IS NOT NULL;
