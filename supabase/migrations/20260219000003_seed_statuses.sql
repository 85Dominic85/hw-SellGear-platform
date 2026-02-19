-- =============================================================
-- MainOperation Platform — Seed inicial
-- Migration: 20260219000003_seed_statuses
-- =============================================================

-- -----------------------------------------------
-- Tabla de referencia de estados (informativa)
-- Útil para labels en la UI y validaciones
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_status_labels (
  status      order_status PRIMARY KEY,
  label_es    TEXT NOT NULL,
  color       TEXT NOT NULL,  -- Tailwind color class
  description TEXT
);

INSERT INTO public.order_status_labels (status, label_es, color, description) VALUES
  ('nuevo',               'Nuevo',               'blue',   'Pedido recibido, pendiente de revisión'),
  ('en_revision',         'En revisión',          'yellow', 'Hardware está revisando el pedido'),
  ('falta_info',          'Falta info',           'orange', 'Se necesita información adicional del creador'),
  ('aprobado',            'Aprobado',             'green',  'Pedido aprobado por Hardware'),
  ('pedido_a_proveedor',  'Pedido a proveedor',   'purple', 'Pedido enviado al proveedor'),
  ('en_transito',         'En tránsito',          'indigo', 'Producto en camino'),
  ('recibido',            'Recibido',             'teal',   'Producto recibido en oficina'),
  ('preparacion',         'Preparación/Envío',    'cyan',   'Preparando para envío al cliente'),
  ('completado',          'Completado',           'emerald','Operación completada'),
  ('cancelado',           'Cancelado',            'red',    'Operación cancelada')
ON CONFLICT (status) DO UPDATE
  SET label_es = EXCLUDED.label_es,
      color = EXCLUDED.color,
      description = EXCLUDED.description;

-- RLS para order_status_labels: lectura pública para usuarios autenticados
ALTER TABLE public.order_status_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_labels: authenticated read"
  ON public.order_status_labels FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------
-- Tabla de referencia de pestañas del sheet
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.sheet_tab_mapping (
  purchase_type   purchase_type PRIMARY KEY,
  sheet_tab_name  TEXT NOT NULL,
  description     TEXT
);

INSERT INTO public.sheet_tab_mapping (purchase_type, sheet_tab_name, description) VALUES
  ('kit_digital',            'KIT Digital',          'Operaciones Kit Digital'),
  ('hardware_one_off',       'Hardware One Off',     'Compras puntuales de hardware'),
  ('hardware_financiacion',  'Hardware Financiación','Hardware con financiación'),
  ('transferencias_saas',    'Transferencias SaaS',  'Transferencias SaaS'),
  ('otro',                   'Pedidos',              'Pedidos generales y otros')
ON CONFLICT (purchase_type) DO UPDATE
  SET sheet_tab_name = EXCLUDED.sheet_tab_name,
      description = EXCLUDED.description;

ALTER TABLE public.sheet_tab_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sheet_tab_mapping: authenticated read"
  ON public.sheet_tab_mapping FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------
-- Comentario en migración
-- -----------------------------------------------

COMMENT ON TABLE public.order_status_labels IS 'Labels y colores para estados de pedido (UI reference)';
COMMENT ON TABLE public.sheet_tab_mapping IS 'Mapeo entre purchase_type y pestaña de Google Sheets';
