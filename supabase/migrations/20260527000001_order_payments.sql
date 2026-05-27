-- =============================================================
-- Plan de pagos por plazos para pedidos de financiación.
-- Migration: 20260527000001_order_payments
-- Tipo: aditiva. Tabla nueva, no altera orders ni order_items.
-- =============================================================
--
-- Los pedidos de tipo 'hardware_financiacion' se pagan en 3 plazos.
-- Cada pedido financiado genera 3 filas aquí (entrada + 2 plazos) al
-- crearse desde POST /api/orders. El equipo Hardware/Manager/Admin marca
-- cada plazo como pagado, con fecha y justificante de transferencia.
--
-- amount_base_cents : importe base s/IVA del plazo (del plan en lib/financing.ts).
-- amount_cents      : importe GROSS (lo que transfiere el cliente, base + IVA).
-- La suma de amount_cents de los 3 plazos coincide con orders.amount.
--
-- Aplicar MANUALMENTE en Supabase SQL Editor (CLAUDE.md: SQL siempre manual).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.order_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  installment_no    SMALLINT NOT NULL CHECK (installment_no BETWEEN 1 AND 3),
  amount_base_cents INTEGER NOT NULL CHECK (amount_base_cents >= 0),
  vat_rate          NUMERIC(5,2) NOT NULL DEFAULT 21 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  status            TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','pagado')),
  paid_at           TIMESTAMPTZ,
  receipt_url       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, installment_no)
);

COMMENT ON TABLE  public.order_payments              IS 'Plazos de pago de pedidos de financiación (3 por pedido).';
COMMENT ON COLUMN public.order_payments.amount_base_cents IS 'Importe base s/IVA del plazo (céntimos).';
COMMENT ON COLUMN public.order_payments.amount_cents      IS 'Importe gross (base + IVA) que transfiere el cliente.';
COMMENT ON COLUMN public.order_payments.status            IS 'pendiente | pagado.';
COMMENT ON COLUMN public.order_payments.receipt_url       IS 'URL del justificante de transferencia (bucket order-attachments).';

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id
  ON public.order_payments (order_id);

-- Trigger updated_at (reutiliza public.set_updated_at() de la migración inicial).
DROP TRIGGER IF EXISTS order_payments_updated_at ON public.order_payments;
CREATE TRIGGER order_payments_updated_at
  BEFORE UPDATE ON public.order_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado (el estado de pagos se ve en la
-- ficha del pedido y en el listado para todos los roles).
DROP POLICY IF EXISTS "order_payments: authenticated read" ON public.order_payments;
CREATE POLICY "order_payments: authenticated read"
  ON public.order_payments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Escritura: solo admin / manager / hardware (gestionan el cobro de plazos).
DROP POLICY IF EXISTS "order_payments: admin full" ON public.order_payments;
CREATE POLICY "order_payments: admin full"
  ON public.order_payments FOR ALL
  USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "order_payments: manager full" ON public.order_payments;
CREATE POLICY "order_payments: manager full"
  ON public.order_payments FOR ALL
  USING (public.get_my_role() = 'manager');

DROP POLICY IF EXISTS "order_payments: hardware full" ON public.order_payments;
CREATE POLICY "order_payments: hardware full"
  ON public.order_payments FOR ALL
  USING (public.get_my_role() = 'hardware');

-- NOTA: el INSERT desde POST /api/orders usa el service-role client
-- (createAdminClient), que bypasea RLS. Las políticas de arriba gobiernan
-- el acceso desde el cliente (PATCH del panel de pagos en la ficha).

-- ROLLBACK manual:
--   DROP TABLE IF EXISTS public.order_payments;
