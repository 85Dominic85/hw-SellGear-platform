-- =============================================================
-- MainOperation Platform — Admin role + policies
-- Migration: 20260220000001_add_admin_role
-- Añade rol 'admin' al enum user_role y políticas RLS
-- =============================================================

-- -----------------------------------------------
-- 1. Añadir valor 'admin' al enum user_role
-- -----------------------------------------------

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- -----------------------------------------------
-- 2. Políticas RLS para admin en user_profiles
-- Admin puede ver, editar y eliminar todos los perfiles
-- -----------------------------------------------

CREATE POLICY "user_profiles: admin full"
  ON public.user_profiles FOR ALL
  USING (public.get_my_role() = 'admin');

-- -----------------------------------------------
-- 3. Políticas RLS para admin en orders
-- -----------------------------------------------

CREATE POLICY "orders: admin full"
  ON public.orders FOR ALL
  USING (public.get_my_role() = 'admin');

-- -----------------------------------------------
-- 4. Políticas RLS para admin en order_items
-- -----------------------------------------------

CREATE POLICY "order_items: admin full"
  ON public.order_items FOR ALL
  USING (public.get_my_role() = 'admin');

-- -----------------------------------------------
-- 5. Políticas RLS para admin en status_history
-- -----------------------------------------------

CREATE POLICY "status_history: admin full"
  ON public.status_history FOR ALL
  USING (public.get_my_role() = 'admin');

-- -----------------------------------------------
-- 6. Políticas RLS para admin en comments
-- -----------------------------------------------

CREATE POLICY "comments: admin full"
  ON public.comments FOR ALL
  USING (public.get_my_role() = 'admin');
