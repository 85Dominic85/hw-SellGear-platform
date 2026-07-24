-- =============================================================
-- Añadir dos productos al catálogo:
--
--   1. tablet-kds-lenovo (accessory, 199 € s/IVA)
--      Producto físico normal. Tile en el catálogo, +Añadir como
--      cualquier otro accesorio.
--
--   2. implementacion-pro (accessory, precio libre)
--      Servicio con precio negociado por el AE. Se muestra como
--      tile normal en el catálogo (filtro "Accesorios"). Al añadirlo
--      al carrito, la app pide el precio (patrón "precio libre",
--      extensión por code='implementacion-pro' — sin categoría nueva
--      ni bloqueo de descuento).
--
-- Notas:
--   - products.category es TEXT sin CHECK, así que no hace falta
--     ALTER TYPE.
--
-- Aplicación manual en Supabase SQL Editor (CLAUDE.md).
-- =============================================================

INSERT INTO public.products (code, name, description, category, price_cents, package_count, sort_order)
VALUES
  (
    'tablet-kds-lenovo',
    'Tablet Lenovo Tab Plus',
    'Tablet Lenovo Tab Plus 11.5''. Ideal como visor de cocina o barra ligero.',
    'accessory',
    19900,
    1,
    450
  ),
  (
    'implementacion-pro',
    'Implementación Pro',
    'Servicio profesional: incluye página web, formación, códigos QR, posicionamiento y otros. Precio negociado por el AE.',
    'accessory',
    0,
    1,
    460
  )
ON CONFLICT (code) DO NOTHING;
