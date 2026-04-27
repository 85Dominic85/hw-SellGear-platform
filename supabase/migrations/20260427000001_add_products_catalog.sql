-- =============================================================================
-- Catalogo de productos: tipos genericos por grado de calidad / funcionalidad
-- Migration: 20260427000001_add_products_catalog
-- Tipo: aditiva, idempotente.
-- Objetivo: convertir el formulario /orders/new a modo carrito. Las lineas
--           de pedido pasan a referenciar un product_id del catalogo en vez de
--           texto libre. Este es el catalogo maestro.
-- Reglas:
--   - Vendemos TIPOS de dispositivo, no marcas/modelos.
--   - Precios SIN IVA (price_cents en centimos). UI suma IVA segun vat_rate.
--   - Sin control de stock por ahora.
--   - package_count: bultos fisicos. Packs >= 2 (componentes), sueltos = 1.
--   - SKU especial 'otro' (category='custom', price=0): el AE puede introducir
--     descripcion y precio libres en el form para ventas fuera de catalogo.
--   - Catalogo gestionado via SQL/migration. No hay CRUD admin en MVP.
-- Fuente precios: docs/Catalogo Febrero 2026 (Qamarero).
-- =============================================================================

-- -----------------------------------------------
-- 1. Tabla products
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT         NOT NULL UNIQUE,
  name          TEXT         NOT NULL,
  description   TEXT,
  category      TEXT         NOT NULL,
  price_cents   INTEGER      NOT NULL CHECK (price_cents >= 0),
  vat_rate      NUMERIC(5,2) NOT NULL DEFAULT 21.00 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  package_count INTEGER      NOT NULL DEFAULT 1 CHECK (package_count >= 1),
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order    INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.products              IS 'Catalogo de productos. Tipos genericos por grado/funcionalidad, sin marcas ni modelos.';
COMMENT ON COLUMN public.products.code         IS 'Slug unico (ej: printer-wifi, pack-pro). Inmutable.';
COMMENT ON COLUMN public.products.category     IS 'pack | tpv | kds | printer | accessory | network | custom';
COMMENT ON COLUMN public.products.price_cents  IS 'Precio en centimos SIN IVA. La UI suma IVA. Para code=''otro'' = 0 (override en form).';
COMMENT ON COLUMN public.products.vat_rate     IS 'Porcentaje IVA aplicable (default 21).';
COMMENT ON COLUMN public.products.package_count IS 'Bultos fisicos. Productos sueltos = 1; packs >= 2. Pre-rellena TIPSA shipping_packages.';
COMMENT ON COLUMN public.products.active       IS 'Soft-delete: false oculta del selector pero conserva integridad referencial.';
COMMENT ON COLUMN public.products.sort_order   IS 'Orden visual en el selector (ascendente).';

CREATE INDEX IF NOT EXISTS idx_products_active_category
  ON public.products (active, category, sort_order);

-- -----------------------------------------------
-- 2. Trigger updated_at
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.products_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_set_updated_at();

-- -----------------------------------------------
-- 3. RLS: lectura para todos los autenticados, escritura solo admin/manager
-- -----------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products: authenticated read" ON public.products;
CREATE POLICY "products: authenticated read"
  ON public.products FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "products: admin full" ON public.products;
CREATE POLICY "products: admin full"
  ON public.products FOR ALL
  USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "products: manager full" ON public.products;
CREATE POLICY "products: manager full"
  ON public.products FOR ALL
  USING (public.get_my_role() = 'manager');

-- -----------------------------------------------
-- 4. Seed inicial (Catalogo Febrero 2026 oficial Qamarero)
-- Precios SIN IVA en centimos. ON CONFLICT DO NOTHING para idempotencia.
-- -----------------------------------------------
INSERT INTO public.products (code, name, description, category, price_cents, package_count, sort_order) VALUES
  -- Packs (combos hardware) — 3 bultos base (cajon + TPV + impresora); Pro/Premium = 4 (anaden 2a impresora)
  ('pack-esencial',          'Pack Esencial',         'Pack basico con conexion a internet por cable. Pantalla TPV 15'' Basica + Impresora LAN + Cajon.',                       'pack',       47000, 3,  10),
  ('pack-basic',             'Pack Basic',            'Solucion completa con conectividad WiFi. Pantalla TPV 15'' Estandar + Impresora LAN/WiFi + Cajon.',                       'pack',       75900, 3,  20),
  ('pack-pro',               'Pack Pro',              'Equipamiento avanzado con doble impresora (WiFi + LAN). Pantalla TPV 15'' Estandar + 2 impresoras + Cajon.',              'pack',       86900, 4,  30),
  ('pack-premium',           'Pack Premium',          'Maxima calidad con doble impresora WiFi. Pantalla TPV 15'' Premium + 2 impresoras WiFi + Cajon (router Flint incluido).', 'pack',      119900, 4,  40),

  -- TPV
  ('tpv-estandar',           'TPV Estandar',          'Terminal Punto de Venta 15.6'' FHD. 8GB RAM, 256GB SSD, Windows 11. Doble WiFi 2.4/5GHz + BT.',                          'tpv',        62700, 1, 100),

  -- KDS (cocina display)
  ('kds-estandar',           'KDS Estandar',          'Pantalla cocina 21,5'' Full HD. Intel J6412, 8GB+128GB. WiFi+BT+LAN. IP65.',                                              'kds',        69300, 1, 200),
  ('kds-pro',                'KDS Pro',               'Pantalla cocina 21,5'' Full HD. Intel i5-8250U 3.40GHz, 8GB+128GB, 350 Nits. WiFi+BT+LAN. IP65.',                        'kds',        96300, 1, 210),
  ('kds-premium',            'KDS Premium',           'Pantalla cocina 21,5'' Full HD. Intel J6412+TPM 2.0, 8GB DDR4+128GB M.2, 500 Nits. LAN. IP54.',                          'kds',       138300, 1, 220),

  -- Impresoras (4 modelos del catalogo)
  ('printer-cable',          'Impresora Cable',       'Termica 80mm. USB+ETHERNET. Corte automatico. Compatible Windows.',                                                       'printer',     8360, 1, 300),
  ('printer-wifi',           'Impresora WiFi',        'Termica 80mm. WiFi 2.4GHz + USB/ETHERNET. Corte automatico. Compatible Windows.',                                         'printer',    13640, 1, 310),
  ('printer-tp808-wifi',     'Impresora TP808 WiFi',  'Termica 80mm. WiFi 2.4GHz. Sin cartuchos. Funcion ahorro. Compatible Windows y Android.',                                 'printer',    17600, 1, 320),
  ('printer-cocina-usb-lan', 'Impresora Cocina USB/LAN','Termica para cocina. USB+LAN. Tapa antisuciedad. Alarma sonora/visual. No WiFi.',                                       'printer',    12000, 1, 330),

  -- Perifericos
  ('cajon',                  'Cajon Portamonedas',    'Cajon automatico cash 41x41cm. 4 billeteros + 8 monederos. Conexion RJ11. Estructura metalica.',                          'accessory',   4290, 1, 400),

  -- Enrutadores
  ('router-flint',           'Enrutador FLINT',       'Gran alcance. Alta compatibilidad con multiples impresoras WiFi. Negocios tamano medio.',                                 'network',    15000, 1, 500),
  ('router-opal',            'Enrutador OPAL',        'Alcance optimizado para espacios pequenos. Aisla operativa de dispositivos. Locales pequenos.',                           'network',     8500, 1, 510),

  -- SKU especial: ventas fuera de catalogo (descripcion y precio libres en el form)
  ('otro',                   'Otro (fuera de catalogo)','Producto puntual fuera del catalogo oficial. Descripcion y precio libres introducidos por el AE en el formulario.',    'custom',         0, 1, 9000)

ON CONFLICT (code) DO NOTHING;
