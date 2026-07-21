-- =============================================================
-- Ajuste manual del importe final del pedido (solo admin).
--
-- Se resta a orders.amount (total c/IVA) después de calcular todos
-- los descuentos por línea y el descuento global. NO recalcula el
-- IVA declarado (decisión de negocio: el ajuste es un "descuento
-- comercial" post-cálculo, con motivo auditable).
--
-- Columnas:
--   manual_adjustment_cents  INTEGER, siempre >= 0. Se resta al total.
--   manual_adjustment_reason TEXT, obligatorio cuando cents > 0.
--
-- Este archivo queda como trazabilidad. Aplicar manualmente en el
-- SQL Editor del proyecto principal (gbuifpsgcvxmuwzoyush).
-- =============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS manual_adjustment_cents INTEGER
    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_adjustment_reason TEXT;

-- CHECK: cents no negativo + si hay ajuste, motivo no vacío.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_manual_adjustment_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_manual_adjustment_check CHECK (
    manual_adjustment_cents >= 0
    AND (
      manual_adjustment_cents = 0
      OR (
        manual_adjustment_reason IS NOT NULL
        AND length(trim(manual_adjustment_reason)) > 0
      )
    )
  );

COMMENT ON COLUMN public.orders.manual_adjustment_cents IS
  'Ajuste manual (céntimos) que se RESTA al total c/IVA del pedido. Solo admin. Requiere motivo cuando > 0.';
COMMENT ON COLUMN public.orders.manual_adjustment_reason IS
  'Motivo obligatorio del ajuste manual. Obligatorio cuando manual_adjustment_cents > 0.';
