-- =============================================================
-- Producto placeholder para ofertas SaaS + Hardware (precio libre).
--
-- Patron identico al actual code='otro': la UI activa inputs de
-- descripcion y precio cuando product.category = 'saas_hardware' o
-- product.code = 'saas_hardware'. El servidor exige los overrides y
-- los snapshotea en order_items.
--
-- NOTA: products.category es TEXT (no ENUM) y no tiene CHECK
-- constraint sobre los valores permitidos, por lo que NO hace falta
-- ALTER TYPE ni ALTER TABLE. Solo este INSERT.
--
-- Reglas de negocio asociadas (aplicadas en codigo):
--   * discount_pct debe ser 0 (sin descuento — el precio negociado
--     ES el precio final).
--   * vat_rate sigue la regla global: 21 % por defecto, 7 % (IGIC)
--     si shipping_cp empieza por 35 o 38 (Canarias).
-- =============================================================

INSERT INTO products (code, name, category, price_cents, vat_rate, active)
VALUES (
  'saas_hardware',
  'SaaS + Hardware (oferta personalizada)',
  'saas_hardware',
  0,
  21,
  true
)
ON CONFLICT (code) DO NOTHING;
