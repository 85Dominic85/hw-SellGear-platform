-- =============================================================
-- Agenda de direcciones (address_book)
-- Migration: 20260505000002_address_book
-- Tipo: aditiva. Tabla nueva con FTS espa~ol + trgm.
-- =============================================================
--
-- Permite mantener una agenda de clientes/contactos reutilizables
-- para los envios TIPSA libres (Fase 4) y, en el futuro, para
-- pre-rellenar formularios de pedidos. Busqueda multi-campo via
-- columna generada `search_text` con tsvector + indices GIN trgm.

-- pg_trgm para busqueda por fragmentos (substrings cortos).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.address_book (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.user_profiles(id),

  alias           TEXT,
  name            TEXT NOT NULL,
  venue_name      TEXT,
  address         TEXT NOT NULL,
  cp              TEXT NOT NULL,
  city            TEXT NOT NULL,
  province        TEXT,
  phone           TEXT,
  email           TEXT,
  contact_person  TEXT,
  notes           TEXT,

  -- FTS espa~ol indexable (STORED en Postgres 12+; Supabase es 15+).
  search_text     TSVECTOR
    GENERATED ALWAYS AS (
      to_tsvector(
        'spanish',
        coalesce(name,'')           || ' ' ||
        coalesce(venue_name,'')     || ' ' ||
        coalesce(alias,'')          || ' ' ||
        coalesce(address,'')        || ' ' ||
        coalesce(cp,'')             || ' ' ||
        coalesce(city,'')           || ' ' ||
        coalesce(province,'')       || ' ' ||
        coalesce(contact_person,'')
      )
    ) STORED,

  CONSTRAINT address_book_cp_format CHECK (cp ~ '^\d{5}$')
);

COMMENT ON TABLE  public.address_book IS 'Agenda de direcciones reutilizable para envios TIPSA libres y formularios.';
COMMENT ON COLUMN public.address_book.alias IS 'Apodo libre. Ej: "Bar X - local 1".';
COMMENT ON COLUMN public.address_book.search_text IS 'Vector FTS espa~ol indexado GIN. Generated column STORED.';

-- Indices
CREATE INDEX IF NOT EXISTS idx_address_book_search_gin
  ON public.address_book USING GIN (search_text);

CREATE INDEX IF NOT EXISTS idx_address_book_name_trgm
  ON public.address_book USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_address_book_venue_trgm
  ON public.address_book USING GIN (venue_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_address_book_address_trgm
  ON public.address_book USING GIN (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_address_book_cp ON public.address_book (cp);
CREATE INDEX IF NOT EXISTS idx_address_book_created_at ON public.address_book (created_at DESC);

-- Trigger updated_at (reutiliza public.set_updated_at() de la migracion inicial)
DROP TRIGGER IF EXISTS address_book_updated_at ON public.address_book;
CREATE TRIGGER address_book_updated_at
  BEFORE UPDATE ON public.address_book
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "address_book: hardware full"   ON public.address_book;
CREATE POLICY "address_book: hardware full"
  ON public.address_book FOR ALL
  USING (public.get_my_role() = 'hardware');

DROP POLICY IF EXISTS "address_book: admin full"      ON public.address_book;
CREATE POLICY "address_book: admin full"
  ON public.address_book FOR ALL
  USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "address_book: manager read"    ON public.address_book;
CREATE POLICY "address_book: manager read"
  ON public.address_book FOR SELECT
  USING (public.get_my_role() = 'manager');

DROP POLICY IF EXISTS "address_book: commercial read" ON public.address_book;
CREATE POLICY "address_book: commercial read"
  ON public.address_book FOR SELECT
  USING (public.get_my_role() = 'commercial');

DROP POLICY IF EXISTS "address_book: viewer read"     ON public.address_book;
CREATE POLICY "address_book: viewer read"
  ON public.address_book FOR SELECT
  USING (public.get_my_role() = 'viewer');

-- ROLLBACK manual:
--   DROP TABLE IF EXISTS public.address_book;
-- pg_trgm se queda (puede usarse en otras tablas).
