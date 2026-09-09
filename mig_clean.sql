CREATE TABLE IF NOT EXISTS public._bk_tipsa_20260909_orders AS
  SELECT id, tracking_last_status, delivered_at, status, updated_at
  FROM public.orders
  WHERE carrier = 'tipsa';

CREATE TABLE IF NOT EXISTS public._bk_tipsa_20260909_shipments AS
  SELECT id, tracking_last_status, delivered_at
  FROM public.shipments;

CREATE TABLE IF NOT EXISTS public._bk_tipsa_20260909_events AS
  SELECT id, event_code, event_label
  FROM public.shipping_events
  WHERE carrier = 'tipsa';

ALTER TABLE public._bk_tipsa_20260909_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_tipsa_20260909_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_tipsa_20260909_events    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders    DISABLE TRIGGER orders_updated_at;
ALTER TABLE public.shipments DISABLE TRIGGER shipments_updated_at;

UPDATE public.shipping_events
SET event_code = '0'
WHERE carrier = 'tipsa'
  AND event_code = '1'
  AND jsonb_exists(raw_payload, 'guid');

WITH oficial AS (
  SELECT
    e.order_id,
    COALESCE(
      (array_agg(e.event_code ORDER BY e.event_date DESC)
         FILTER (WHERE e.event_code IN ('3', '5')))[1],
      (array_agg(e.event_code ORDER BY e.event_date DESC))[1]
    ) AS code
  FROM public.shipping_events e
  WHERE e.carrier = 'tipsa' AND e.order_id IS NOT NULL
  GROUP BY e.order_id
)
UPDATE public.orders o
SET tracking_last_status = x.code
FROM oficial x
WHERE x.order_id = o.id
  AND o.tracking_last_status IS DISTINCT FROM x.code;

UPDATE public.orders o
SET delivered_at = (
  SELECT h.changed_at
  FROM public.status_history h
  WHERE h.order_id = o.id AND h.to_status = 'completado'
  ORDER BY h.changed_at DESC
  LIMIT 1
)
WHERE o.status = 'completado'
  AND o.delivered_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.shipping_events e
    WHERE e.order_id = o.id
      AND e.carrier = 'tipsa'
      AND e.event_date = o.delivered_at
  )
  AND EXISTS (
    SELECT 1 FROM public.status_history h
    WHERE h.order_id = o.id AND h.to_status = 'completado'
  );

UPDATE public.orders o
SET delivered_at = NULL
WHERE o.status <> 'completado'
  AND o.delivered_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.shipping_events e
    WHERE e.order_id = o.id
      AND e.carrier = 'tipsa'
      AND e.event_date = o.delivered_at
  );

WITH oficial AS (
  SELECT
    e.shipment_id,
    COALESCE(
      (array_agg(e.event_code ORDER BY e.event_date DESC)
         FILTER (WHERE e.event_code IN ('3', '5')))[1],
      (array_agg(e.event_code ORDER BY e.event_date DESC))[1]
    ) AS code,
    (array_agg(e.event_date ORDER BY e.event_date DESC)
       FILTER (WHERE e.event_code IN ('3', '5')))[1] AS terminado_en
  FROM public.shipping_events e
  WHERE e.carrier = 'tipsa' AND e.shipment_id IS NOT NULL
  GROUP BY e.shipment_id
)
UPDATE public.shipments s
SET
  tracking_last_status = x.code,
  delivered_at = x.terminado_en
FROM oficial x
WHERE x.shipment_id = s.id
  AND (
    s.tracking_last_status IS DISTINCT FROM x.code
    OR s.delivered_at IS DISTINCT FROM x.terminado_en
  );

UPDATE public.shipping_events e
SET event_label = c.label
FROM (VALUES
  ('0',  'Documentado'),
  ('1',  'En tránsito'),
  ('2',  'En reparto'),
  ('3',  'Entregado'),
  ('4',  'Incidencia'),
  ('5',  'Devuelto'),
  ('6',  'Falta de expedición'),
  ('7',  'Recanalizado'),
  ('9',  'Falta de expedición administrativa'),
  ('10', 'Destruido'),
  ('11', 'Recogida'),
  ('12', 'Leída repartidor'),
  ('13', 'Leída'),
  ('14', 'Disponible para recoger'),
  ('15', 'Entrega parcial')
) AS c(code, label)
WHERE e.carrier = 'tipsa'
  AND e.event_code = c.code
  AND e.event_label IS DISTINCT FROM c.label;

ALTER TABLE public.shipments ENABLE TRIGGER shipments_updated_at;
ALTER TABLE public.orders    ENABLE TRIGGER orders_updated_at;

COMMENT ON COLUMN public.orders.tracking_last_status IS
  'Codigo de estado TIPSA (V_COD_TIPO_EST). Catalogo oficial: 0 Documentado, '
  '1 En transito, 2 En reparto, 3 Entregado, 4 Incidencia, 5 Devuelto, '
  '6 Falta de expedicion, 7 Recanalizado, 14 Disponible para recoger, '
  '15 Entrega parcial. Terminales: 3 y 5. Fuente: pag. 22 de "Documentacion '
  'WebServices 64.0_resumen_ES.pdf". OJO: hasta 2026-09-09 el proyecto usaba un '
  'mapa deducido y equivocado en el que el 2 era "Entregado" y el 3 "Incidencia".';