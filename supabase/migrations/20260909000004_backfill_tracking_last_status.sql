-- =============================================================================
-- Migracion: recalcular tracking_last_status desde shipping_events.
-- Fecha: 2026-09-09
-- Tipo: correctiva de datos, idempotente (re-ejecutarla no cambia nada mas).
--
-- POR QUE
-- Dos formas distintas de perder un "Entregado":
--
--   1. TIPSA emite el codigo 3 ("Incidencia") tambien para anotaciones
--      post-entrega del repartidor ("entregado al portero", "dejado en buzon").
--      Las filas escritas antes del fix d3fa583 guardaron ese 3 pisando al 2.
--
--   2. TIPSA emite codigos que no tenemos catalogados. En produccion aparece un
--      14 justo despues del 2 (albaran 0000012023, 08/09/2026). Como no es el
--      codigo 3, la regla antigua lo tomaba como estado oficial y degradaba un
--      envio entregado a "Estado 14".
--
-- En ambos casos salia en /tracking la barra completa hasta "Entregado" con un
-- badge contradictorio al lado.
--
-- QUE HACE
-- Recalcula la columna con la misma regla que resolveOfficialStatus() en
-- apps/web/lib/tipsa/services.ts:
--   1) si el envio tiene algun evento terminal (2 Entregado / 6 Devuelto), el
--      estado oficial es el ULTIMO de ellos — un envio no se des-entrega;
--   2) si no, el ultimo evento cronologico que no sea la anotacion 3.
-- Un envio con solo codigos 3 (incidencia real, sin entrega) no se toca: ambos
-- filter dejan code a NULL y el WHERE lo descarta.
--
-- No toca delivered_at: puede haberse puesto a mano y el cron ya lo rellena
-- cuando llega un evento terminal.
--
-- Verificacion (debe devolver 0 en ambas filas despues de aplicar):
--   with oficial as (
--     select order_id, shipment_id, coalesce(
--       (array_agg(event_code order by event_date desc)
--          filter (where event_code in ('2','6')))[1],
--       (array_agg(event_code order by event_date desc)
--          filter (where event_code <> '3'))[1]) as code
--     from shipping_events where carrier = 'tipsa' group by 1, 2)
--   select 'orders', count(*) from orders o join oficial x on x.order_id = o.id
--   where x.code is not null and o.tracking_last_status is distinct from x.code
--   union all
--   select 'shipments', count(*) from shipments s join oficial x on x.shipment_id = s.id
--   where x.code is not null and s.tracking_last_status is distinct from x.code;
-- =============================================================================

WITH oficial AS (
  SELECT
    e.order_id,
    e.shipment_id,
    COALESCE(
      (array_agg(e.event_code ORDER BY e.event_date DESC)
         FILTER (WHERE e.event_code IN ('2', '6')))[1],
      (array_agg(e.event_code ORDER BY e.event_date DESC)
         FILTER (WHERE e.event_code <> '3'))[1]
    ) AS code
  FROM public.shipping_events e
  WHERE e.carrier = 'tipsa'
  GROUP BY e.order_id, e.shipment_id
)
UPDATE public.orders o
SET tracking_last_status = x.code
FROM oficial x
WHERE x.order_id = o.id
  AND x.code IS NOT NULL
  AND o.tracking_last_status IS DISTINCT FROM x.code;

WITH oficial AS (
  SELECT
    e.order_id,
    e.shipment_id,
    COALESCE(
      (array_agg(e.event_code ORDER BY e.event_date DESC)
         FILTER (WHERE e.event_code IN ('2', '6')))[1],
      (array_agg(e.event_code ORDER BY e.event_date DESC)
         FILTER (WHERE e.event_code <> '3'))[1]
    ) AS code
  FROM public.shipping_events e
  WHERE e.carrier = 'tipsa'
  GROUP BY e.order_id, e.shipment_id
)
UPDATE public.shipments s
SET tracking_last_status = x.code
FROM oficial x
WHERE x.shipment_id = s.id
  AND x.code IS NOT NULL
  AND s.tracking_last_status IS DISTINCT FROM x.code;
