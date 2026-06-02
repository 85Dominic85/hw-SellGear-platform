-- =============================================================
-- Función RPC: get_requesters_ranking()
-- Top 20 solicitantes por unidades de equipos físicos vendidos en
-- el periodo. Agrupa por LOWER(TRIM(requester_email)) para evitar
-- duplicados tipográficos. Excluye líneas con categoría
-- 'saas_hardware' (combos SaaS comerciales, no equipos físicos).
--
-- Consumida por /metrics (MetricsDashboard) — sección "Quién vende
-- más" con podium de top 3 + tabla rest 4-20.
--
-- Seguridad:
--   - SECURITY DEFINER (los caller son admin/manager/hardware,
--     verificado en page.tsx y /api/metrics).
--   - REVOKE PUBLIC + GRANT authenticated.
--
-- Aplicación: copiar y ejecutar en Supabase SQL Editor del proyecto
-- principal (gbuifpsgcvxmuwzoyush). Per CLAUDE.md los archivos en
-- supabase/migrations/ son solo trazabilidad/CI.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_requesters_ranking(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_purchase_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  requester_email TEXT,
  requester_name TEXT,
  total_equipment_qty BIGINT,
  total_orders BIGINT,
  total_revenue NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH equipment_per_order AS (
    -- 1 fila por pedido: suma de qty de líneas que NO sean SaaS+Hardware.
    -- Filtros: solo pedidos con requester_email no vacío, dentro del
    -- periodo, y opcionalmente del purchase_type indicado.
    SELECT
      o.id AS order_id,
      o.requester_email,
      o.requester_name,
      o.amount,
      SUM(oi.qty)::BIGINT AS equipment_qty
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.products p ON p.id = oi.product_id
    WHERE o.requester_email IS NOT NULL
      AND TRIM(o.requester_email) <> ''
      AND o.created_at >= p_from
      AND o.created_at < p_to
      AND p.category <> 'saas_hardware'
      AND (p_purchase_type IS NULL OR o.purchase_type::TEXT = p_purchase_type)
    GROUP BY o.id, o.requester_email, o.requester_name, o.amount
  ),
  ranked_per_email AS (
    -- Para cada email normalizado, marcar cuál es el pedido más
    -- reciente (el name de ese pedido será el display de la persona).
    SELECT
      LOWER(TRIM(requester_email)) AS email_norm,
      requester_email,
      requester_name,
      order_id,
      amount,
      equipment_qty,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(TRIM(requester_email))
        ORDER BY order_id DESC
      ) AS recency_rank
    FROM equipment_per_order
  )
  SELECT
    MAX(requester_email) AS requester_email,
    MAX(CASE WHEN recency_rank = 1 THEN requester_name END) AS requester_name,
    SUM(equipment_qty)::BIGINT AS total_equipment_qty,
    COUNT(DISTINCT order_id)::BIGINT AS total_orders,
    COALESCE(SUM(amount), 0)::NUMERIC AS total_revenue
  FROM ranked_per_email
  GROUP BY email_norm
  ORDER BY total_equipment_qty DESC, total_orders DESC
  LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION public.get_requesters_ranking(
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_requesters_ranking(
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.get_requesters_ranking(
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) IS
  'Top 20 solicitantes por unidades de equipos físicos vendidos en el '
  'periodo. Agrupa por email normalizado, excluye saas_hardware, '
  'devuelve nombre del pedido más reciente como display.';
