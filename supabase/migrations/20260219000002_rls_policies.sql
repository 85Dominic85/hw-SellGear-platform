-- =============================================================
-- MainOperation Platform — Políticas RLS
-- Migration: 20260219000002_rls_policies
-- Principio: deny-by-default, roles creator / hardware / manager
-- =============================================================

-- -----------------------------------------------
-- HELPER: obtener rol del usuario actual
-- -----------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- -----------------------------------------------
-- Activar RLS en todas las tablas
-- -----------------------------------------------

ALTER TABLE public.user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments        ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------
-- user_profiles
-- -----------------------------------------------

-- Cada usuario ve y edita su propio perfil
CREATE POLICY "user_profiles: own read"
  ON public.user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "user_profiles: own update"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid());

-- Hardware ve todos los perfiles (para asignación)
CREATE POLICY "user_profiles: hardware read all"
  ON public.user_profiles FOR SELECT
  USING (public.get_my_role() IN ('hardware', 'manager'));

-- -----------------------------------------------
-- orders
-- -----------------------------------------------

-- creator: sólo INSERT y ver/editar los suyos
CREATE POLICY "orders: creator insert"
  ON public.orders FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'creator'
    AND created_by = auth.uid()
  );

CREATE POLICY "orders: creator select own"
  ON public.orders FOR SELECT
  USING (
    public.get_my_role() = 'creator'
    AND created_by = auth.uid()
  );

-- creator puede actualizar notas/datos propios si status es 'nuevo' o 'falta_info'
CREATE POLICY "orders: creator update own limited"
  ON public.orders FOR UPDATE
  USING (
    public.get_my_role() = 'creator'
    AND created_by = auth.uid()
    AND status IN ('nuevo', 'falta_info')
  );

-- hardware: acceso total
CREATE POLICY "orders: hardware full"
  ON public.orders FOR ALL
  USING (public.get_my_role() = 'hardware');

-- manager: lectura global
CREATE POLICY "orders: manager read all"
  ON public.orders FOR SELECT
  USING (public.get_my_role() = 'manager');

-- -----------------------------------------------
-- order_items
-- -----------------------------------------------

-- creator: ver ítems de sus propios pedidos
CREATE POLICY "order_items: creator select own"
  ON public.order_items FOR SELECT
  USING (
    public.get_my_role() = 'creator'
    AND order_id IN (
      SELECT id FROM public.orders WHERE created_by = auth.uid()
    )
  );

-- creator: insertar ítems en sus propios pedidos (status nuevo)
CREATE POLICY "order_items: creator insert own"
  ON public.order_items FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'creator'
    AND order_id IN (
      SELECT id FROM public.orders
      WHERE created_by = auth.uid()
      AND status IN ('nuevo', 'falta_info')
    )
  );

-- hardware: acceso total
CREATE POLICY "order_items: hardware full"
  ON public.order_items FOR ALL
  USING (public.get_my_role() = 'hardware');

-- manager: lectura global
CREATE POLICY "order_items: manager read all"
  ON public.order_items FOR SELECT
  USING (public.get_my_role() = 'manager');

-- -----------------------------------------------
-- status_history
-- -----------------------------------------------

-- creator: ver historial de sus pedidos
CREATE POLICY "status_history: creator select own"
  ON public.status_history FOR SELECT
  USING (
    public.get_my_role() = 'creator'
    AND order_id IN (
      SELECT id FROM public.orders WHERE created_by = auth.uid()
    )
  );

-- hardware: acceso total
CREATE POLICY "status_history: hardware full"
  ON public.status_history FOR ALL
  USING (public.get_my_role() = 'hardware');

-- manager: lectura global
CREATE POLICY "status_history: manager read all"
  ON public.status_history FOR SELECT
  USING (public.get_my_role() = 'manager');

-- -----------------------------------------------
-- comments
-- -----------------------------------------------

-- creator: ver comentarios de sus pedidos
CREATE POLICY "comments: creator select own"
  ON public.comments FOR SELECT
  USING (
    public.get_my_role() = 'creator'
    AND order_id IN (
      SELECT id FROM public.orders WHERE created_by = auth.uid()
    )
  );

-- creator: puede añadir comentarios en sus pedidos
CREATE POLICY "comments: creator insert own"
  ON public.comments FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'creator'
    AND author_id = auth.uid()
    AND order_id IN (
      SELECT id FROM public.orders WHERE created_by = auth.uid()
    )
  );

-- hardware: acceso total
CREATE POLICY "comments: hardware full"
  ON public.comments FOR ALL
  USING (public.get_my_role() = 'hardware');

-- manager: lectura global
CREATE POLICY "comments: manager read all"
  ON public.comments FOR SELECT
  USING (public.get_my_role() = 'manager');

-- -----------------------------------------------
-- SERVICE ROLE: bypass RLS para edge functions
-- Las Edge Functions usan SUPABASE_SERVICE_ROLE_KEY
-- y operan con permisos de superusuario (bypass RLS).
-- No necesitan policies adicionales.
-- -----------------------------------------------
