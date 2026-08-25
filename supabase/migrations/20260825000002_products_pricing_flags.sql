-- =============================================================
-- Servicios y SaaS: flags de precio declarativos + ficha propia.
--
-- Hace dos cosas que van juntas:
--
--  1) Puebla pricing_mode y allows_discount en los 4 SKU especiales. Hasta
--     ahora "este producto lleva precio negociado" no estaba en la BD, y el
--     predicado estaba replicado 9 veces por code en 7 ficheros del cliente
--     y del servidor. A partir de aquí el hecho vive en la fila.
--
--  2) Mueve implementacion-pro, software-qamarero y saas_hardware a la
--     categoría nueva 'service' (pestaña "Servicios y SaaS") y les escribe
--     una ficha, porque el catálogo web no los incluye: son productos
--     nuestros.
--
-- ORDEN DE APLICACIÓN — IMPORTANTE:
--   El refactor de código que lee allows_discount TIENE que estar
--   desplegado ANTES de aplicar esto. Hoy lib/orders-validation.ts fuerza
--   descuento 0 con `category === 'saas_hardware'`; en el momento en que
--   esa fila pase a category='service', esa comprobación deja de disparar y
--   SaaS + Hardware admitiría descuentos hasta que el código nuevo esté
--   arriba. El módulo lib/product-rules.ts lleva fallback por code para
--   tolerar los dos estados de la BD.
--
-- Requiere 20260825000001 aplicada.
-- Aplicación manual en Supabase SQL Editor.
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- Implementación Pro — servicio de puesta en marcha, precio a medida.
-- Admite descuento por línea (no está bloqueado a 0).
-- -------------------------------------------------------------
UPDATE public.products SET
    category      = 'service'
  , region        = 'peninsula'
  , pricing_mode  = 'free_price'
  , allows_discount = TRUE
  , sort_order    = 710
  , brand         = 'Qamarero'
  , badge         = 'A medida'
  , summary       = 'Puesta en marcha completa del local por el equipo de Qamarero, con el precio acordado con el cliente.'
  , ideal_for     = 'Aperturas y migraciones que necesitan que alguien deje el local funcionando, no solo el hardware en una caja.'
  , image_url     = '/products/implementacion-pro.svg'
  , highlights    = ARRAY[
        'Precio acordado con el cliente',
        'Incluye configuración y formación',
        'Puede incluir tablet KDS de regalo'
      ]::text[]
  , specifications = '[
        {"label": "Modalidad", "value": "Servicio profesional, no hardware"},
        {"label": "Precio",    "value": "A medida, lo introduce el AE en el pedido"},
        {"label": "Extras",    "value": "Al añadirlo, el wizard pregunta por la Tablet Lenovo Tab Plus como regalo"}
      ]'::jsonb
 WHERE code = 'implementacion-pro';

-- -------------------------------------------------------------
-- Software Qamarero — licencia facturada por transferencia.
-- El wizard solo lo ofrece en purchase_type = transferencias_saas.
-- -------------------------------------------------------------
UPDATE public.products SET
    category      = 'service'
  , region        = 'peninsula'
  , pricing_mode  = 'free_price'
  , allows_discount = TRUE
  , sort_order    = 720
  , brand         = 'Qamarero'
  , badge         = 'A medida'
  , summary       = 'Licencia de software Qamarero facturada por transferencia, con el precio acordado con el cliente.'
  , ideal_for     = 'Clientes que contratan solo software, sin envío de hardware.'
  , image_url     = '/products/software-qamarero.svg'
  , highlights    = ARRAY[
        'Precio acordado con el cliente',
        'Sin envío físico',
        'Solo en pedidos de transferencias SaaS'
      ]::text[]
  , specifications = '[
        {"label": "Modalidad",     "value": "Licencia de software"},
        {"label": "Precio",        "value": "A medida, lo introduce el AE en el pedido"},
        {"label": "Tipo de compra","value": "Solo transferencias SaaS"},
        {"label": "Envío",         "value": "No requiere envío ni dirección"}
      ]'::jsonb
 WHERE code = 'software-qamarero';

-- -------------------------------------------------------------
-- SaaS + Hardware — oferta mixta con precio cerrado negociado.
-- allows_discount = FALSE: el precio negociado ES el precio final, así que
-- un descuento encima no tiene sentido. Sustituye al hardcode
-- `category === 'saas_hardware'` de lib/orders-validation.ts.
-- Necesita además descripción libre (free_price_named).
-- -------------------------------------------------------------
UPDATE public.products SET
    category      = 'service'
  , region        = 'peninsula'
  , pricing_mode  = 'free_price_named'
  , allows_discount = FALSE
  , sort_order    = 730
  , brand         = 'Qamarero'
  , badge         = 'Oferta cerrada'
  , summary       = 'Oferta personalizada que combina software y hardware en un único precio cerrado.'
  , ideal_for     = 'Acuerdos a medida donde el paquete se negocia entero y no encaja en el catálogo estándar.'
  , image_url     = NULL
  , highlights    = ARRAY[
        'Descripción y precio libres',
        'Precio negociado = precio final',
        'No admite descuento por línea'
      ]::text[]
  , specifications = '[
        {"label": "Modalidad",   "value": "Oferta mixta software + hardware"},
        {"label": "Descripción", "value": "Libre, la escribe el AE en el pedido"},
        {"label": "Precio",      "value": "Cerrado y negociado; no admite descuento"}
      ]'::jsonb
 WHERE code = 'saas_hardware';

-- -------------------------------------------------------------
-- Otro (fuera de catálogo) — mecanismo de línea libre, NO es un producto.
-- Se queda en category='custom' y sin ficha: no debe salir como tarjeta en
-- /catalogo. Solo se alcanza por "Añadir línea libre" en el wizard y por la
-- pestaña "Línea libre" del modal de la ficha de pedido.
-- -------------------------------------------------------------
UPDATE public.products SET
    category        = 'custom'
  , region          = 'peninsula'
  , pricing_mode    = 'free_price_named'
  , allows_discount = TRUE
  , sort_order      = 9000
  , image_url       = NULL
 WHERE code = 'otro';

COMMIT;

-- -------------------------------------------------------------
-- Comprobaciones DESPUÉS de aplicar:
-- -------------------------------------------------------------
--   -- Los 4 especiales, y solo ellos, con pricing_mode != 'catalog'
--   SELECT code, category, pricing_mode, allows_discount, price_cents
--     FROM public.products
--    WHERE pricing_mode <> 'catalog'
--    ORDER BY sort_order;
--   -- esperado: implementacion-pro | software-qamarero | saas_hardware | otro
--
--   -- Ya no queda ninguna fila con la categoría vieja
--   SELECT count(*) FROM public.products WHERE category = 'saas_hardware';
--   -- esperado: 0
--
--   -- El CHECK products_free_price_zero_chk exige price_cents = 0 en los 4.
--   -- Si alguno tuviera precio, el UPDATE de arriba habría fallado.
