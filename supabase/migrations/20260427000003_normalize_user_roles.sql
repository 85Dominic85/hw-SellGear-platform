-- =============================================================
-- MainOperation Platform — Normalizacion del sistema de roles
-- Migration: 20260427000003_normalize_user_roles
-- =============================================================
-- Cambios:
--   1. Aniade 'commercial' y 'viewer' al enum user_role.
--   2. Migra todos los usuarios con role='creator' a 'commercial'.
--   3. Cambia el default de user_profiles.role de 'creator' a 'viewer'.
--   4. Recrea el trigger handle_new_user para asignar 'viewer' explicitamente.
--   5. Reescribe las 7 policies de RLS que mencionan 'creator' para usar 'commercial'.
--   6. Aniade policies de SELECT para 'viewer' (lectura global).
-- Nota: PostgreSQL 12+ permite ALTER TYPE ADD VALUE dentro de una transaccion.
-- =============================================================

-- -----------------------------------------------
-- 1. Aniadir valores al enum
-- -----------------------------------------------

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'commercial';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';

-- -----------------------------------------------
-- 2. Migrar filas existentes 'creator' -> 'commercial'
-- -----------------------------------------------

UPDATE public.user_profiles SET role = 'commercial' WHERE role = 'creator';

-- -----------------------------------------------
-- 3. Cambiar default de la columna a 'viewer'
-- -----------------------------------------------

ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'viewer';

-- -----------------------------------------------
-- 4. Trigger de creacion: asignar 'viewer' explicitamente
-- -----------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'viewer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger ya existe (on_auth_user_created); CREATE OR REPLACE FUNCTION basta.

-- -----------------------------------------------
-- 5. Reescribir policies que mencionan 'creator' -> 'commercial'
-- -----------------------------------------------

-- orders
DROP POLICY IF EXISTS "orders: creator insert"            ON public.orders;
DROP POLICY IF EXISTS "orders: creator select own"        ON public.orders;
DROP POLICY IF EXISTS "orders: creator update own limited" ON public.orders;

CREATE POLICY "orders: commercial insert"
  ON public.orders FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'commercial'
    AND created_by = auth.uid()
  );

CREATE POLICY "orders: commercial select own"
  ON public.orders FOR SELECT
  USING (
    public.get_my_role() = 'commercial'
    AND created_by = auth.uid()
  );

CREATE POLICY "orders: commercial update own limited"
  ON public.orders FOR UPDATE
  USING (
    public.get_my_role() = 'commercial'
    AND created_by = auth.uid()
    AND status IN ('nuevo', 'falta_info')
  );

-- order_items
DROP POLICY IF EXISTS "order_items: creator select own" ON public.order_items;
DROP POLICY IF EXISTS "order_items: creator insert own" ON public.order_items;

CREATE POLICY "order_items: commercial select own"
  ON public.order_items FOR SELECT
  USING (
    public.get_my_role() = 'commercial'
    AND order_id IN (
      SELECT id FROM public.orders WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "order_items: commercial insert own"
  ON public.order_items FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'commercial'
    AND order_id IN (
      SELECT id FROM public.orders
      WHERE created_by = auth.uid()
      AND status IN ('nuevo', 'falta_info')
    )
  );

-- status_history
DROP POLICY IF EXISTS "status_history: creator select own" ON public.status_history;

CREATE POLICY "status_history: commercial select own"
  ON public.status_history FOR SELECT
  USING (
    public.get_my_role() = 'commercial'
    AND order_id IN (
      SELECT id FROM public.orders WHERE created_by = auth.uid()
    )
  );

-- comments
DROP POLICY IF EXISTS "comments: creator select own" ON public.comments;
DROP POLICY IF EXISTS "comments: creator insert own" ON public.comments;

CREATE POLICY "comments: commercial select own"
  ON public.comments FOR SELECT
  USING (
    public.get_my_role() = 'commercial'
    AND order_id IN (
      SELECT id FROM public.orders WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "comments: commercial insert own"
  ON public.comments FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'commercial'
    AND author_id = auth.uid()
    AND order_id IN (
      SELECT id FROM public.orders WHERE created_by = auth.uid()
    )
  );

-- -----------------------------------------------
-- 6. Policies de viewer: lectura global de orders + relacionadas
-- -----------------------------------------------

CREATE POLICY "orders: viewer read all"
  ON public.orders FOR SELECT
  USING (public.get_my_role() = 'viewer');

CREATE POLICY "order_items: viewer read all"
  ON public.order_items FOR SELECT
  USING (public.get_my_role() = 'viewer');

CREATE POLICY "status_history: viewer read all"
  ON public.status_history FOR SELECT
  USING (public.get_my_role() = 'viewer');

CREATE POLICY "comments: viewer read all"
  ON public.comments FOR SELECT
  USING (public.get_my_role() = 'viewer');

-- viewer NO tiene policies de INSERT/UPDATE/DELETE (deny-by-default).
