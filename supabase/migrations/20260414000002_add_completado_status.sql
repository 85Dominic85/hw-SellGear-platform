-- =============================================================
-- Añadir estado "completado" y migrar pedidos cerrados
-- Migration: 20260414000002_add_completado_status
-- =============================================================

-- -----------------------------------------------
-- 1. Añadir valor al enum
-- -----------------------------------------------

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completado';

-- -----------------------------------------------
-- 2. Desactivar trigger antes de migrar (evita que pise delivered_at)
-- -----------------------------------------------

ALTER TABLE public.orders DISABLE TRIGGER orders_auto_delivered_at;

-- -----------------------------------------------
-- 3. Migrar pedidos cerrados a "completado"
-- -----------------------------------------------

-- Pedidos pagados/solicitados → completado
UPDATE public.orders
SET status = 'completado'
WHERE status IN ('pagado', 'solicitado_a_proveedor');

-- -----------------------------------------------
-- 4. Restaurar delivered_at desde historial (el trigger no lo pisa)
-- -----------------------------------------------

UPDATE public.orders o
SET delivered_at = COALESCE(
  (SELECT sh.changed_at FROM public.status_history sh
   WHERE sh.order_id = o.id AND sh.to_status = 'pagado'
   ORDER BY sh.changed_at DESC LIMIT 1),
  o.updated_at
)
WHERE o.status = 'completado'
  AND o.delivered_at IS NULL;

-- -----------------------------------------------
-- 5. Reactivar trigger
-- -----------------------------------------------

ALTER TABLE public.orders ENABLE TRIGGER orders_auto_delivered_at;

-- -----------------------------------------------
-- 4. Actualizar trigger auto_set_delivered_at
-- -----------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_set_delivered_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Marca delivered_at al pasar a completado
  IF NEW.status = 'completado' AND (OLD.status IS NULL OR OLD.status <> 'completado') THEN
    NEW.delivered_at = NOW();
  END IF;

  -- Limpia delivered_at si se revierte desde completado
  IF OLD.status = 'completado' AND NEW.status <> 'completado' THEN
    NEW.delivered_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------
-- 5. Actualizar RPC get_sla_metrics
-- -----------------------------------------------

CREATE OR REPLACE FUNCTION public.get_sla_metrics(
  p_from TIMESTAMPTZ,
  p_to   TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH delivered AS (
    SELECT
      id,
      created_at,
      delivered_at,
      EXTRACT(EPOCH FROM (delivered_at - created_at)) / 86400.0 AS delivery_days
    FROM orders
    WHERE delivered_at IS NOT NULL
      AND delivered_at >= p_from
      AND delivered_at <= p_to
      AND status = 'completado'
  ),
  agg AS (
    SELECT
      COUNT(*)::INT AS total_delivered,
      COALESCE(ROUND(AVG(delivery_days)::NUMERIC, 1), 0) AS avg_delivery_days,
      COALESCE(
        ROUND(
          (COUNT(*) FILTER (WHERE delivery_days <= 7)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
          1
        ),
        0
      ) AS on_time_pct,
      COUNT(*) FILTER (WHERE delivery_days > 7)::INT AS breached_count
    FROM delivered
  ),
  at_risk AS (
    SELECT COUNT(*)::INT AS active_at_risk
    FROM orders
    WHERE status NOT IN ('completado', 'bloqueado')
      AND EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0 > 5
  ),
  weekly AS (
    SELECT
      DATE_TRUNC('week', delivered_at)::DATE AS week_start,
      COUNT(*)::INT AS count,
      COALESCE(ROUND(AVG(delivery_days)::NUMERIC, 1), 0) AS avg_days,
      COALESCE(
        ROUND(
          (COUNT(*) FILTER (WHERE delivery_days <= 7)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
          1
        ),
        0
      ) AS on_time_pct
    FROM delivered
    GROUP BY DATE_TRUNC('week', delivered_at)
    ORDER BY week_start
  )
  SELECT JSON_BUILD_OBJECT(
    'total_delivered', (SELECT total_delivered FROM agg),
    'avg_delivery_days', (SELECT avg_delivery_days FROM agg),
    'on_time_pct', (SELECT on_time_pct FROM agg),
    'breached_count', (SELECT breached_count FROM agg),
    'active_at_risk', (SELECT active_at_risk FROM at_risk),
    'sla_by_week', COALESCE(
      (SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'week_start', w.week_start,
          'avg_days', w.avg_days,
          'on_time_pct', w.on_time_pct,
          'count', w.count
        ) ORDER BY w.week_start
      ) FROM weekly w),
      '[]'::JSON
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- -----------------------------------------------
-- 6. Recrear indice para pedidos activos
-- -----------------------------------------------

DROP INDEX IF EXISTS idx_orders_active_sla;
CREATE INDEX idx_orders_active_sla
  ON public.orders (created_at)
  WHERE status NOT IN ('completado', 'bloqueado');
