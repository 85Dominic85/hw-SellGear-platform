-- =============================================================
-- Envios libres (shipments) + generalizacion shipping_events
-- Migration: 20260505000004_shipments_and_events_generalization
-- Tipo: aditiva. Tabla nueva + ALTER aditivo en shipping_events.
-- =============================================================
--
-- Permite crear etiquetas TIPSA sin estar atadas a un pedido. Casos:
--   * Cliente A -> Cliente B (envio entre clientes)
--   * Cliente A -> Nosotros (recogida de material)
-- shipping_events queda como tabla unica de eventos: cada fila apunta
-- O a un order_id O a un shipment_id (CHECK XOR). El insert del flujo
-- TIPSA actual (siempre con order_id) sigue funcionando identico.

-- -----------------------------------------------------------------
-- 1. Sequence + funcion generate_shipment_id (paralela a la de orders)
-- -----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS shipment_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_shipment_id()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  prefix TEXT;
  seq_val BIGINT;
BEGIN
  prefix := 'SH-' || TO_CHAR(NOW(), 'YYYYMM') || '-';
  seq_val := NEXTVAL('shipment_seq');
  RETURN prefix || LPAD(seq_val::TEXT, 4, '0');
END;
$$;

-- -----------------------------------------------------------------
-- 2. Tabla shipments
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id              TEXT UNIQUE NOT NULL DEFAULT public.generate_shipment_id(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID REFERENCES public.user_profiles(id),

  -- Sender (libre, NO toma de TIPSA_SENDER_*)
  sender_name              TEXT NOT NULL,
  sender_address           TEXT NOT NULL,
  sender_cp                TEXT NOT NULL CHECK (sender_cp ~ '^\d{5}$'),
  sender_city              TEXT NOT NULL,
  sender_phone             TEXT,

  -- Recipient
  recipient_name           TEXT NOT NULL,
  recipient_address        TEXT NOT NULL,
  recipient_cp             TEXT NOT NULL CHECK (recipient_cp ~ '^\d{5}$'),
  recipient_city           TEXT NOT NULL,
  recipient_phone          TEXT,
  recipient_email          TEXT,
  recipient_contact_person TEXT,

  -- Detalles envio
  service_code             TEXT NOT NULL,
  packages                 INT  NOT NULL DEFAULT 1 CHECK (packages >= 1),
  weight_kg                NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK (weight_kg > 0),
  content                  TEXT,
  observations             TEXT,
  return_shipment          BOOLEAN NOT NULL DEFAULT FALSE,
  reference                TEXT,

  -- TIPSA / tracking
  albaran                  TEXT,
  tracking_number          TEXT,
  tracking_public_url      TEXT,
  carrier_guid             TEXT,
  tracking_last_status     TEXT,
  tracking_last_checked_at TIMESTAMPTZ,
  shipped_at               TIMESTAMPTZ,
  delivered_at             TIMESTAMPTZ,
  shipping_label_url       TEXT,

  notes                    TEXT
);

COMMENT ON TABLE  public.shipments IS 'Envios TIPSA libres (sin order_id). Sender y recipient editables.';
COMMENT ON COLUMN public.shipments.shipment_id IS 'Formato SH-YYYYMM-NNNN. Generado automaticamente.';

-- Trigger updated_at (reutiliza public.set_updated_at)
DROP TRIGGER IF EXISTS shipments_updated_at ON public.shipments;
CREATE TRIGGER shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indices
CREATE INDEX IF NOT EXISTS idx_shipments_shipment_id      ON public.shipments (shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at       ON public.shipments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number  ON public.shipments (tracking_number)
  WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_recipient_cp     ON public.shipments (recipient_cp);
CREATE INDEX IF NOT EXISTS idx_shipments_status_polling
  ON public.shipments (tracking_last_checked_at NULLS FIRST)
  WHERE tracking_number IS NOT NULL AND delivered_at IS NULL;

-- -----------------------------------------------------------------
-- 3. RLS shipments
-- -----------------------------------------------------------------
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipments: hardware full"   ON public.shipments;
CREATE POLICY "shipments: hardware full"
  ON public.shipments FOR ALL
  USING (public.get_my_role() = 'hardware');

DROP POLICY IF EXISTS "shipments: admin full"      ON public.shipments;
CREATE POLICY "shipments: admin full"
  ON public.shipments FOR ALL
  USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "shipments: manager read"    ON public.shipments;
CREATE POLICY "shipments: manager read"
  ON public.shipments FOR SELECT
  USING (public.get_my_role() = 'manager');

DROP POLICY IF EXISTS "shipments: commercial read" ON public.shipments;
CREATE POLICY "shipments: commercial read"
  ON public.shipments FOR SELECT
  USING (public.get_my_role() = 'commercial');

DROP POLICY IF EXISTS "shipments: viewer read"     ON public.shipments;
CREATE POLICY "shipments: viewer read"
  ON public.shipments FOR SELECT
  USING (public.get_my_role() = 'viewer');

-- -----------------------------------------------------------------
-- 4. Generalizar shipping_events
-- -----------------------------------------------------------------

-- 4.a. order_id NOT NULL -> NULL
ALTER TABLE public.shipping_events
  ALTER COLUMN order_id DROP NOT NULL;

-- 4.b. nueva columna shipment_id
ALTER TABLE public.shipping_events
  ADD COLUMN IF NOT EXISTS shipment_id UUID
    REFERENCES public.shipments(id) ON DELETE CASCADE;

-- 4.c. CHECK XOR: exactamente uno de los dos rellenado
ALTER TABLE public.shipping_events
  DROP CONSTRAINT IF EXISTS shipping_events_target_xor;
ALTER TABLE public.shipping_events
  ADD  CONSTRAINT shipping_events_target_xor
  CHECK (
    (order_id IS NOT NULL)::int + (shipment_id IS NOT NULL)::int = 1
  );

-- 4.d. Unique parcial para shipments (el de orders ya existe)
DROP INDEX IF EXISTS shipping_events_unique_per_shipment;
CREATE UNIQUE INDEX shipping_events_unique_per_shipment
  ON public.shipping_events (shipment_id, carrier, event_code, event_date)
  WHERE shipment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_events_shipment_id
  ON public.shipping_events (shipment_id)
  WHERE shipment_id IS NOT NULL;

-- 4.e. RLS espejo: las policies existentes son por order_id; a~adimos
-- las de shipment_id. shipments ya tiene RLS de lectura abierto a los
-- 5 roles, asi que aqui replicamos: lectura para todos, escritura
-- solo hardware/admin (alta de eventos al crear envio o refresh).
DROP POLICY IF EXISTS "shipping_events: shipment read"   ON public.shipping_events;
CREATE POLICY "shipping_events: shipment read"
  ON public.shipping_events FOR SELECT
  USING (
    shipment_id IS NOT NULL
    AND public.get_my_role() IN ('hardware','admin','manager','commercial','viewer')
  );

DROP POLICY IF EXISTS "shipping_events: shipment write" ON public.shipping_events;
CREATE POLICY "shipping_events: shipment write"
  ON public.shipping_events FOR INSERT
  WITH CHECK (
    shipment_id IS NOT NULL
    AND public.get_my_role() IN ('hardware','admin')
  );

-- ROLLBACK manual:
--   DELETE FROM public.shipping_events WHERE shipment_id IS NOT NULL;
--   DROP POLICY IF EXISTS "shipping_events: shipment read"  ON public.shipping_events;
--   DROP POLICY IF EXISTS "shipping_events: shipment write" ON public.shipping_events;
--   DROP INDEX IF EXISTS shipping_events_unique_per_shipment;
--   DROP INDEX IF EXISTS idx_shipping_events_shipment_id;
--   ALTER TABLE public.shipping_events DROP CONSTRAINT IF EXISTS shipping_events_target_xor;
--   ALTER TABLE public.shipping_events DROP COLUMN IF EXISTS shipment_id;
--   -- Solo si NO quedan filas con order_id NULL:
--   -- SELECT COUNT(*) FROM public.shipping_events WHERE order_id IS NULL;
--   ALTER TABLE public.shipping_events ALTER COLUMN order_id SET NOT NULL;
--   DROP TABLE    IF EXISTS public.shipments;
--   DROP FUNCTION IF EXISTS public.generate_shipment_id();
--   DROP SEQUENCE IF EXISTS shipment_seq;
