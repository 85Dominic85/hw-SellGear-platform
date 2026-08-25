-- =============================================================
-- Importación del catálogo comercial web 2026 a public.products.
--
-- Fuente: repo hw-qamarero-catalog, lib/catalog.ts (29 productos en 7
-- categorías). Este fichero está GENERADO por .tmp-catalog-sql.py a partir
-- de ese fuente; no editar a mano sin regenerar.
--
-- Qué hace:
--   * 17 UPDATE   -> las filas existentes reciben nombre del catálogo web,
--                    ficha comercial completa, imagen .webp y ejes nuevos.
--                    (Los 4 SKU de Servicios y SaaS se tratan en
--                    20260825000002, que es donde vive su ficha.)
--   * 13 INSERT   -> 5 productos peninsulares + 8 de Canarias.
--   *  1 retirada -> picho-wifi pasa a active = false (no está en el
--                    catálogo web y es hardware físico).
--   *  CHECK de category al final, cuando ya no hay valores fuera de lista.
--
-- Cambios de PRECIO (manda el catálogo web):
--   pack-basic     759,00 -> 539,00 EUR
--   kds-estandar   693,00 -> 549,00 EUR
--
-- OJO con kds-estandar: no solo cambia de precio, cambia de EQUIPO.
--   Actual : 10POS J6412, 8GB+128GB, IP65, Windows      (693 EUR)
--   Nuevo  : AIMV Android 14, RK3576, 4GB, sin IP       (549 EUR)
-- El J6412 IP65 sigue existiendo en el catálogo web, pero SOLO como SKU
-- canario (kds-canarias, 699 EUR finales). Es decir: esta migración
-- discontinúa de facto el KDS J6412 en península. Confirmar con producto
-- antes de aplicar.
--
-- Los pedidos históricos NO se alteran: order_items guarda snapshot
-- inmutable de product_name, unit_price_cents y vat_rate.
--
-- Requiere 20260825000001 y 20260825000002 aplicadas.
-- Aplicación manual en Supabase SQL Editor, DENTRO DE UNA TRANSACCIÓN.
-- =============================================================

-- Foto previa recomendada antes de ejecutar:
--   SELECT code, name, price_cents, category, active, sort_order
--     FROM public.products ORDER BY code;

BEGIN;

-- -------------------------------------------------------------
-- Packs
-- -------------------------------------------------------------

UPDATE public.products SET
    catalog_slug            = 'pack-essential'
  , name                    = 'Pack Essential'
  , category                = 'pack'
  , region                  = 'peninsula'
  , price_cents             = 49900
  , sort_order              = 110
  , brand                   = 'Qamarero'
  , model                   = NULL
  , badge                   = 'Popular'
  , summary                 = 'La forma más sencilla de empezar: TPV e impresora listos para trabajar.'
  , ideal_for               = 'Negocios pequeños que buscan una solución completa y económica.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/pack-esencial.webp'
  , highlights              = ARRAY['Pack con preconfiguración Qamarero (valorada en 100€)', 'TPV táctil 15,6"', 'Windows 11', 'Cable + adaptador WiFi']::text[]
  , components              = ARRAY['TPV XPOS 15,6"', 'Impresora USB/LAN', 'Cajón portamonedas', 'Adaptador USB WiFi cuando lo requiere el equipo']::text[]
  , specifications          = '[{"label": "Pantalla", "value": "Táctil XPOS 15,6\""}, {"label": "Procesador", "value": "Intel i5 · 8 GB RAM"}, {"label": "Conectividad", "value": "LAN + adaptador USB WiFi"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb
  , price_breakdown         = '[{"label": "Equipo del pack", "price_cents": 49900}, {"label": "Preconfiguración Qamarero", "price_cents": 10000}]'::jsonb
  , model_options           = NULL
 WHERE code = 'pack-esencial';

UPDATE public.products SET
    catalog_slug            = 'pack-basic'
  , name                    = 'Pack Basic'
  , category                = 'pack'
  , region                  = 'peninsula'
  , price_cents             = 53900
  , sort_order              = 120
  , brand                   = 'Qamarero'
  , model                   = NULL
  , badge                   = NULL
  , summary                 = 'Equipo completo con un TPV Standard Syrion, impresora LAN y cajón, configurados para empezar.'
  , ideal_for               = 'Restaurantes que buscan un único puesto estable, completo y fácil de poner en marcha.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/pack-basic.webp'
  , highlights              = ARRAY['Pack con preconfiguración Qamarero (valorada en 100€)', 'TPV Standard Syrion 15"', 'Impresora USB/LAN']::text[]
  , components              = ARRAY['TPV Standard Syrion', 'Impresora USB/LAN', 'Cajón portamonedas']::text[]
  , specifications          = '[{"label": "Pantalla", "value": "Táctil TPV Standard Syrion 15\""}, {"label": "Impresora", "value": "USB / LAN"}, {"label": "Conectividad", "value": "LAN + WiFi"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb
  , price_breakdown         = '[{"label": "TPV Standard Syrion", "price_cents": 42000}, {"label": "Impresora LAN", "price_cents": 8360}, {"label": "Cajón portamonedas", "price_cents": 4290}, {"label": "Preconfiguración Qamarero", "price_cents": 10000}]'::jsonb
  , model_options           = NULL
  , description             = 'Pack con TPV Standard Syrion 15'''' + Impresora USB/LAN + Cajon portamonedas, preconfigurado.'
 WHERE code = 'pack-basic';

UPDATE public.products SET
    catalog_slug            = 'pack-pro'
  , name                    = 'Pack Pro'
  , category                = 'pack'
  , region                  = 'peninsula'
  , price_cents             = 86900
  , sort_order              = 130
  , brand                   = 'Qamarero'
  , model                   = NULL
  , badge                   = 'Recomendado'
  , summary                 = 'Barra y cocina resueltas con un TPV Pro y dos impresoras ya configuradas.'
  , ideal_for               = 'Locales con barra y cocina separadas que necesitan doble impresión.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = 'Se envía Aqprox appTPV05 o 10POS según disponibilidad; ambos ofrecen prestaciones equivalentes dentro de la gama Pro.'
  , image_url               = '/products/pack-pro.webp'
  , highlights              = ARRAY['Pack con preconfiguración Qamarero (valorada en 100€)', 'TPV Pro 15,6"', 'Doble impresora', 'Router OPAL']::text[]
  , components              = ARRAY['TPV Pro', 'Impresora USB/LAN', 'Impresora WiFi adicional', 'Cajón portamonedas', 'Enrutador OPAL']::text[]
  , specifications          = '[{"label": "Pantalla", "value": "Táctil TPV Pro 15,6\""}, {"label": "Impresora 1", "value": "USB/WiFi"}, {"label": "Impresora 2", "value": "USB/LAN"}, {"label": "Enrutador", "value": "OPAL incluido"}, {"label": "Conectividad", "value": "LAN + WiFi"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb
  , price_breakdown         = '[{"label": "TPV Pro", "price_cents": 62700}, {"label": "Impresora LAN", "price_cents": 8360}, {"label": "Impresora WiFi", "price_cents": 13640}, {"label": "Cajón portamonedas", "price_cents": 4290}, {"label": "Enrutador OPAL", "price_cents": 8500}, {"label": "Preconfiguración Qamarero", "price_cents": 10000}]'::jsonb
  , model_options           = '[{"name": "Aqprox appTPV05", "image_url": "/products/models/tpv-pro-apptpv05.webp"}, {"name": "10POS", "image_url": "/products/models/tpv-pro-10pos.webp"}]'::jsonb
 WHERE code = 'pack-pro';

UPDATE public.products SET
    catalog_slug            = 'pack-premium'
  , name                    = 'Pack Premium'
  , category                = 'pack'
  , region                  = 'peninsula'
  , price_cents             = 119900
  , sort_order              = 140
  , brand                   = 'Qamarero'
  , model                   = NULL
  , badge                   = 'Premium'
  , summary                 = 'Solución de alta gama con doble impresora WiFi y router FLINT para una operativa más flexible.'
  , ideal_for               = 'Establecimientos que buscan autonomía WiFi y equipamiento de gama alta.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/pack-premium.webp'
  , highlights              = ARRAY['Pack con preconfiguración Qamarero (valorada en 100€)', 'TPV Premium 15"', 'Doble impresora WiFi', 'Router FLINT']::text[]
  , components              = ARRAY['TPV Premium', '2 impresoras WiFi', 'Cajón portamonedas', 'Enrutador FLINT']::text[]
  , specifications          = '[{"label": "Pantalla", "value": "TPV Premium 15\""}, {"label": "Impresoras", "value": "2 × WiFi"}, {"label": "Enrutador", "value": "FLINT incluido"}, {"label": "Conectividad", "value": "WiFi integrado"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb
  , price_breakdown         = '[{"label": "TPV Galia", "price_cents": 73700}, {"label": "Impresora WiFi", "price_cents": 13640, "quantity": 2}, {"label": "Cajón portamonedas", "price_cents": 4290}, {"label": "Enrutador FLINT", "price_cents": 15000}, {"label": "Preconfiguración Qamarero", "price_cents": 10000}]'::jsonb
  , model_options           = NULL
 WHERE code = 'pack-premium';

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'pack-cocina-digital',
    'pack-pro-kds',
    'Pack Cocina Digital',
    'La alternativa digital al Pack Pro: sustituye la impresora WiFi por una pantalla KDS Lenovo.',
    'pack',
    'peninsula',
    86900,
    150,
    'Qamarero',
    NULL,
    'Cocina digital',
    'La alternativa digital al Pack Pro: sustituye la impresora WiFi por una pantalla KDS Lenovo.',
    'Locales que quieren gestionar las comandas de cocina en pantalla en lugar de imprimirlas por WiFi.',
    'Mismo precio que el Pack Pro: la pantalla KDS Lenovo sustituye a la impresora WiFi.',
    NULL,
    'Se envía Aqprox appTPV05 o 10POS según disponibilidad; ambos ofrecen prestaciones equivalentes dentro de la gama Pro.',
    '/products/pack-cocina-digital.webp',
    ARRAY['Pack con preconfiguración Qamarero (valorada en 100€)', 'TPV Pro 15,6"', 'KDS Lenovo', 'Impresora USB/LAN']::text[],
    ARRAY['TPV Pro', 'Pantalla KDS Lenovo Tab Plus', 'Impresora USB/LAN', 'Cajón portamonedas']::text[],
    '[{"label": "Pantalla", "value": "Táctil TPV Pro 15,6\""}, {"label": "Cocina digital", "value": "Pantalla KDS Lenovo Tab Plus"}, {"label": "Impresora", "value": "USB / LAN"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb,
    '[{"label": "TPV Pro", "price_cents": 62700}, {"label": "Tablet KDS Lenovo", "price_cents": 19900}, {"label": "Impresora USB/LAN", "price_cents": 8360}, {"label": "Cajón portamonedas", "price_cents": 4290}, {"label": "Preconfiguración Qamarero", "price_cents": 10000}]'::jsonb,
    '[{"name": "Aqprox appTPV05", "image_url": "/products/models/tpv-pro-apptpv05.webp"}, {"name": "10POS", "image_url": "/products/models/tpv-pro-10pos.webp"}]'::jsonb,
    21,
    4,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------
-- TPV
-- -------------------------------------------------------------

UPDATE public.products SET
    catalog_slug            = 'tpv-standard'
  , name                    = 'TPV Standard'
  , category                = 'tpv'
  , region                  = 'peninsula'
  , price_cents             = 42000
  , sort_order              = 210
  , brand                   = 'Syrion'
  , model                   = NULL
  , badge                   = NULL
  , summary                 = 'Terminal compacto y estable, preparado para acompañar el servicio diario.'
  , ideal_for               = 'Negocios que priorizan fiabilidad, puertos y rendimiento equilibrado.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/tpv-estandar.webp'
  , highlights              = ARRAY['Intel Core i5', '8 GB RAM', 'Windows 11']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Procesador", "value": "Intel Core i5-7300U · hasta 3,50 GHz"}, {"label": "Memoria", "value": "8 GB DDR3"}, {"label": "Almacenamiento", "value": "128 GB M.2 SSD"}, {"label": "Pantalla", "value": "15\" · 1024 × 768 · táctil capacitivo"}, {"label": "Conectividad", "value": "6 USB · 2 DB9 · Gigabit Ethernet · HDMI · WiFi"}, {"label": "Montaje", "value": "VESA 100 × 100"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'tpv-estandar';

UPDATE public.products SET
    catalog_slug            = 'tpv-pro'
  , name                    = 'TPV Pro'
  , category                = 'tpv'
  , region                  = 'peninsula'
  , price_cents             = 62700
  , sort_order              = 220
  , brand                   = '10POS / Aqprox'
  , model                   = NULL
  , badge                   = 'Gama superior'
  , summary                 = 'Pantalla Full HD, doble WiFi y más almacenamiento para servicios exigentes.'
  , ideal_for               = 'Locales con delivery, varias zonas y un uso intensivo del terminal.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = 'Se envía Aqprox appTPV05 o 10POS según disponibilidad; ambos ofrecen prestaciones equivalentes dentro de la gama Pro.'
  , image_url               = '/products/tpv-pro.webp'
  , highlights              = ARRAY['15,6" Full HD', '256 GB SSD', 'WiFi dual + Bluetooth']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Procesador", "value": "Intel Celeron"}, {"label": "Memoria", "value": "8 GB DDR4"}, {"label": "Almacenamiento", "value": "256 GB SSD"}, {"label": "Pantalla", "value": "15,6\" TFT · 1920 × 1080"}, {"label": "Conectividad", "value": "WiFi dual 2,4/5 GHz · Bluetooth · 5 USB · VGA + HDMI"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = '[{"name": "Aqprox appTPV05", "image_url": "/products/models/tpv-pro-apptpv05.webp"}, {"name": "10POS", "image_url": "/products/models/tpv-pro-10pos.webp"}]'::jsonb
 WHERE code = 'tpv-pro';

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'tpv-premium',
    'tpv-premium',
    'TPV Premium',
    'Terminal profesional con pantalla full flat de 15,6", Intel N97 y Windows 11.',
    'tpv',
    'peninsula',
    73700,
    230,
    'JASSWAY',
    'Galia',
    'Tope de gama',
    'Terminal profesional con pantalla full flat de 15,6", Intel N97 y Windows 11.',
    'Locales que buscan un TPV fiable y moderno, con pantalla plana fácil de limpiar para un uso intensivo.',
    NULL,
    NULL,
    NULL,
    '/products/tpv-premium.webp',
    ARRAY['Pantalla full flat 15,6"', 'Intel N97 · 8 GB RAM', '128 GB SSD · Windows 11']::text[],
    '{}',
    '[{"label": "Procesador", "value": "Intel N97"}, {"label": "Memoria", "value": "8 GB DDR4"}, {"label": "Almacenamiento", "value": "128 GB SSD"}, {"label": "Pantalla", "value": "15,6\" full flat · 1024 × 768 · táctil capacitivo"}, {"label": "Conectividad", "value": "6 USB · RJ45 · RS232 · VGA · HDMI · WiFi"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb,
    NULL,
    NULL,
    21,
    1,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------
-- KDS
-- -------------------------------------------------------------

UPDATE public.products SET
    catalog_slug            = 'kds-tablet-lenovo'
  , name                    = 'Tablet Lenovo Tab Plus'
  , category                = 'kds'
  , region                  = 'peninsula'
  , price_cents             = 19900
  , sort_order              = 310
  , brand                   = 'Lenovo'
  , model                   = 'Tab Plus'
  , badge                   = 'Compacta'
  , summary                 = 'KDS seguro y bloqueado: monofunción, sin distracciones y con Qamarero preinstalado.'
  , ideal_for               = 'Cocinas que quieren digitalizar comandas con una pantalla compacta, lista para enchufar.'
  , internal_note           = 'Precio fijo sin rebajas. Gratis con implementación PRO. La tablet llega flasheada, bloqueada a Qamarero y preparada como puesto de cocina.'
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/tablet-kds-lenovo.webp'
  , highlights              = ARRAY['11,5" 2K', 'Android 14', 'Soporte integrado']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Pantalla", "value": "11,5\" 2K · 2.000 × 1.200 · 400 nits · 90 Hz"}, {"label": "Procesador", "value": "MediaTek Helio G99"}, {"label": "Memoria", "value": "8 GB LPDDR4X · 128 GB UFS 2.2"}, {"label": "Conectividad", "value": "Wi‑Fi 5 · Bluetooth 5.2 · USB‑C · microSD"}, {"label": "Sistema", "value": "Android 14"}, {"label": "Soporte", "value": "Pata trasera integrada, hasta 175°"}, {"label": "Protección", "value": "Sin clasificación de protección para cocina confirmada"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'tablet-kds-lenovo';

UPDATE public.products SET
    catalog_slug            = 'kds-android-22'
  , name                    = 'KDS Standard'
  , category                = 'kds'
  , region                  = 'peninsula'
  , price_cents             = 54900
  , sort_order              = 320
  , brand                   = 'AIMV'
  , model                   = 'KDS Android 14'
  , badge                   = NULL
  , summary                 = 'Pantalla Android de 21,5" para una lectura amplia de las comandas en cocina.'
  , ideal_for               = 'Cocinas que quieren una pantalla grande Android y pueden mantenerla alejada de salpicaduras directas.'
  , internal_note           = 'Avisar al cliente de que no es recomendable colocarlo cerca de freidoras, ollas u otras fuentes de vapores.'
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/kds-estandar.webp'
  , highlights              = ARRAY['21,5"', 'Android 14', 'No apta para salpicaduras']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Pantalla", "value": "21,5\""}, {"label": "Sistema", "value": "Android 14"}, {"label": "Protección", "value": "Carcasa con aperturas: no resistente a salpicaduras"}, {"label": "Procesador", "value": "RK3576"}, {"label": "Memoria", "value": "4 GB RAM"}, {"label": "Conectividad", "value": "2 USB · TF · LAN · WiFi · Bluetooth"}, {"label": "Montaje", "value": "VESA 100 × 100"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
  , description             = 'Pantalla cocina Android 21,5''''. RK3576, 4GB RAM. 2 USB + TF + LAN + WiFi + BT. VESA 100x100. Carcasa con aperturas: NO resistente a salpicaduras.'
 WHERE code = 'kds-estandar';

UPDATE public.products SET
    catalog_slug            = 'kds-pro'
  , name                    = 'KDS Pro'
  , category                = 'kds'
  , region                  = 'peninsula'
  , price_cents             = 96300
  , sort_order              = 330
  , brand                   = '10POS'
  , model                   = NULL
  , badge                   = 'Mejor valor'
  , summary                 = 'Terminal industrial de cocina con panel táctil sellado y hardware Windows compatible.'
  , ideal_for               = 'Cocinas con carga intensa que necesitan pantalla grande, montaje mural y panel protegido.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/kds-pro.webp'
  , highlights              = ARRAY['Intel Core i5', '21,5" Full HD', 'IP65 en panel']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Pantalla", "value": "21,5\" táctil Full HD"}, {"label": "Resolución", "value": "1.920 × 1.080"}, {"label": "Procesador", "value": "Intel Core i5-8250U 8ª Gen · hasta 3,40 GHz"}, {"label": "Memoria", "value": "8 GB DDR4 · 128 GB SSD"}, {"label": "Conectividad", "value": "Wi‑Fi · Ethernet Gigabit · 2 USB 3.0 · 2 USB 2.0 · 2 RS232 · HDMI"}, {"label": "Sistema", "value": "Windows 11 incluido"}, {"label": "Protección", "value": "IP65 en panel"}, {"label": "Montaje", "value": "VESA 100 × 100 · sobremesa o encastrado opcionales"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'kds-pro';

UPDATE public.products SET
    catalog_slug            = 'kds-premium'
  , name                    = 'KDS Premium'
  , category                = 'kds'
  , region                  = 'peninsula'
  , price_cents             = 138300
  , sort_order              = 340
  , brand                   = '10POS'
  , model                   = 'KDS Series'
  , badge                   = 'Premium'
  , summary                 = 'KDS profesional sellado, de aluminio y alto brillo para los entornos de cocina más exigentes.'
  , ideal_for               = 'Cocinas de alto rendimiento con humedad, grasa, luz intensa y necesidad de accesorios profesionales.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/kds-premium.webp'
  , highlights              = ARRAY['21,5" Full HD · 500 nits', 'IP54 · diseño sellado', 'Wi‑Fi 6 + 2,5 GbE']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Pantalla", "value": "21,5\" táctil Full HD"}, {"label": "Brillo", "value": "500 nits · antirreflejo y antihuellas"}, {"label": "Procesador", "value": "Según configuración: Celeron J6412 o Intel Core Raptor Lake U"}, {"label": "Memoria", "value": "DDR4/DDR5 según configuración · hasta 32/64 GB"}, {"label": "Almacenamiento", "value": "2 × M.2 2280 según configuración"}, {"label": "Conectividad", "value": "Wi‑Fi 6 · Bluetooth 5.2 · 2 × 2,5 GbE · USB"}, {"label": "Sistema", "value": "Windows 11 IoT incluido"}, {"label": "Protección", "value": "IP54 · diseño sellado frente a humedad y grasa"}, {"label": "Montaje", "value": "VESA 100 × 100 · soporte para bump bar y lector 2D"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'kds-premium';

-- -------------------------------------------------------------
-- Impresoras
-- -------------------------------------------------------------

UPDATE public.products SET
    catalog_slug            = 'impresora-cable'
  , name                    = 'Impresora Cable'
  , category                = 'printer'
  , region                  = 'peninsula'
  , price_cents             = 8360
  , sort_order              = 410
  , brand                   = 'Aqprox / 10POS / ITS'
  , model                   = NULL
  , badge                   = NULL
  , summary                 = 'Impresión térmica fiable, rápida y silenciosa por USB o Ethernet.'
  , ideal_for               = 'Mostradores con red cableada y un flujo estable de tickets.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/printer-cable.webp'
  , highlights              = ARRAY['Papel 80 mm', 'Corte automático', 'USB + Ethernet']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Tecnología", "value": "Impresión térmica"}, {"label": "Papel", "value": "80 mm"}, {"label": "Corte", "value": "Automático"}, {"label": "Entradas", "value": "USB + Ethernet · RJ12 para cajón"}, {"label": "Compatibilidad", "value": "Windows"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'printer-cable';

UPDATE public.products SET
    catalog_slug            = 'impresora-wifi'
  , name                    = 'Impresora WiFi'
  , category                = 'printer'
  , region                  = 'peninsula'
  , price_cents             = 13640
  , sort_order              = 420
  , brand                   = 'Aqprox / 10POS / ITS'
  , model                   = NULL
  , badge                   = NULL
  , summary                 = 'Versatilidad inalámbrica de 2,4 GHz con corte automático.'
  , ideal_for               = 'Barra o cocina donde no resulta práctico llevar cable de red.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/printer-wifi.webp'
  , highlights              = ARRAY['WiFi 2,4 GHz', 'Papel 80 mm', 'Corte automático']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Tecnología", "value": "Impresión térmica"}, {"label": "Papel", "value": "80 mm"}, {"label": "Inalámbrica", "value": "WiFi 2,4 GHz"}, {"label": "Física", "value": "USB + Ethernet · RJ12 para cajón"}, {"label": "Compatibilidad", "value": "Windows"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'printer-wifi';

UPDATE public.products SET
    catalog_slug            = 'impresora-tp808'
  , name                    = 'Impresora TP808 WiFi'
  , category                = 'printer'
  , region                  = 'peninsula'
  , price_cents             = 17600
  , sort_order              = 430
  , brand                   = 'HPRT'
  , model                   = NULL
  , badge                   = NULL
  , summary                 = 'Modelo WiFi duradero, silencioso y compatible con Windows y Android.'
  , ideal_for               = 'Negocios que necesitan compatibilidad dual y bajo mantenimiento.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/printer-tp808-wifi.webp'
  , highlights              = ARRAY['Windows + Android', 'WiFi 2,4 GHz', 'Sin tinta ni tóner']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Tecnología", "value": "Impresión térmica"}, {"label": "Papel", "value": "80 mm"}, {"label": "Conectividad", "value": "USB · LAN · WiFi 2,4 GHz"}, {"label": "Corte", "value": "Automático"}, {"label": "Compatibilidad", "value": "Windows y Android"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'printer-tp808-wifi';

UPDATE public.products SET
    catalog_slug            = 'impresora-cocina'
  , name                    = 'Impresora con alarma de cocina USB/LAN'
  , category                = 'printer'
  , region                  = 'peninsula'
  , price_cents             = 12000
  , sort_order              = 440
  , brand                   = 'Aqprox'
  , model                   = NULL
  , badge                   = NULL
  , summary                 = 'Robusta y protegida, con un avisador sonoro muy potente y aviso visual para no perder ninguna comanda en cocina.'
  , ideal_for               = 'Cocinas con calor, grasa y una carga intensa de impresión.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/printer-cocina-usb-lan.webp'
  , highlights              = ARRAY['Alarma sonora muy potente', 'Tapa antisuciedad', 'Solo USB + LAN']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Uso", "value": "Cocina de carga intensa"}, {"label": "Protección", "value": "Tapa antisuciedad"}, {"label": "Avisos", "value": "Alarma sonora muy potente + aviso visual"}, {"label": "Corte", "value": "Automático o manual"}, {"label": "Conectividad", "value": "Solo USB + LAN"}, {"label": "Compatibilidad", "value": "Windows"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'printer-cocina-usb-lan';

-- -------------------------------------------------------------
-- Periféricos y avisadores
-- -------------------------------------------------------------

UPDATE public.products SET
    catalog_slug            = NULL
  , name                    = 'Cajón portamonedas'
  , category                = 'accessory'
  , region                  = 'peninsula'
  , price_cents             = 4290
  , sort_order              = 510
  , brand                   = 'Aqprox'
  , model                   = NULL
  , badge                   = NULL
  , summary                 = 'Control rápido y seguro del efectivo con estructura metálica.'
  , ideal_for               = 'Cualquier puesto de cobro que necesite apertura automática.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/cajon.webp'
  , highlights              = ARRAY['41 × 41 cm', '4 billetes + 8 monedas', 'Conexión RJ11']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Dimensiones", "value": "41 × 41 cm"}, {"label": "Billetes", "value": "4 compartimentos"}, {"label": "Monedas", "value": "8 compartimentos"}, {"label": "Diseño", "value": "Gaveta extraíble · estructura metálica"}, {"label": "Conectividad", "value": "RJ11"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'cajon';

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'bascula-minerva-15',
    'bascula-minerva-15',
    'Báscula Minerva 15 kg',
    'Pesa y vuelca el importe directamente al ticket de Qamarero.',
    'accessory',
    'peninsula',
    24900,
    520,
    'Epelsa',
    '56PPI-15',
    'Integrada',
    'Pesa y vuelca el importe directamente al ticket de Qamarero.',
    'Negocios de venta al peso que quieren eliminar errores de tecleo.',
    'Precio fijo. Configurada y validada para trabajar con Qamarero.',
    NULL,
    NULL,
    '/products/bascula-minerva-15.webp',
    ARRAY['Hasta 15 kg', 'Integración RS232', 'Doble display']::text[],
    '{}',
    '[{"label": "Capacidad", "value": "15 kg"}, {"label": "Integración", "value": "RS232 · peso/precio directo a Qamarero"}, {"label": "Display", "value": "Doble, vendedor y cliente"}, {"label": "Funciones", "value": "Tara · cambio · 100 PLUs"}, {"label": "Plato", "value": "Acero inoxidable"}, {"label": "Homologación", "value": "CE · modelo T8441"}]'::jsonb,
    NULL,
    NULL,
    21,
    1,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'avisadores-aqprox',
    'avisadores-approx',
    'Avisadores Aqprox · kit 10',
    'Alternativa asequible con diez discos que vibran, suenan y se iluminan.',
    'accessory',
    'peninsula',
    18900,
    530,
    'Aqprox',
    'appCUSTOMERCALLER',
    'Económico',
    'Alternativa asequible con diez discos que vibran, suenan y se iluminan.',
    'Negocios sensibles al precio que necesitan una solución sencilla.',
    'Consultar opción de pack de expansión de avisadores en caso de necesitar más unidades.',
    NULL,
    NULL,
    '/products/avisadores-aqprox.webp',
    ARRAY['10 discos', 'Hasta 400 m', '32 h en espera']::text[],
    '{}',
    '[{"label": "Contenido", "value": "Transmisor + cargador + 10 discos"}, {"label": "Avisos", "value": "Vibración, sonido y luz"}, {"label": "Alcance", "value": "Hasta 400 m"}, {"label": "Autonomía", "value": "Aproximadamente 32 h en espera"}, {"label": "Ampliación", "value": "Pack adicional de 10 discos: 145 € + IVA"}]'::jsonb,
    NULL,
    NULL,
    21,
    1,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'avisadores-10pos',
    'avisadores-posiflex',
    'Avisadores 10POS · kit 10',
    'Kit de avisadores premium: el doble de alcance (hasta 800 m) y más del doble de autonomía (72 h) que el kit económico, con carga completa en 2 h y batería de hasta 5 años.',
    'accessory',
    'peninsula',
    74900,
    540,
    '10POS',
    'CT-P531',
    'Premium',
    'Kit de avisadores premium: el doble de alcance (hasta 800 m) y más del doble de autonomía (72 h) que el kit económico, con carga completa en 2 h y batería de hasta 5 años.',
    'Locales con gran superficie o alta rotación que necesitan más alcance, autonomía y robustez que el kit económico.',
    NULL,
    NULL,
    NULL,
    '/products/avisadores-10pos.webp',
    ARRAY['Luz, sonido y vibración', 'Cobertura hasta 800 m', '72 h de autonomía']::text[],
    '{}',
    '[{"label": "Contenido", "value": "1 transmisor + 1 cargador + 10 avisadores"}, {"label": "Aviso", "value": "Luz, sonido y vibración (configurable)"}, {"label": "Cobertura", "value": "Hasta 800 m en espacios abiertos"}, {"label": "Carga", "value": "100% en 2 h · hasta 72 h en reposo"}, {"label": "Batería", "value": "Vida útil estimada de 5 años"}, {"label": "Diseño", "value": "Circular antideslizante, apilable en el cargador"}]'::jsonb,
    NULL,
    NULL,
    21,
    1,
    FALSE
)
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------
-- Red / Routers
-- -------------------------------------------------------------

UPDATE public.products SET
    catalog_slug            = 'router-flint'
  , name                    = 'Enrutador FLINT'
  , category                = 'network'
  , region                  = 'peninsula'
  , price_cents             = 15000
  , sort_order              = 610
  , brand                   = 'GL.iNet'
  , model                   = NULL
  , badge                   = NULL
  , summary                 = 'Red de gran alcance para estabilizar impresoras WiFi y dispositivos.'
  , ideal_for               = 'Negocios medianos con varias impresoras inalámbricas.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/router-flint.webp'
  , highlights              = ARRAY['Gran alcance', 'Red operativa aislada', 'Varias impresoras WiFi']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Gestión", "value": "Aísla la operativa de los dispositivos"}, {"label": "Alcance", "value": "Optimizado para negocios medianos"}, {"label": "Compatibilidad", "value": "Alta compatibilidad con varias impresoras WiFi"}, {"label": "Soporte", "value": "Configuración con Qamarero"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'router-flint';

UPDATE public.products SET
    catalog_slug            = 'router-opal'
  , name                    = 'Enrutador OPAL'
  , category                = 'network'
  , region                  = 'peninsula'
  , price_cents             = 8500
  , sort_order              = 620
  , brand                   = 'GL.iNet'
  , model                   = NULL
  , badge                   = NULL
  , summary                 = 'Conectividad sencilla y estable para locales pequeños.'
  , ideal_for               = 'Pequeños locales con una configuración WiFi simple.'
  , internal_note           = NULL
  , availability_note       = NULL
  , model_availability_note = NULL
  , image_url               = '/products/router-opal.webp'
  , highlights              = ARRAY['Formato compacto', 'Red operativa aislada', 'WiFi estable']::text[]
  , components              = '{}'
  , specifications          = '[{"label": "Gestión", "value": "Aísla la operativa de los dispositivos"}, {"label": "Alcance", "value": "Optimizado para espacios pequeños"}, {"label": "Compatibilidad", "value": "Impresoras WiFi en entornos simples"}, {"label": "Soporte", "value": "Configuración con Qamarero"}]'::jsonb
  , price_breakdown         = NULL
  , model_options           = NULL
 WHERE code = 'router-opal';

-- -------------------------------------------------------------
-- Canarias — precio FINAL, vat_rate 0, sufijo en el nombre
-- -------------------------------------------------------------

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'pack-basic-canarias',
    'pack-basic-canarias',
    'Pack Basic Canarias',
    'Equipo completo con un TPV Pro, impresora LAN y cajón, configurados para empezar.',
    'pack',
    'canarias',
    63900,
    810,
    'Qamarero',
    NULL,
    'Canarias',
    'Equipo completo con un TPV Pro, impresora LAN y cajón, configurados para empezar.',
    'Restaurantes que buscan un único puesto estable, completo y listo para usar.',
    NULL,
    NULL,
    'Se envía Aqprox appTPV05 o 10POS según disponibilidad; ambos ofrecen prestaciones equivalentes dentro de la gama Pro.',
    '/products/pack-basic-canarias.webp',
    ARRAY['Pack con preconfiguración Qamarero (valorada en 100€)', 'TPV Pro 15,6"', 'Impresora USB/LAN', 'Cajón portamonedas']::text[],
    ARRAY['TPV Pro', 'Impresora USB/LAN', 'Cajón portamonedas']::text[],
    '[{"label": "Pantalla", "value": "Táctil TPV Pro 15,6\""}, {"label": "Impresora", "value": "USB / LAN"}, {"label": "Conectividad", "value": "LAN + WiFi"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb,
    '[{"label": "TPV Pro", "price_cents": 53907}, {"label": "Impresora LAN", "price_cents": 8077}, {"label": "Cajón portamonedas", "price_cents": 5076}, {"label": "Preconfiguración Qamarero", "price_cents": 10000}]'::jsonb,
    '[{"name": "Aqprox appTPV05", "image_url": "/products/models/tpv-pro-apptpv05.webp"}, {"name": "10POS", "image_url": "/products/models/tpv-pro-10pos.webp"}]'::jsonb,
    0,
    3,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'pack-pro-canarias',
    'pack-pro-canarias',
    'Pack Pro Canarias',
    'Barra y cocina resueltas con un TPV Pro y dos impresoras ya configuradas.',
    'pack',
    'canarias',
    73900,
    820,
    'Qamarero',
    NULL,
    'Canarias',
    'Barra y cocina resueltas con un TPV Pro y dos impresoras ya configuradas.',
    'Locales con barra y cocina separadas que necesitan doble impresión.',
    'Configuración para Canarias, sin router.',
    NULL,
    'Se envía Aqprox appTPV05 o 10POS según disponibilidad; ambos ofrecen prestaciones equivalentes dentro de la gama Pro.',
    '/products/pack-pro-canarias.webp',
    ARRAY['Pack con preconfiguración Qamarero (valorada en 100€)', 'TPV Pro 15,6"', 'Doble impresora (LAN + WiFi)', 'Cajón portamonedas']::text[],
    ARRAY['TPV Pro', 'Impresora USB/LAN', 'Impresora WiFi adicional', 'Cajón portamonedas']::text[],
    '[{"label": "Pantalla", "value": "Táctil TPV Pro 15,6\""}, {"label": "Impresora 1", "value": "USB/WiFi"}, {"label": "Impresora 2", "value": "USB/LAN"}, {"label": "Conectividad", "value": "LAN + WiFi"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb,
    '[{"label": "TPV Pro", "price_cents": 53907}, {"label": "Impresora LAN", "price_cents": 8077}, {"label": "Impresora WiFi", "price_cents": 9423}, {"label": "Cajón portamonedas", "price_cents": 5076}, {"label": "Preconfiguración Qamarero", "price_cents": 10000}]'::jsonb,
    '[{"name": "Aqprox appTPV05", "image_url": "/products/models/tpv-pro-apptpv05.webp"}, {"name": "10POS", "image_url": "/products/models/tpv-pro-10pos.webp"}]'::jsonb,
    0,
    4,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'pack-premium-canarias',
    'pack-premium-canarias',
    'Pack Premium Canarias',
    'Doble impresora WiFi y un TPV Pro, configurados y listos para trabajar.',
    'pack',
    'canarias',
    76900,
    830,
    'Qamarero',
    NULL,
    'Canarias',
    'Doble impresora WiFi y un TPV Pro, configurados y listos para trabajar.',
    'Establecimientos que quieren doble impresión WiFi y un TPV Pro potente.',
    'Configuración para Canarias, sin router.',
    NULL,
    'Se envía Aqprox appTPV05 o 10POS según disponibilidad; ambos ofrecen prestaciones equivalentes dentro de la gama Pro.',
    '/products/pack-premium-canarias.webp',
    ARRAY['Pack con preconfiguración Qamarero (valorada en 100€)', 'TPV Pro 15,6"', 'Doble impresora WiFi', 'Cajón portamonedas']::text[],
    ARRAY['TPV Pro', '2 impresoras WiFi', 'Cajón portamonedas']::text[],
    '[{"label": "Pantalla", "value": "Táctil TPV Pro 15,6\""}, {"label": "Impresoras", "value": "2 × WiFi"}, {"label": "Conectividad", "value": "LAN + WiFi"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb,
    '[{"label": "TPV Pro", "price_cents": 53907}, {"label": "Impresora WiFi", "price_cents": 9423, "quantity": 2}, {"label": "Cajón portamonedas", "price_cents": 5076}, {"label": "Preconfiguración Qamarero", "price_cents": 10000}]'::jsonb,
    '[{"name": "Aqprox appTPV05", "image_url": "/products/models/tpv-pro-apptpv05.webp"}, {"name": "10POS", "image_url": "/products/models/tpv-pro-10pos.webp"}]'::jsonb,
    0,
    4,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'tpv-pro-canarias',
    'tpv-pro-canarias',
    'TPV Pro Canarias',
    'Pantalla Full HD, doble WiFi y más almacenamiento para servicios exigentes.',
    'tpv',
    'canarias',
    53907,
    840,
    '10POS / Aqprox',
    NULL,
    'Canarias',
    'Pantalla Full HD, doble WiFi y más almacenamiento para servicios exigentes.',
    'Locales con delivery, varias zonas y un uso intensivo del terminal.',
    NULL,
    NULL,
    'Se envía Aqprox appTPV05 o 10POS según disponibilidad; ambos ofrecen prestaciones equivalentes dentro de la gama Pro.',
    '/products/tpv-pro-canarias.webp',
    ARRAY['15,6" Full HD', '256 GB SSD', 'WiFi dual + Bluetooth']::text[],
    '{}',
    '[{"label": "Procesador", "value": "Intel Celeron"}, {"label": "Memoria", "value": "8 GB DDR4"}, {"label": "Almacenamiento", "value": "256 GB SSD"}, {"label": "Pantalla", "value": "15,6\" TFT · 1920 × 1080"}, {"label": "Conectividad", "value": "WiFi dual 2,4/5 GHz · Bluetooth · 5 USB · VGA + HDMI"}, {"label": "Sistema", "value": "Windows 11"}]'::jsonb,
    NULL,
    '[{"name": "Aqprox appTPV05", "image_url": "/products/models/tpv-pro-apptpv05.webp"}, {"name": "10POS", "image_url": "/products/models/tpv-pro-10pos.webp"}]'::jsonb,
    0,
    1,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'kds-canarias',
    'kds-canarias',
    'KDS Canarias',
    'Terminal táctil profesional de 21,5" Full HD con panel capacitivo sellado (IP65), para pantalla de cocina o punto de venta.',
    'kds',
    'canarias',
    69900,
    850,
    '10POS',
    '10D-215',
    'Canarias',
    'Terminal táctil profesional de 21,5" Full HD con panel capacitivo sellado (IP65), para pantalla de cocina o punto de venta.',
    'Cocinas que necesitan una pantalla grande, robusta y con Windows.',
    NULL,
    NULL,
    NULL,
    '/products/kds-canarias.webp',
    ARRAY['21,5" Full HD táctil', 'Intel J6412 · 8 GB · 128 GB SSD', 'IP65 · Windows 11 IoT']::text[],
    '{}',
    '[{"label": "Pantalla", "value": "21,5\" Full HD (1.920 × 1.080) · táctil capacitiva"}, {"label": "Procesador", "value": "Intel J6412 QuadCore · 2,0 / 2,6 GHz"}, {"label": "Memoria", "value": "8 GB DDR4 SODIMM"}, {"label": "Almacenamiento", "value": "128 GB SSD"}, {"label": "Conectividad", "value": "WiFi · Ethernet Gigabit · 2 USB 3.0 · 2 USB 2.0 · HDMI · VGA · audio"}, {"label": "Sistema", "value": "Windows 11 IoT"}, {"label": "Protección", "value": "IP65 en panel frontal"}, {"label": "Montaje", "value": "VESA 100"}, {"label": "Físicas", "value": "528 × 61 × 319 mm · 5,1 kg"}]'::jsonb,
    NULL,
    NULL,
    0,
    1,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'printer-cable-canarias',
    'impresora-cable-canarias',
    'Impresora Cable Canarias',
    'Impresión térmica fiable, rápida y silenciosa por USB o Ethernet.',
    'printer',
    'canarias',
    8077,
    860,
    'Aqprox / 10POS / ITS',
    NULL,
    'Canarias',
    'Impresión térmica fiable, rápida y silenciosa por USB o Ethernet.',
    'Mostradores con red cableada y un flujo estable de tickets.',
    NULL,
    NULL,
    NULL,
    '/products/printer-cable-canarias.webp',
    ARRAY['Papel 80 mm', 'Corte automático', 'USB + Ethernet']::text[],
    '{}',
    '[{"label": "Tecnología", "value": "Impresión térmica"}, {"label": "Papel", "value": "80 mm"}, {"label": "Corte", "value": "Automático"}, {"label": "Entradas", "value": "USB + Ethernet · RJ12 para cajón"}, {"label": "Compatibilidad", "value": "Windows"}]'::jsonb,
    NULL,
    NULL,
    0,
    1,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'printer-wifi-canarias',
    'impresora-wifi-canarias',
    'Impresora WiFi Canarias',
    'Versatilidad inalámbrica de 2,4 GHz con corte automático.',
    'printer',
    'canarias',
    9423,
    870,
    'Aqprox / 10POS / ITS',
    NULL,
    'Canarias',
    'Versatilidad inalámbrica de 2,4 GHz con corte automático.',
    'Barra o cocina donde no resulta práctico llevar cable de red.',
    NULL,
    NULL,
    NULL,
    '/products/printer-wifi-canarias.webp',
    ARRAY['WiFi 2,4 GHz', 'Papel 80 mm', 'Corte automático']::text[],
    '{}',
    '[{"label": "Tecnología", "value": "Impresión térmica"}, {"label": "Papel", "value": "80 mm"}, {"label": "Inalámbrica", "value": "WiFi 2,4 GHz"}, {"label": "Física", "value": "USB + Ethernet · RJ12 para cajón"}, {"label": "Compatibilidad", "value": "Windows"}]'::jsonb,
    NULL,
    NULL,
    0,
    1,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.products (
    code, catalog_slug, name, description, category, region, price_cents, sort_order, brand, model, badge, summary, ideal_for, internal_note, availability_note, model_availability_note, image_url, highlights, components, specifications, price_breakdown, model_options, vat_rate, package_count, active
) VALUES (
    'cajon-canarias',
    'cajon-portamonedas-canarias',
    'Cajón portamonedas Canarias',
    'Control rápido y seguro del efectivo con estructura metálica.',
    'accessory',
    'canarias',
    5076,
    880,
    'Aqprox',
    NULL,
    'Canarias',
    'Control rápido y seguro del efectivo con estructura metálica.',
    'Cualquier puesto de cobro que necesite apertura automática.',
    NULL,
    NULL,
    NULL,
    '/products/cajon-canarias.webp',
    ARRAY['41 × 41 cm', '4 billetes + 8 monedas', 'Conexión RJ11']::text[],
    '{}',
    '[{"label": "Dimensiones", "value": "41 × 41 cm"}, {"label": "Billetes", "value": "4 compartimentos"}, {"label": "Monedas", "value": "8 compartimentos"}, {"label": "Diseño", "value": "Gaveta extraíble · estructura metálica"}, {"label": "Conectividad", "value": "RJ11"}]'::jsonb,
    NULL,
    NULL,
    0,
    1,
    TRUE
)
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------
-- Retirada: hardware físico que no está en el catálogo web.
-- NUNCA DELETE: order_items.product_id es FK sin ON DELETE y hay pedidos
-- históricos. active = false es el soft-delete de la casa.
-- -------------------------------------------------------------
UPDATE public.products
   SET active = FALSE, sort_order = 690
 WHERE code = 'picho-wifi';

-- -------------------------------------------------------------
-- CHECK de category: se añade AHORA, cuando ya no quedan filas con valores
-- fuera de lista (saas_hardware se movió a service en 20260825000002). El
-- catálogo se edita a mano en el SQL Editor, así que esto es la única red
-- contra un typo que deja un producto invisible en todas las pestañas.
-- -------------------------------------------------------------
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_chk;
ALTER TABLE public.products ADD  CONSTRAINT products_category_chk
  CHECK (category IN ('pack','tpv','kds','printer','accessory','network','service','custom'));

COMMIT;

-- -------------------------------------------------------------
-- Comprobaciones DESPUÉS de aplicar (deben cuadrar):
-- -------------------------------------------------------------
--   -- 35 filas, 33 activas
--   SELECT count(*) AS total, count(*) FILTER (WHERE active) AS activas
--     FROM public.products;
--
--   -- 8 canarias, todas con vat_rate = 0
--   SELECT count(*) FROM public.products
--    WHERE region = 'canarias' AND vat_rate = 0;
--
--   -- Ahorro de cada pack (standalone lo calcula el trigger)
--   SELECT code, price_cents, standalone_price_cents,
--          standalone_price_cents - price_cents AS ahorro_cents
--     FROM public.products
--    WHERE price_breakdown IS NOT NULL ORDER BY sort_order;
--
--   -- Ninguna fila activa sin imagen ni resumen
--   SELECT code FROM public.products
--    WHERE active AND (image_url IS NULL OR summary IS NULL) ORDER BY code;
--
--   -- Ningun pedido historico perdio su producto
--   SELECT count(*) FROM public.order_items oi
--    WHERE oi.product_id IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = oi.product_id);
