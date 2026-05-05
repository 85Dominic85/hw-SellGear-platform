-- =============================================================
-- Producto: Picho Wifi (10 EUR) en categoria network
-- Migration: 20260505000001_add_picho_wifi_product
-- Tipo: aditiva, idempotente. Solo INSERT con ON CONFLICT.
-- =============================================================
--
-- Encaja entre Enrutador FLINT (sort_order=500) y Enrutador OPAL
-- (sort_order=510). Para no insertarlo en medio de routers existentes,
-- se coloca en sort_order=520 (despues de OPAL). Esto evita reorganizar
-- el orden de productos ya activos.

INSERT INTO public.products
  (code, name, description, category, price_cents, vat_rate, package_count, sort_order, active)
VALUES
  (
    'picho-wifi',
    'Picho Wifi',
    'Dispositivo de red Picho Wifi. Conectividad para entornos hosteleria.',
    'network',
    1000,         -- 10,00 EUR sin IVA (en centimos)
    21.00,        -- IVA estandar
    1,            -- 1 bulto
    520,          -- detras de router-opal (510)
    TRUE
  )
ON CONFLICT (code) DO NOTHING;

-- ROLLBACK manual:
--   DELETE FROM public.products WHERE code = 'picho-wifi';
-- Si ya hay order_items que lo referencien (FK), no se podra borrar; usar:
--   UPDATE public.products SET active = FALSE WHERE code = 'picho-wifi';
