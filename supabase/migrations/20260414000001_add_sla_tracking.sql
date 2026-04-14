-- =============================================================
-- SLA Tracking: delivered_at + trigger + RPC metrics + backfill
-- Migration: 20260414000001_add_sla_tracking
-- =============================================================

-- -----------------------------------------------
-- 1. Columna delivered_at en orders
-- -----------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.delivered_at
  IS 'Fecha real de entrega. Se rellena automaticamente al pasar a pagado (completado).';

-- -----------------------------------------------
-- 2. Trigger: auto-set delivered_at al cambiar estado
-- -----------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_set_delivered_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Marca delivered_at al pasar a estado terminal exitoso
  IF NEW.status = 'pagado' AND (OLD.status IS NULL OR OLD.status <> 'pagado') THEN
    NEW.delivered_at = NOW();
  END IF;

  -- Limpia delivered_at si se revierte desde estado terminal
  IF OLD.status = 'pagado' AND NEW.status <> 'pagado' THEN
    NEW.delivered_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_auto_delivered_at ON public.orders;
CREATE TRIGGER orders_auto_delivered_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_delivered_at();

-- -----------------------------------------------
-- 3. Backfill: pedidos ya completados
-- -----------------------------------------------

-- Opcion A: usar status_history si existe registro
UPDATE public.orders o
SET delivered_at = (
  SELECT sh.changed_at
  FROM public.status_history sh
  WHERE sh.order_id = o.id
    AND sh.to_status = 'pagado'
  ORDER BY sh.changed_at DESC
  LIMIT 1
)
WHERE o.status = 'pagado'
  AND o.delivered_at IS NULL;

-- Opcion B: fallback a updated_at si no habia historial
UPDATE public.orders
SET delivered_at = updated_at
WHERE status = 'pagado'
  AND delivered_at IS NULL;

-- -----------------------------------------------
-- 4. Indice para consultas SLA
-- -----------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_delivered_at
  ON public.orders (delivered_at)
  WHERE delivered_at IS NOT NULL;

-- Indice compuesto para pedidos activos en riesgo
CREATE INDEX IF NOT EXISTS idx_orders_active_sla
  ON public.orders (created_at)
  WHERE status NOT IN ('pagado', 'bloqueado');

-- -----------------------------------------------
-- 5. RPC: get_sla_metrics
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
    -- Pedidos entregados (delivered_at dentro del periodo)
    SELECT
      id,
      created_at,
      delivered_at,
      EXTRACT(EPOCH FROM (delivered_at - created_at)) / 86400.0 AS delivery_days
    FROM orders
    WHERE delivered_at IS NOT NULL
      AND delivered_at >= p_from
      AND delivered_at <= p_to
      AND status = 'pagado'
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
    -- Pedidos activos (no terminales) con mas de 5 dias
    SELECT COUNT(*)::INT AS active_at_risk
    FROM orders
    WHERE status NOT IN ('pagado', 'bloqueado')
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
