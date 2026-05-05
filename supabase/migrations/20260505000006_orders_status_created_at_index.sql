-- =============================================================
-- Indices compuestos para acelerar /orders y la home
-- Migration: 20260505000006_orders_status_created_at_index
-- Tipo: aditiva, idempotente. CREATE INDEX IF NOT EXISTS.
-- =============================================================
--
-- Acelera:
--   1. Filtro por status + orden por created_at DESC en /orders
--      (cuando el usuario filtra por estado).
--   2. Conteo del badge "nuevo" en layout (sidebar) y en home
--      (KpiTile "Pedidos" + CategoryTile por purchase_type).
--   3. Deep-link de cada CategoryTile en la home: /orders?type=...
--
-- Aditivo: el codigo funciona sin estos indices, solo mas lento.
-- Rollback: DROP INDEX IF EXISTS ... (ver final del archivo).

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON public.orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_purchase_type_created_at
  ON public.orders (purchase_type, created_at DESC);

-- ROLLBACK manual:
--   DROP INDEX IF EXISTS public.idx_orders_status_created_at;
--   DROP INDEX IF EXISTS public.idx_orders_purchase_type_created_at;
