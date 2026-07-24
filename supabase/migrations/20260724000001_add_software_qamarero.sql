-- =============================================================
-- Añadir el producto "Software Qamarero" al catálogo.
--
-- Se muestra únicamente en pedidos con purchase_type =
-- transferencias_saas junto con Implementación Pro. En el resto de
-- tipos de compra queda oculto del catálogo (el filtro del wizard lo
-- excluye por code).
--
-- Patrón "precio libre" idéntico al de Implementación Pro:
--   - price_cents=0 obliga a introducir precio en el wizard.
--   - Sin descripción libre (el nombre "Software Qamarero" es fijo).
--   - Admite descuentos por línea (no bloqueado a 0).
--
-- Aplicación manual en Supabase SQL Editor.
-- =============================================================

INSERT INTO public.products (code, name, description, category, price_cents, package_count, sort_order)
VALUES
  (
    'software-qamarero',
    'Software Qamarero',
    'Licencia de software Qamarero facturada por transferencia. Precio negociado por el AE según el acuerdo con el cliente.',
    'accessory',
    0,
    1,
    470
  )
ON CONFLICT (code) DO NOTHING;
