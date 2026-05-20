-- =============================================================
-- SLA: excluir tambien 'saas_hardware' de las metricas fisicas
-- Migration: 20260520000003_sla_exclude_saas_hardware
-- =============================================================
--
-- Decision de negocio: las ofertas SaaS + Hardware se cierran como
-- contratos mixtos cuyo plazo de "completado" depende del onboarding
-- del software (puede tardar semanas), no del envio fisico del HW.
-- Por tanto se EXCLUYEN del SLA fisico igual que 'transferencias_saas'
-- y 'otro'. La parte HW asociada se gestiona via shipments (envios
-- independientes con su propio status).
--
-- Mantienen presencia en el resto de KPIs (total_orders, total_revenue,
-- breakdowns, etc.). Solo se quitan del calculo de SLA.
--
-- Cambios respecto a 20260430000001_sla_exclude_non_physical.sql:
--   1. CTE `delivered`: anadir 'saas_hardware' a la lista NOT IN.
--   2. CTE `at_risk`: idem.
--   3. Indice parcial `idx_orders_active_sla`: idem.
--
-- DEPENDENCIA: 20260520000002 (ALTER TYPE) debe ejecutarse PRIMERO.
-- =============================================================

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
      AND purchase_type NOT IN ('transferencias_saas', 'otro', 'saas_hardware')
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
      AND purchase_type NOT IN ('transferencias_saas', 'otro', 'saas_hardware')
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
    AND purchase_type NOT IN ('transferencias_saas', 'otro', 'saas_hardware');
