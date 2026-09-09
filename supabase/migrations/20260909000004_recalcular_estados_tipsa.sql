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

-- ------------------------------------------- 0. red de seguridad ------------
-- Guardamos los valores de antes por si hay que volver atras. `IF NOT EXISTS`
-- hace que una segunda ejecucion NO pise el snapshot: lo que queda guardado es
-- siempre el estado original, que es justo lo que se quiere para restaurar.
--
-- RLS activado sin ninguna policy: Supabase expone el esquema public por
-- PostgREST, y estas tablas llevan datos de pedidos. Sin policies nadie las lee
-- salvo el service_role, que se salta RLS.
--
-- Para restaurar (solo si algo sale mal):
--   UPDATE public.orders o SET tracking_last_status = b.tracking_last_status,
--                              delivered_at = b.delivered_at
--     FROM public._bk_tipsa_20260909_orders b WHERE b.id = o.id;
--   UPDATE public.shipments s SET tracking_last_status = b.tracking_last_status,
--                                 delivered_at = b.delivered_at
--     FROM public._bk_tipsa_20260909_shipments b WHERE b.id = s.id;
--   UPDATE public.shipping_events e SET event_code = b.event_code,
--                                       event_label = b.event_label
--     FROM public._bk_tipsa_20260909_events b WHERE b.id = e.id;
--
-- Cuando el cambio lleve unos dias asentado se pueden borrar las tres tablas.

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

-- ----------------------------- 0b. congelar updated_at ---------------------
-- orders tiene TRES triggers de UPDATE, no uno. Ademas de
-- orders_auto_delivered_at esta `orders_updated_at` (20260219000001:166), un
-- BEFORE UPDATE que hace NEW.updated_at = now() en CUALQUIER update, mire o no
-- el status. Igual en shipments (20260505000004:85).
--
-- Sin desactivarlos, esta migracion pisaria el updated_at de practicamente
-- todas las filas con eventos TIPSA — el mapa estaba corrido, asi que casi
-- todas cambian de valor. Y eso rompe dos cosas:
--
--   * SlaIndicator (components/orders/SlaIndicator.tsx) usa updated_at como
--     aproximacion de "cuando se bloqueo el pedido". Un pedido bloqueado hace
--     6 dias pasaria a mostrar "90d — Pausado". No se puede recuperar desde
--     updated_at: habria que reconstruirlo de status_history.
--   * OrderDetailFields lo muestra como "ultima modificacion": cientos de
--     pedidos apareceriann tocados hoy sin que nadie los haya tocado.
--
-- updated_at es el unico dato de esta migracion que no vive en ningun otro
-- sitio. Mismo patron que uso la migracion 20260414000002 (lineas 16 y 45).
-- Requiere ser owner de la tabla: en el SQL Editor de Supabase con el rol
-- postgres lo es.
ALTER TABLE public.orders    DISABLE TRIGGER orders_updated_at;
ALTER TABLE public.shipments DISABLE TRIGGER shipments_updated_at;

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
-- Sin COALESCE a updated_at. La migracion 20260414000002 uso ese fallback, pero
-- alli era seguro; aqui updated_at es un valor volatil y ademas el objetivo es
-- reparar, no inventar. Si un pedido completado no tiene rastro en
-- status_history (importados, migrados por caminos antiguos), lo dejamos como
-- esta: es preferible un delivered_at sospechoso a una fecha fabricada que se
-- cuele en get_sla_metrics como una entrega de hoy con delivery_days enorme.
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
  -- lo escribio el refresco de TIPSA, no el trigger
  AND EXISTS (
    SELECT 1 FROM public.shipping_events e
    WHERE e.order_id = o.id
      AND e.carrier = 'tipsa'
      AND e.event_date = o.delivered_at
  )
  -- y tenemos de donde reconstruirlo
  AND EXISTS (
    SELECT 1 FROM public.status_history h
    WHERE h.order_id = o.id AND h.to_status = 'completado'
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
    -- Terminal, no solo entregado: {3,5}, lo mismo que escribe el cron
    -- (isTerminalEvent en api/cron/tipsa-refresh). Si aqui usaramos solo el 3,
    -- un envio devuelto quedaria con delivered_at NULL hasta que pasara el
    -- barrido y se lo volviera a poner — la columna significaria una cosa antes
    -- del cron y otra despues.
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

-- ------- 3b. shipments.status auto-sincronizado mal: NO se toca aqui --------
-- El boton "Actualizar" de la ficha de un envio libre (api/shipments/[id]/
-- refresh-tracking) traducia el codigo TIPSA al estado de negocio con el mapa
-- viejo, y dejaba constancia en status_history. Escribio 'entregado' donde
-- tocaba 'en_curso' (codigo 2 = REPARTO) y 'incidencia' donde tocaba
-- 'entregado' (codigo 3).
--
-- shipments.status NO se corrige por migracion a proposito: es estado de
-- negocio, una persona puede haberlo revisado despues, y 'entregado' es casi
-- terminal en SHIPMENT_STATUS_TRANSITIONS. Reescribirlo en masa por inferencia
-- puede tapar trabajo humano. El codigo ya no volvera a escribir mal (ver el
-- remapeo en esa ruta); lo que quedo mal se revisa a mano con esta consulta:
--
--   SELECT s.shipment_id, s.status AS estado_actual, s.tracking_last_status,
--          h.comment, h.changed_at
--   FROM public.shipments s
--   JOIN public.status_history h ON h.shipment_id = s.id
--   WHERE h.comment LIKE 'Auto-sync desde TIPSA%'
--     AND h.shipment_to_status = s.status   -- nadie lo ha tocado despues
--   ORDER BY h.changed_at DESC;

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

-- ------------------------------------- 5. reactivar los triggers ------------
ALTER TABLE public.shipments ENABLE TRIGGER shipments_updated_at;
ALTER TABLE public.orders    ENABLE TRIGGER orders_updated_at;

-- ------------------------- 6. documentacion de la columna en la BD ----------
-- El COMMENT de la migracion 20260421000001 publica el mapa falso a quien mire
-- el esquema. Se corrige aqui para que no quede ninguna copia del mapa viejo.
COMMENT ON COLUMN public.orders.tracking_last_status IS
  'Codigo de estado TIPSA (V_COD_TIPO_EST). Catalogo oficial: 0 Documentado, '
  '1 En transito, 2 En reparto, 3 Entregado, 4 Incidencia, 5 Devuelto, '
  '6 Falta de expedicion, 7 Recanalizado, 14 Disponible para recoger, '
  '15 Entrega parcial. Terminales: 3 y 5. Fuente: pag. 22 de "Documentacion '
  'WebServices 64.0_resumen_ES.pdf". OJO: hasta 2026-09-09 el proyecto usaba un '
  'mapa deducido y equivocado en el que el 2 era "Entregado" y el 3 "Incidencia".';
