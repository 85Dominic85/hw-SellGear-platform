-- =============================================================================
-- Migracion: anadir flag shipping_return (envio TIPSA con recogida de material)
-- Fecha: 2026-04-23
-- Tipo: aditiva, idempotente.
-- Objetivo: auditar que envios se crearon con boRetorno=true (recogida de
--          material al destinatario tras la entrega).
-- =============================================================================

-- 1. Columna en orders (NULLable + default false, no rompe filas existentes)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_return BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.orders.shipping_return IS
  'True si el envio TIPSA se creo con boRetorno=true (incluye recogida de material).';

-- 2. Nota: no requiere indice, no se usa como filtro habitual en UI.
