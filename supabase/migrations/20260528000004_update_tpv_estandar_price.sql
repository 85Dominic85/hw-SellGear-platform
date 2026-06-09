-- =============================================================
-- TPV Estandar (SYRION): 405 -> 420 EUR
-- Fuente: PDF oficial "Catalogo Hardware 2026 v1.4", pagina 9.
-- El precio 405 EUR se introdujo en la migracion 20260526000001 por
-- error de transcripcion; el catalogo oficial dice 420 EUR s/IVA.
--
-- Resto del catalogo verificado contra el PDF y sin cambios:
--   Pack Esencial 499, Pack Basic 759, Pack Pro 869, Pack Premium 1199
--   TPV PRO 627
--   KDS Estandar 693, KDS Pro 963, KDS Premium 1383
--   Impresora Cable 83,60 / WiFi 136,40 / TP808 176 / Cocina 120
--   Cajon 42,90, Router FLINT 150, Router OPAL 85
--
-- Financiacion verificada (Pack Pro 500/225/225, Pack Premium
-- 699/350/350, KDS Estandar 390/190/190) coincide con la actual en
-- apps/web/lib/financing.ts - no requiere cambio.
--
-- Pedidos historicos no se ven afectados: order_items.unit_price_cents
-- guarda snapshot inmutable. El UPDATE solo cambia el precio del
-- producto en el catalogo para pedidos NUEVOS.
--
-- Aplicacion: MANUAL en Supabase SQL Editor del proyecto principal
-- (gbuifpsgcvxmuwzoyush). Per CLAUDE.md los archivos en
-- supabase/migrations/ son solo trazabilidad/CI.
-- =============================================================

UPDATE public.products
   SET price_cents = 42000,
       updated_at  = NOW()
 WHERE code = 'tpv-estandar';

-- Verificacion:
-- SELECT code, name, price_cents
--   FROM public.products
--  WHERE code = 'tpv-estandar';
-- Esperado: tpv-estandar | TPV Estandar | 42000
