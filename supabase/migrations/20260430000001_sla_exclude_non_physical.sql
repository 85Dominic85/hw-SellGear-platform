-- =============================================================
-- SLA: excluir tipos sin envio fisico de las metricas de tiempo
-- Migration: 20260430000001_sla_exclude_non_physical
-- =============================================================
--
-- Las metricas de SLA del departamento (avg_delivery_days, on_time_pct,
-- breached_count, active_at_risk, sla_by_week, total_delivered) deben
-- reflejar UNICAMENTE pedidos que implican un envio fisico desde la oficina.
--
-- Los pedidos de tipo 'transferencias_saas' (suscripciones) y 'otro'
-- (categoria generica sin envio) pueden tardar semanas en marcarse como
-- completado por motivos administrativos, lo que infla artificialmente el
-- plazo medio de entrega y rompe el cumplimiento del SLA de 7 dias.
--
-- Estos tipos SI siguen contando en el resto de KPIs (total_orders,
-- total_revenue, breakdowns, etc.). Solo se excluyen del SLA fisico.
--
-- Cambios respecto a la version previa (20260414000002_add_completado_status):
--   1. CTE `delivered`: filtra purchase_type NOT IN ('transferencias_saas', 'otro').
--   2. CTE `at_risk`: mismo filtro.
--   3. Indice parcial `idx_orders_active_sla`: incorpora el filtro para que
--      las consultas de pedidos activos no tengan que descartar SaaS/otro
--      en runtime.

-- -----------------------------------------------
-- 1. Redefinir RPC get_sla_metrics
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
      AND purchase_type NOT IN ('transferencias_saas', 'otro')
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
      AND purchase_type NOT IN ('transferencias_saas', 'otro')
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
-- 2. Recrear indice parcial alineado con el nuevo filtro
-- -----------------------------------------------

DROP INDEX IF EXISTS idx_orders_active_sla;
CREATE INDEX idx_orders_active_sla
  ON public.orders (created_at)
  WHERE status NOT IN ('completado', 'bloqueado')
    AND purchase_type NOT IN ('transferencias_saas', 'otro');
