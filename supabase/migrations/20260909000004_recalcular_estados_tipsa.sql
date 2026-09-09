-- =============================================================================
-- Migracion: recalcular tracking_last_status y delivered_at desde shipping_events
--            usando el catalogo REAL de codigos TIPSA.
-- Fecha: 2026-09-09
-- Tipo: correctiva de datos. Idempotente (re-ejecutarla no cambia nada mas).
--
-- POR QUE
-- Nuestro mapa de codigos estaba corrido. El catalogo oficial ("Tabla de tipos
-- de estados", pag. 22 de docs/integrations/tipsa/extracted/Documentacion/
-- Documentacion WebServices 64.0_resumen_ES.pdf) dice:
--
--     0 DOCUMENTADO   1 TRANSITO    2 REPARTO    3 ENTREGADO   4 INCIDENCIA
--     5 DEVUELTO      7 RECANALIZADO   14 DISPONIBLE   15 ENTREGA PARCIAL
--
-- Nosotros leiamos 2 = "Entregado" y 3 = "Incidencia", justo al reves. Verificado
-- contra la web publica de TIPSA para el albaran 0000012023 (09/09/2026), donde
-- los seis eventos de la API encajan uno a uno con lo que muestra dinapaqweb.
--
-- Consecuencias en los datos guardados:
--   * tracking_last_status guarda estados con el significado equivocado.
--   * orders.delivered_at quedo pisado. Esa columna NO es de TIPSA: la gobierna
--     el trigger orders_auto_delivered_at (migracion 20260414000002), que la
--     pone al pasar el pedido a 'completado', y de ahi comen las metricas de
--     SLA. El refresco de TIPSA escribia encima la fecha del codigo 2, o sea la
--     salida a reparto. Dos dueños para una columna.
--   * shipments.delivered_at si es de TIPSA (no tiene trigger) y guarda la
--     fecha del reparto en vez de la de la entrega.
--
-- QUE HACE
--   1. Reasigna a codigo 0 los eventos de alta que escribimos nosotros.
--   2. tracking_last_status = estado oficial, con la regla de resolveOfficialStatus()
--      (apps/web/lib/tipsa/services.ts): si hay evento terminal (3 ENTREGADO /
--      5 DEVUELTO) el ultimo de ellos; si no, el ultimo evento cronologico.
--   3. shipments.delivered_at = fecha del evento 3, NULL si nunca se entrego.
--   4. Devuelve orders.delivered_at a su dueño: lo reconstruye desde
--      status_history para los pedidos 'completado' cuyo valor coincide con un
--      evento TIPSA (señal de que lo piso el refresco). El resto no se toca.
--   5. Reescribe las event_label congeladas con el mapa viejo.
--
-- Solo toca filas con eventos TIPSA. Un envio sin eventos se queda como esta.
--
-- Verificacion (las dos primeras filas deben dar 0 despues de aplicar):
--   with oficial as (
--     select order_id, shipment_id,
--       coalesce(
--         (array_agg(event_code order by event_date desc)
--            filter (where event_code in ('3','5')))[1],
--         (array_agg(event_code order by event_date desc))[1]) as code
--     from shipping_events where carrier = 'tipsa' group by 1, 2)
--   select 'orders desfasadas', count(*) from orders o join oficial x on x.order_id = o.id
--     where o.tracking_last_status is distinct from x.code
--   union all
--   select 'shipments desfasadas', count(*) from shipments s join oficial x on x.shipment_id = s.id
--     where s.tracking_last_status is distinct from x.code
--   union all
--   select 'orders completado sin delivered_at', count(*) from orders
--     where status = 'completado' and delivered_at is null;
-- =============================================================================

-- --------------------------------------- 1. eventos sinteticos de alta ------
-- Al crear un envio escribimos nosotros un evento inicial para que la ficha no
-- salga vacia hasta el primer barrido del cron. Le poniamos codigo 1, que en el
-- catalogo oficial es TRANSITO: estabamos afirmando que un paquete iba en
-- camino cuando ni siquiera se habia recogido. Le corresponde el 0 DOCUMENTADO,
-- que es justo lo que emite TIPSA al dar de alta.
--
-- Se distinguen de los codigo 1 autenticos por el raw_payload: los nuestros lo
-- escribimos como {albaran, guid}, los de TIPSA traen los atributos del SOAP
-- (V_COD_TIPO_EST, V_COD_AGE_ALTA...). De ahi el `? 'guid'`.
UPDATE public.shipping_events
SET event_code = '0'
WHERE carrier = 'tipsa'
  AND event_code = '1'
  AND raw_payload ? 'guid';

-- ------------------------------ 2. orders: SOLO tracking_last_status --------
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

-- ------------- 2b. devolver orders.delivered_at a su dueño ------------------
-- Un delivered_at que coincide EXACTAMENTE con la fecha de un evento TIPSA del
-- propio pedido lo escribio el refresco de tracking, no el trigger: el trigger
-- usa now() al cambiar de estado, que no cae al segundo en un evento del
-- transportista. Esos son los que reconstruimos desde status_history, igual que
-- hizo la migracion 20260414000002. Los demas no se tocan.
--
-- El trigger orders_auto_delivered_at solo actua cuando cambia `status`, y aqui
-- no lo tocamos, asi que no hace falta desactivarlo.
UPDATE public.orders o
SET delivered_at = COALESCE(
  (SELECT sh.changed_at FROM public.status_history sh
   WHERE sh.order_id = o.id AND sh.to_status = 'completado'
   ORDER BY sh.changed_at DESC LIMIT 1),
  o.updated_at
)
WHERE o.status = 'completado'
  AND o.delivered_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.shipping_events e
    WHERE e.order_id = o.id
      AND e.carrier = 'tipsa'
      AND e.event_date = o.delivered_at
  );

-- Un pedido que TIPSA marco como entregado sin estar 'completado' tenia
-- delivered_at puesto por el refresco y nada que lo justifique: se limpia.
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

-- ---------------------------------------------------- 3. shipments ----------
WITH oficial AS (
  SELECT
    e.shipment_id,
    COALESCE(
      (array_agg(e.event_code ORDER BY e.event_date DESC)
         FILTER (WHERE e.event_code IN ('3', '5')))[1],
      (array_agg(e.event_code ORDER BY e.event_date DESC))[1]
    ) AS code,
    (array_agg(e.event_date ORDER BY e.event_date DESC)
       FILTER (WHERE e.event_code = '3'))[1] AS entregado_en
  FROM public.shipping_events e
  WHERE e.carrier = 'tipsa' AND e.shipment_id IS NOT NULL
  GROUP BY e.shipment_id
)
UPDATE public.shipments s
SET
  tracking_last_status = x.code,
  delivered_at = x.entregado_en
FROM oficial x
WHERE x.shipment_id = s.id
  AND (
    s.tracking_last_status IS DISTINCT FROM x.code
    OR s.delivered_at IS DISTINCT FROM x.entregado_en
  );

-- ------------------------------- 4. etiquetas de eventos guardadas ----------
-- event_label se congelo al insertar cada fila, con el mapa equivocado
-- ("Entregado" en codigos 2, "Incidencia" en codigos 3...). La UI ya recalcula
-- siempre desde event_code, pero dejamos la columna coherente para no confundir
-- a quien consulte la tabla a pelo.
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
