-- =============================================================
-- Catalogo Hardware Qamarero 2026: actualizacion de precios y
-- reestructuracion del TPV.
-- Migration: 20260526000001_update_catalog_2026
-- =============================================================
--
-- Cambios respecto al seed 20260427000001_add_products_catalog:
--
--   1. pack-esencial: 470 EUR -> 499 EUR. El catalogo 2026 ajusta
--      el precio del Pack Essential por +29 EUR.
--
--   2. El producto actual 'tpv-estandar' (627 EUR, Intel Celeron,
--      FHD, doble WiFi 2.4/5GHz, 8GB DDR4, 256GB SSD) corresponde
--      en realidad al "TPV PRO" del catalogo 2026. Se renombra a
--      code='tpv-pro' y name='TPV PRO' para alinear la realidad.
--
--   3. Se inserta el nuevo "TPV Estandar" basado en el modelo
--      SYRION (Intel i5-7300U, 8GB DDR3, 128GB SSD, 15'' LCD 4:3,
--      aluminio sin ventilacion) a 405 EUR.
--
-- Rationale:
--   - Pedidos historicos siguen funcionando porque order_items
--     referencia products por UUID (no por code). La UI antigua
--     mostrara "TPV PRO" en lugar de "TPV Estandar" para esos
--     pedidos, lo cual es una correccion: las specs siempre
--     correspondieron al PRO.
--
--   - Snapshot de precio en order_items.unit_price_cents no se ve
--     afectado por el UPDATE de products.price_cents.
--
-- Aplicacion: MANUAL en Supabase SQL Editor (CLAUDE.md - cambios
-- SQL siempre son manuales). Verificar despues con:
--   SELECT code, name, price_cents
--     FROM public.products
--    WHERE code IN ('pack-esencial', 'tpv-estandar', 'tpv-pro')
--    ORDER BY code;
--
-- Rollback manual si fuera necesario:
--   UPDATE products SET price_cents = 47000 WHERE code = 'pack-esencial';
--   DELETE FROM products WHERE code = 'tpv-estandar';
--   UPDATE products SET code = 'tpv-estandar', name = 'TPV Estandar', sort_order = 100 WHERE code = 'tpv-pro';
-- =============================================================

-- 1) Pack Esencial: 470 -> 499 EUR
UPDATE public.products
   SET price_cents = 49900,
       updated_at  = NOW()
 WHERE code = 'pack-esencial';

-- 2) Renombrar el actual tpv-estandar a tpv-pro (mismas specs,
--    mismo precio 627 EUR). Liberamos el code 'tpv-estandar'
--    para el nuevo modelo SYRION del catalogo 2026.
UPDATE public.products
   SET code        = 'tpv-pro',
       name        = 'TPV PRO',
       description = 'Terminal Punto de Venta 15.6'' FHD. Intel Celeron, 8GB DDR4, 256GB SSD, Windows 11. Doble WiFi 2.4/5GHz + BT 4.0. Gran almacenamiento.',
       sort_order  = 110,
       updated_at  = NOW()
 WHERE code = 'tpv-estandar';

-- 3) Insertar el nuevo TPV Estandar (modelo SYRION) a 405 EUR.
INSERT INTO public.products (code, name, description, category, price_cents, package_count, sort_order)
VALUES (
  'tpv-estandar',
  'TPV Estandar',
  'Terminal Punto de Venta 15'' LCD 4:3. Intel i5-7300U 2.60GHz, 8GB DDR3, 128GB SSD, Windows 10/11. Aleacion de aluminio sin ventilacion. Visor VFD/LCD opcional.',
  'tpv',
  40500,
  1,
  100
)
ON CONFLICT (code) DO NOTHING;
