-- =============================================================
-- Reescritura de RPCs del dashboard de metricas
-- Migration: 20260430000002_rewrite_dashboard_metrics
-- =============================================================
--
-- 1. get_dashboard_metrics: arregla completed_rate (status='pagado'
--    legacy --> status='completado'), excluye 'bloqueado' del
--    denominador, y a~ade KPIs operativos (ops_*) que separan el
--    plazo de manipulacion del depto del plazo de transporte y
--    visibilizan throughput, bloqueados y excluidos del SLA fisico.
--
-- 2. get_dashboard_comparison: mismo fix de completed_rate y a~ade
--    prev_ops_* para alimentar deltas.
--
-- 3. idx_orders_shipped_at: indice parcial aditivo para shipped_at.
--
-- Aditiva: las funciones mantienen su firma actual
--   (TIMESTAMPTZ, TIMESTAMPTZ, TEXT DEFAULT NULL) RETURNS jsonb
-- y conservan todos los campos JSON existentes con la misma logica
-- (zona horaria 'Europe/Madrid' en orders_by_date, exclusion de
-- amount NULL/<=0 en avg_order_value, top 15 en by_product).
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_purchase_type text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    -- ============== EXISTENTES (preservados sin cambios) ==============
    'total_orders', (
      SELECT count(*)::int
      FROM public.orders o
      WHERE o.created_at >= p_from
        AND o.created_at <= p_to
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'total_revenue', (
      SELECT coalesce(sum(o.amount), 0)::numeric
      FROM public.orders o
      WHERE o.created_at >= p_from
        AND o.created_at <= p_to
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'avg_order_value', (
      SELECT coalesce(round(avg(o.amount)::numeric, 2), 0)
      FROM public.orders o
      WHERE o.created_at >= p_from
        AND o.created_at <= p_to
        AND o.amount IS NOT NULL
        AND o.amount > 0
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),

    -- ============== FIX: completed_rate (status='completado', sin bloqueados) ==============
    'completed_rate', (
      SELECT CASE
        WHEN count(*) FILTER (WHERE o.status <> 'bloqueado') = 0 THEN 0
        ELSE round(
          (count(*) FILTER (WHERE o.status = 'completado')::numeric
           / count(*) FILTER (WHERE o.status <> 'bloqueado')::numeric) * 100,
          1
        )
      END
      FROM public.orders o
      WHERE o.created_at >= p_from
        AND o.created_at <= p_to
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),

    'orders_by_date', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.date), '[]'::jsonb)
      FROM (
        SELECT
          (o.created_at AT TIME ZONE 'Europe/Madrid')::date::text AS date,
          count(*)::int AS count,
          coalesce(sum(o.amount), 0)::numeric AS revenue
        FROM public.orders o
        WHERE o.created_at >= p_from
          AND o.created_at <= p_to
          AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
        GROUP BY (o.created_at AT TIME ZONE 'Europe/Madrid')::date
        ORDER BY (o.created_at AT TIME ZONE 'Europe/Madrid')::date
      ) t
    ),
    'by_purchase_type', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
      FROM (
        SELECT
          coalesce(o.purchase_type::text, 'sin_tipo') AS purchase_type,
          count(*)::int AS count,
          coalesce(sum(o.amount), 0)::numeric AS revenue
        FROM public.orders o
        WHERE o.created_at >= p_from
          AND o.created_at <= p_to
          AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
        GROUP BY o.purchase_type
      ) t
    ),
    'by_status', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
      FROM (
        SELECT
          o.status::text AS status,
          count(*)::int AS count
        FROM public.orders o
        WHERE o.created_at >= p_from
          AND o.created_at <= p_to
          AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
        GROUP BY o.status
      ) t
    ),
    'by_product', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.total_qty DESC), '[]'::jsonb)
      FROM (
        SELECT
          oi.product_name,
          sum(oi.qty)::int AS total_qty,
          count(DISTINCT oi.order_id)::int AS order_count
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE o.created_at >= p_from
          AND o.created_at <= p_to
          AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
        GROUP BY oi.product_name
        ORDER BY sum(oi.qty) DESC
        LIMIT 15
      ) t
    ),

    -- ============== NUEVOS: KPIs operativos del departamento ==============
    'ops_total_shipped', (
      SELECT count(*)::int
      FROM public.orders o
      WHERE o.shipped_at IS NOT NULL
        AND o.shipped_at >= p_from
        AND o.shipped_at <= p_to
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'ops_total_completed', (
      SELECT count(*)::int
      FROM public.orders o
      WHERE o.status = 'completado'
        AND o.delivered_at IS NOT NULL
        AND o.delivered_at >= p_from
        AND o.delivered_at <= p_to
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'ops_avg_handling_days', (
      SELECT coalesce(
        round(avg(extract(epoch from (o.shipped_at - o.created_at)) / 86400.0)::numeric, 1),
        0
      )
      FROM public.orders o
      WHERE o.shipped_at IS NOT NULL
        AND o.shipped_at >= p_from
        AND o.shipped_at <= p_to
        AND o.purchase_type NOT IN ('transferencias_saas', 'otro')
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'ops_avg_transit_days', (
      SELECT coalesce(
        round(avg(extract(epoch from (o.delivered_at - o.shipped_at)) / 86400.0)::numeric, 1),
        0
      )
      FROM public.orders o
      WHERE o.shipped_at IS NOT NULL
        AND o.delivered_at IS NOT NULL
        AND o.delivered_at >= p_from
        AND o.delivered_at <= p_to
        AND o.purchase_type NOT IN ('transferencias_saas', 'otro')
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'ops_on_time_shipping_pct', (
      SELECT CASE
        WHEN count(*) = 0 THEN 0
        ELSE round(
          (count(*) FILTER (
            WHERE extract(epoch from (o.shipped_at - o.created_at)) / 86400.0 <= 5
          )::numeric / count(*)::numeric) * 100,
          1
        )
      END
      FROM public.orders o
      WHERE o.shipped_at IS NOT NULL
        AND o.shipped_at >= p_from
        AND o.shipped_at <= p_to
        AND o.purchase_type NOT IN ('transferencias_saas', 'otro')
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'ops_throughput_by_week', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'week_start', w.ws,
        'created',   coalesce(c.n, 0),
        'shipped',   coalesce(s.n, 0),
        'delivered', coalesce(d.n, 0)
      ) ORDER BY w.ws), '[]'::jsonb)
      FROM (
        SELECT date_trunc('week', gs)::date AS ws
        FROM generate_series(
          date_trunc('week', p_from),
          date_trunc('week', p_to),
          interval '1 week'
        ) gs
      ) w
      LEFT JOIN (
        SELECT date_trunc('week', o.created_at)::date AS w, count(*)::int AS n
        FROM public.orders o
        WHERE o.created_at >= p_from AND o.created_at <= p_to
          AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
        GROUP BY 1
      ) c ON c.w = w.ws
      LEFT JOIN (
        SELECT date_trunc('week', o.shipped_at)::date AS w, count(*)::int AS n
        FROM public.orders o
        WHERE o.shipped_at IS NOT NULL
          AND o.shipped_at >= p_from AND o.shipped_at <= p_to
          AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
        GROUP BY 1
      ) s ON s.w = w.ws
      LEFT JOIN (
        SELECT date_trunc('week', o.delivered_at)::date AS w, count(*)::int AS n
        FROM public.orders o
        WHERE o.status = 'completado'
          AND o.delivered_at IS NOT NULL
          AND o.delivered_at >= p_from AND o.delivered_at <= p_to
          AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
        GROUP BY 1
      ) d ON d.w = w.ws
    ),
    'ops_blocked_count', (
      -- Global del periodo: NO se filtra por p_purchase_type para conservar
      -- significado (un bloqueado fuera del filtro sigue siendo info util).
      SELECT count(*)::int
      FROM public.orders o
      WHERE o.status = 'bloqueado'
        AND o.created_at >= p_from
        AND o.created_at <= p_to
    ),
    'ops_excluded_admin', (
      -- Pedidos completados de tipos sin envio fisico (transparencia).
      SELECT count(*)::int
      FROM public.orders o
      WHERE o.status = 'completado'
        AND o.delivered_at IS NOT NULL
        AND o.delivered_at >= p_from
        AND o.delivered_at <= p_to
        AND o.purchase_type IN ('transferencias_saas', 'otro')
    )
  ) INTO result;

  RETURN result;
END;
$function$;


-- =============================================================
-- get_dashboard_comparison: mismo fix + prev_ops_*
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_comparison(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_purchase_type text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  duration_interval interval;
  prev_from timestamptz;
  prev_to timestamptz;
  result jsonb;
BEGIN
  duration_interval := p_to - p_from;
  prev_to := p_from - interval '1 second';
  prev_from := prev_to - duration_interval;

  SELECT jsonb_build_object(
    'prev_total_orders', (
      SELECT count(*)::int
      FROM public.orders o
      WHERE o.created_at >= prev_from
        AND o.created_at <= prev_to
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'prev_total_revenue', (
      SELECT coalesce(sum(o.amount), 0)::numeric
      FROM public.orders o
      WHERE o.created_at >= prev_from
        AND o.created_at <= prev_to
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'prev_avg_order_value', (
      SELECT coalesce(round(avg(o.amount)::numeric, 2), 0)
      FROM public.orders o
      WHERE o.created_at >= prev_from
        AND o.created_at <= prev_to
        AND o.amount IS NOT NULL
        AND o.amount > 0
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),

    -- FIX: status='completado', denominador sin 'bloqueado'
    'prev_completed_rate', (
      SELECT CASE
        WHEN count(*) FILTER (WHERE o.status <> 'bloqueado') = 0 THEN 0
        ELSE round(
          (count(*) FILTER (WHERE o.status = 'completado')::numeric
           / count(*) FILTER (WHERE o.status <> 'bloqueado')::numeric) * 100,
          1
        )
      END
      FROM public.orders o
      WHERE o.created_at >= prev_from
        AND o.created_at <= prev_to
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),

    -- NUEVOS prev_ops_*
    'prev_ops_total_shipped', (
      SELECT count(*)::int
      FROM public.orders o
      WHERE o.shipped_at IS NOT NULL
        AND o.shipped_at >= prev_from
        AND o.shipped_at <= prev_to
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'prev_ops_total_completed', (
      SELECT count(*)::int
      FROM public.orders o
      WHERE o.status = 'completado'
        AND o.delivered_at IS NOT NULL
        AND o.delivered_at >= prev_from
        AND o.delivered_at <= prev_to
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'prev_ops_avg_handling_days', (
      SELECT coalesce(
        round(avg(extract(epoch from (o.shipped_at - o.created_at)) / 86400.0)::numeric, 1),
        0
      )
      FROM public.orders o
      WHERE o.shipped_at IS NOT NULL
        AND o.shipped_at >= prev_from
        AND o.shipped_at <= prev_to
        AND o.purchase_type NOT IN ('transferencias_saas', 'otro')
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    ),
    'prev_ops_on_time_shipping_pct', (
      SELECT CASE
        WHEN count(*) = 0 THEN 0
        ELSE round(
          (count(*) FILTER (
            WHERE extract(epoch from (o.shipped_at - o.created_at)) / 86400.0 <= 5
          )::numeric / count(*)::numeric) * 100,
          1
        )
      END
      FROM public.orders o
      WHERE o.shipped_at IS NOT NULL
        AND o.shipped_at >= prev_from
        AND o.shipped_at <= prev_to
        AND o.purchase_type NOT IN ('transferencias_saas', 'otro')
        AND (p_purchase_type IS NULL OR o.purchase_type::text = p_purchase_type)
    )
  ) INTO result;

  RETURN result;
END;
$function$;


-- =============================================================
-- Indice parcial aditivo para shipped_at
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_orders_shipped_at
  ON public.orders (shipped_at)
  WHERE shipped_at IS NOT NULL;
