-- =============================================================
-- TIPSA Integration — Campos nuevos en orders + tabla shipping_events
-- Migration: 20260421000001_add_tipsa_fields
-- Principio: aditiva pura. Nada se modifica/elimina.
-- =============================================================

-- -----------------------------------------------
-- 1. Ampliar orders con metadatos del transportista
-- Todos IF NOT EXISTS para ser idempotente.
-- -----------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS carrier                  TEXT,
  ADD COLUMN IF NOT EXISTS carrier_service_code     TEXT,
  ADD COLUMN IF NOT EXISTS carrier_guid             TEXT,
  ADD COLUMN IF NOT EXISTS shipping_weight_kg       NUMERIC(10, 3),
  ADD COLUMN IF NOT EXISTS shipping_packages        INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shipping_content         TEXT,
  ADD COLUMN IF NOT EXISTS shipping_observations    TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_public_url      TEXT,
  ADD COLUMN IF NOT EXISTS tracking_last_status     TEXT,
  ADD COLUMN IF NOT EXISTS tracking_last_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.carrier                  IS 'Codigo transportista: tipsa | otros';
COMMENT ON COLUMN public.orders.carrier_service_code     IS 'Codigo servicio TIPSA (48=24h, 10=48h, 52=sabado...)';
COMMENT ON COLUMN public.orders.carrier_guid             IS 'GUID TIPSA strGuidOut (para URL publica de seguimiento)';
COMMENT ON COLUMN public.orders.shipped_at               IS 'Fecha y hora en que se creo el envio TIPSA (distinto de delivered_at)';
COMMENT ON COLUMN public.orders.tracking_public_url      IS 'URL publica TIPSA para seguimiento por el destinatario';
COMMENT ON COLUMN public.orders.tracking_last_status     IS 'Ultimo codigo de estado TIPSA (V_COD_TIPO_EST: 1=alta, 2=entregado, 3=incidencia, 4=transito)';
COMMENT ON COLUMN public.orders.tracking_last_checked_at IS 'Ultima vez que el cron verifico estado TIPSA';

-- -----------------------------------------------
-- 2. Indice para el cron de polling (filtra activos con tracking)
-- -----------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_carrier_tracking
  ON public.orders (tracking_last_checked_at NULLS FIRST)
  WHERE carrier IS NOT NULL
    AND tracking_number IS NOT NULL
    AND status NOT IN ('completado', 'bloqueado');

-- -----------------------------------------------
-- 3. Tabla shipping_events (timeline del transportista)
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.shipping_events (
  id           BIGSERIAL PRIMARY KEY,
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier      TEXT NOT NULL DEFAULT 'tipsa',
  event_code   TEXT NOT NULL,
  event_label  TEXT,
  event_date   TIMESTAMPTZ NOT NULL,
  raw_payload  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT shipping_events_unique_per_order UNIQUE (order_id, carrier, event_code, event_date)
);

COMMENT ON TABLE  public.shipping_events            IS 'Historial de eventos del transportista (TIPSA ConsEnvEstados)';
COMMENT ON COLUMN public.shipping_events.event_code IS 'Codigo V_COD_TIPO_EST devuelto por TIPSA (1,2,3,4...)';
COMMENT ON COLUMN public.shipping_events.raw_payload IS 'Payload original (JSONB) para auditoria/debug';

CREATE INDEX IF NOT EXISTS idx_shipping_events_order_id ON public.shipping_events (order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_events_date     ON public.shipping_events (event_date DESC);

-- -----------------------------------------------
-- 4. RLS shipping_events
-- Mismo patron que status_history: herencia por FK + role check.
-- -----------------------------------------------

ALTER TABLE public.shipping_events ENABLE ROW LEVEL SECURITY;

-- creator: ver eventos de sus propios pedidos
DROP POLICY IF EXISTS "shipping_events: creator select own" ON public.shipping_events;
CREATE POLICY "shipping_events: creator select own"
  ON public.shipping_events FOR SELECT
  USING (
    public.get_my_role() = 'creator'
    AND order_id IN (
      SELECT id FROM public.orders WHERE created_by = auth.uid()
    )
  );

-- viewer: solo lectura global (mismo patron que otras tablas segun rol viewer)
DROP POLICY IF EXISTS "shipping_events: viewer select all" ON public.shipping_events;
CREATE POLICY "shipping_events: viewer select all"
  ON public.shipping_events FOR SELECT
  USING (public.get_my_role() = 'viewer');

-- hardware: acceso total
DROP POLICY IF EXISTS "shipping_events: hardware full" ON public.shipping_events;
CREATE POLICY "shipping_events: hardware full"
  ON public.shipping_events FOR ALL
  USING (public.get_my_role() = 'hardware');

-- manager: lectura global
DROP POLICY IF EXISTS "shipping_events: manager read all" ON public.shipping_events;
CREATE POLICY "shipping_events: manager read all"
  ON public.shipping_events FOR SELECT
  USING (public.get_my_role() = 'manager');

-- admin: acceso total
DROP POLICY IF EXISTS "shipping_events: admin full" ON public.shipping_events;
CREATE POLICY "shipping_events: admin full"
  ON public.shipping_events FOR ALL
  USING (public.get_my_role() = 'admin');

-- -----------------------------------------------
-- 5. (Opcional) Realtime para shipping_events
-- Si ya hay orders en supabase_realtime, lo añadimos aqui tambien.
-- Protegido con DO block por si no existe la publicacion en este entorno.
-- -----------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.shipping_events;
    EXCEPTION
      WHEN duplicate_object THEN
        -- Ya estaba en la publicacion, ignorar
        NULL;
    END;
  END IF;
END $$;
