-- =============================================================
-- MainOperation Platform — Schema inicial
-- Migration: 20260219000001_create_schema
-- =============================================================

-- -----------------------------------------------
-- ENUMS
-- -----------------------------------------------

CREATE TYPE order_status AS ENUM (
  'nuevo',
  'en_revision',
  'falta_info',
  'aprobado',
  'pedido_a_proveedor',
  'en_transito',
  'recibido',
  'preparacion',
  'completado',
  'cancelado'
);

CREATE TYPE purchase_type AS ENUM (
  'kit_digital',
  'hardware_one_off',
  'hardware_financiacion',
  'transferencias_saas',
  'otro'
);

CREATE TYPE user_role AS ENUM (
  'creator',
  'hardware',
  'manager'
);

-- -----------------------------------------------
-- EXTENSIONES
-- -----------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- búsqueda full-text eficiente

-- -----------------------------------------------
-- TABLA: user_profiles
-- Extiende auth.users con rol y datos del equipo
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  email         TEXT,
  role          user_role NOT NULL DEFAULT 'creator',
  department    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_profiles IS 'Perfiles de usuario con rol de acceso';

-- Trigger: sincronizar email desde auth.users al crear el perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------
-- FUNCIÓN: generar operation_id
-- Formato: HW-YYYYMM-NNNN (ej: HW-202602-0001)
-- -----------------------------------------------

CREATE SEQUENCE IF NOT EXISTS order_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_operation_id()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  prefix TEXT;
  seq_val BIGINT;
BEGIN
  prefix := 'HW-' || TO_CHAR(NOW(), 'YYYYMM') || '-';
  seq_val := NEXTVAL('order_seq');
  RETURN prefix || LPAD(seq_val::TEXT, 4, '0');
END;
$$;

-- -----------------------------------------------
-- TABLA: orders
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.orders (
  -- identidad
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_id        TEXT UNIQUE NOT NULL DEFAULT public.generate_operation_id(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES public.user_profiles(id),

  -- origen
  source              TEXT NOT NULL DEFAULT 'manual', -- 'typeform' | 'manual' | 'legacy_import'
  source_department   TEXT,

  -- datos del cliente / bar
  customer_name       TEXT NOT NULL,
  venue_name          TEXT,
  contact_email       TEXT,
  phone               TEXT,

  -- tipo de compra y producto (resumen)
  purchase_type       purchase_type,
  sheet_tab           TEXT, -- pestaña del sheet donde se sincroniza

  -- financiero
  amount              NUMERIC(12, 2),
  bank_receipt_url    TEXT,

  -- referencias externas
  ae_ref              TEXT, -- referencia AE
  hubspot_ref         TEXT,
  invoice_ref         TEXT,

  -- logística
  shipping_address    TEXT,

  -- estado y asignación
  status              order_status NOT NULL DEFAULT 'nuevo',
  assigned_to         UUID REFERENCES public.user_profiles(id),

  -- notas libres
  notes               TEXT,

  -- referencia en Google Sheets
  sheet_row           INT, -- número de fila en el sheet (para updates)

  -- trazabilidad
  typeform_response_id TEXT -- ID único del response de Typeform (para deduplicar)
);

COMMENT ON TABLE public.orders IS 'Pedidos/operaciones de Hardware. Fuente de verdad.';
COMMENT ON COLUMN public.orders.operation_id IS 'ID único legible. Formato: HW-YYYYMM-NNNN';
COMMENT ON COLUMN public.orders.sheet_row IS 'Fila en Google Sheets para hacer update en vez de append';
COMMENT ON COLUMN public.orders.source IS 'Origen del pedido: typeform | manual | legacy_import';

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------
-- TABLA: order_items
-- Un pedido puede tener 1..N productos
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_name  TEXT NOT NULL,
  qty           INT NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price    NUMERIC(12, 2),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.order_items IS 'Líneas de producto de un pedido (1..N por order)';

-- -----------------------------------------------
-- TABLA: status_history
-- Auditoría de todos los cambios de estado
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.status_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status   order_status,
  to_status     order_status NOT NULL,
  changed_by    UUID REFERENCES public.user_profiles(id),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comment       TEXT
);

COMMENT ON TABLE public.status_history IS 'Historial de cambios de estado de pedidos';

-- Trigger: registrar automáticamente en status_history cuando cambia el status
CREATE OR REPLACE FUNCTION public.record_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.assigned_to);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_status_history
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_status_change();

-- -----------------------------------------------
-- TABLA: comments
-- Comentarios internos por pedido
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES public.user_profiles(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.comments IS 'Comentarios internos del equipo Hardware sobre un pedido';

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------
-- ÍNDICES
-- -----------------------------------------------

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_status       ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_by   ON public.orders (created_by);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to  ON public.orders (assigned_to);
CREATE INDEX IF NOT EXISTS idx_orders_purchase_type ON public.orders (purchase_type);
CREATE INDEX IF NOT EXISTS idx_orders_operation_id  ON public.orders (operation_id);
-- Búsqueda textual en customer_name y venue_name
CREATE INDEX IF NOT EXISTS idx_orders_customer_trgm ON public.orders USING GIN (customer_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_venue_trgm    ON public.orders USING GIN (venue_name gin_trgm_ops);

-- status_history
CREATE INDEX IF NOT EXISTS idx_status_history_order_id ON public.status_history (order_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON public.status_history (changed_at DESC);

-- order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

-- comments
CREATE INDEX IF NOT EXISTS idx_comments_order_id ON public.comments (order_id);
