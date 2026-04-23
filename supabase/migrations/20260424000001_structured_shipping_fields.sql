-- =============================================================================
-- Migracion: campos estructurados de direccion + persona de contacto
-- Fecha: 2026-04-24
-- Tipo: aditiva, idempotente.
-- Objetivo: reemplazar el textarea libre shipping_address por 4 campos
--           separados (street / cp / city / province) + contact_person para
--           que el formulario /orders/new envie datos limpios a TIPSA sin
--           depender del parser regex.
--           Columnas NULLables: pedidos legacy y los que entran por Typeform
--           quedan intactos; el backend hace fallback a parseShippingAddress
--           si las 4 columnas nuevas estan vacias.
-- =============================================================================

-- 1. Columnas nuevas
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_street   TEXT,
  ADD COLUMN IF NOT EXISTS shipping_cp       TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city     TEXT,
  ADD COLUMN IF NOT EXISTS shipping_province TEXT,
  ADD COLUMN IF NOT EXISTS contact_person    TEXT;

-- 2. Validacion formato CP: 5 digitos exactos si se rellena (permite NULL)
--    Usa DO block para hacer ADD CONSTRAINT idempotente (Postgres no soporta IF NOT EXISTS en constraints).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_shipping_cp_format'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_shipping_cp_format
      CHECK (shipping_cp IS NULL OR shipping_cp ~ '^\d{5}$');
  END IF;
END $$;

-- 3. Comentarios para audit
COMMENT ON COLUMN public.orders.shipping_street   IS 'Calle + numero + piso/puerta. Separado de shipping_address (textarea legacy).';
COMMENT ON COLUMN public.orders.shipping_cp       IS 'Codigo postal 5 digitos. Validado por CHECK constraint.';
COMMENT ON COLUMN public.orders.shipping_city     IS 'Poblacion.';
COMMENT ON COLUMN public.orders.shipping_province IS 'Provincia (opcional). Ej: Sevilla, Madrid, A Coruna.';
COMMENT ON COLUMN public.orders.contact_person    IS 'Persona de contacto en el destino. Se envia a TIPSA como strPersContacto.';
