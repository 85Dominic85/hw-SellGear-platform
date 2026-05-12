-- =============================================================
-- Shipments: estado manual + generalizar status_history
-- Migration: 20260512000001_shipments_manual_status
-- Tipo: aditiva. Enum nuevo + columna + generalizacion historial.
-- =============================================================
--
-- Permite que el equipo fije manualmente el estado de un envio libre
-- (independiente del tracking automatico de TIPSA). El estado manual
-- se prioriza en la columna "Estado" del listado; el tracking TIPSA
-- (tracking_last_status) sigue visible en la vista de detalle.
--
-- Tabla status_history se generaliza para aceptar tambien shipments:
--   * order_id NULL-able (XOR shipment_id).
--   * Nuevas columnas shipment_from_status / shipment_to_status para
--     el enum shipment_status (distinto al order_status existente).
--   * El insert del flujo de pedidos actual sigue rellenando order_id,
--     from_status y to_status como siempre.

-- -----------------------------------------------------------------
-- 1. Enum shipment_status (set reducido, especifico de envios)
-- -----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
    CREATE TYPE shipment_status AS ENUM (
      'pendiente',
      'en_curso',
      'entregado',
      'incidencia',
      'devuelto',
      'cancelado'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 2. Columna status en shipments + indice
-- -----------------------------------------------------------------
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS status shipment_status NOT NULL DEFAULT 'pendiente';

COMMENT ON COLUMN public.shipments.status IS
  'Estado manual fijado por el equipo. Independiente del tracking automatico TIPSA (tracking_last_status).';

CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments (status);

-- -----------------------------------------------------------------
-- 3. Generalizar status_history para aceptar shipment_id
-- -----------------------------------------------------------------

-- 3.a. order_id NOT NULL -> NULL (igual que hicimos con shipping_events)
ALTER TABLE public.status_history
  ALTER COLUMN order_id DROP NOT NULL;

-- 3.b. nueva columna shipment_id con FK
ALTER TABLE public.status_history
  ADD COLUMN IF NOT EXISTS shipment_id UUID
    REFERENCES public.shipments(id) ON DELETE CASCADE;

-- 3.c. nuevas columnas para el enum distinto de shipments
ALTER TABLE public.status_history
  ADD COLUMN IF NOT EXISTS shipment_from_status shipment_status;
ALTER TABLE public.status_history
  ADD COLUMN IF NOT EXISTS shipment_to_status shipment_status;

-- 3.d. CHECK XOR: exactamente uno (order_id o shipment_id)
ALTER TABLE public.status_history
  DROP CONSTRAINT IF EXISTS status_history_target_xor;
ALTER TABLE public.status_history
  ADD  CONSTRAINT status_history_target_xor
  CHECK (
    (order_id IS NOT NULL)::int + (shipment_id IS NOT NULL)::int = 1
  );

-- 3.e. CHECK coherencia: si order_id, deben venir from/to_status;
--      si shipment_id, deben venir shipment_from/to_status.
ALTER TABLE public.status_history
  DROP CONSTRAINT IF EXISTS status_history_target_columns;
ALTER TABLE public.status_history
  ADD  CONSTRAINT status_history_target_columns
  CHECK (
    (shipment_id IS NULL OR to_status IS NULL) AND
    (order_id IS NULL OR shipment_to_status IS NULL) AND
    (shipment_id IS NULL OR shipment_to_status IS NOT NULL) AND
    (order_id IS NULL OR to_status IS NOT NULL)
  );

-- 3.f. Indice para queries del historial de un shipment
CREATE INDEX IF NOT EXISTS idx_status_history_shipment_id
  ON public.status_history (shipment_id, changed_at DESC)
  WHERE shipment_id IS NOT NULL;

-- -----------------------------------------------------------------
-- 4. RLS para status_history con shipment_id
-- -----------------------------------------------------------------
-- Las policies existentes se basan en order_id (FK). A~adimos espejo
-- para shipment_id reusando la misma matriz de roles que shipments.

DROP POLICY IF EXISTS "status_history: shipment read" ON public.status_history;
CREATE POLICY "status_history: shipment read"
  ON public.status_history FOR SELECT
  USING (
    shipment_id IS NOT NULL
    AND public.get_my_role() IN ('hardware','admin','manager','commercial','viewer')
  );

DROP POLICY IF EXISTS "status_history: shipment write" ON public.status_history;
CREATE POLICY "status_history: shipment write"
  ON public.status_history FOR INSERT
  WITH CHECK (
    shipment_id IS NOT NULL
    AND public.get_my_role() IN ('hardware','admin')
  );

-- ROLLBACK manual:
--   DELETE FROM public.status_history WHERE shipment_id IS NOT NULL;
--   DROP POLICY IF EXISTS "status_history: shipment read"  ON public.status_history;
--   DROP POLICY IF EXISTS "status_history: shipment write" ON public.status_history;
--   DROP INDEX IF EXISTS public.idx_status_history_shipment_id;
--   ALTER TABLE public.status_history DROP CONSTRAINT IF EXISTS status_history_target_columns;
--   ALTER TABLE public.status_history DROP CONSTRAINT IF EXISTS status_history_target_xor;
--   ALTER TABLE public.status_history DROP COLUMN IF EXISTS shipment_to_status;
--   ALTER TABLE public.status_history DROP COLUMN IF EXISTS shipment_from_status;
--   ALTER TABLE public.status_history DROP COLUMN IF EXISTS shipment_id;
--   ALTER TABLE public.status_history ALTER COLUMN order_id SET NOT NULL;
--   DROP INDEX IF EXISTS public.idx_shipments_status;
--   ALTER TABLE public.shipments DROP COLUMN IF EXISTS status;
--   DROP TYPE IF EXISTS shipment_status;
