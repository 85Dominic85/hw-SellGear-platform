-- =============================================================
-- Renombrar solicitado_a_proveedor → enviado_proveedor
-- Añadir estado "enviado" (desde oficina)
-- Migration: 20260414000003_rename_and_add_shipping_statuses
-- =============================================================

-- -----------------------------------------------
-- 1. Añadir nuevos valores al enum
-- -----------------------------------------------

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'enviado_proveedor';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'enviado';

-- -----------------------------------------------
-- 2. Migrar pedidos de solicitado_a_proveedor → enviado_proveedor
-- -----------------------------------------------

-- Desactivar trigger para que no pise delivered_at
ALTER TABLE public.orders DISABLE TRIGGER orders_auto_delivered_at;

UPDATE public.orders
SET status = 'enviado_proveedor'
WHERE status = 'solicitado_a_proveedor';

ALTER TABLE public.orders ENABLE TRIGGER orders_auto_delivered_at;

-- -----------------------------------------------
-- 3. Actualizar status_history: renombrar referencias antiguas
-- -----------------------------------------------

-- Los historicos que apuntaban a solicitado_a_proveedor se dejan como estan
-- (el enum antiguo sigue existiendo, solo dejamos de usarlo)

-- -----------------------------------------------
-- 4. Actualizar RPC get_sla_metrics (sin cambios, ya usa completado)
-- -----------------------------------------------

-- No necesita cambios: la RPC solo mira 'completado' y 'bloqueado'

-- -----------------------------------------------
-- 5. Actualizar indice de pedidos activos
-- -----------------------------------------------

DROP INDEX IF EXISTS idx_orders_active_sla;
CREATE INDEX idx_orders_active_sla
  ON public.orders (created_at)
  WHERE status NOT IN ('completado', 'bloqueado');
