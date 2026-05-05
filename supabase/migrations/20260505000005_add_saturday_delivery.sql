-- =============================================================
-- TIPSA: a~adir flag boSabado (entrega en sabado)
-- Migration: 20260505000005_add_saturday_delivery
-- Tipo: aditiva pura. Columnas con DEFAULT FALSE en orders y shipments.
-- =============================================================
--
-- Segun WSDL TIPSA (WebServService___GrabaEnvio24, linea 2351),
-- boSabado es un xs:boolean obligatorio que se envia junto al envio.
-- No es un codigo de servicio: aplica como flag sobre cualquier
-- servicio del catalogo. Cuando true, TIPSA permite entrega en
-- sabado (con coste/disponibilidad segun zona y servicio).
--
-- Aditiva: campos opcionales con DEFAULT FALSE. Codigo legacy que
-- inserta sin estos campos sigue funcionando: el default cubre.

-- -----------------------------------------------------------------
-- 1. orders (envios atados a pedido)
-- -----------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_saturday BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.orders.shipping_saturday IS
  'TIPSA boSabado: si true, autoriza entrega en sabado para este envio.';

-- -----------------------------------------------------------------
-- 2. shipments (envios libres)
-- -----------------------------------------------------------------
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS saturday_delivery BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.shipments.saturday_delivery IS
  'TIPSA boSabado: si true, autoriza entrega en sabado para este envio.';

-- ROLLBACK manual:
--   ALTER TABLE public.orders     DROP COLUMN IF EXISTS shipping_saturday;
--   ALTER TABLE public.shipments  DROP COLUMN IF EXISTS saturday_delivery;
