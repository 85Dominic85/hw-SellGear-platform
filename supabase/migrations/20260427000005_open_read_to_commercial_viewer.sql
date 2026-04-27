-- =============================================================
-- MainOperation Platform — Lectura global para commercial y viewer
-- Migration: 20260427000005_open_read_to_commercial_viewer
-- =============================================================
-- Cambio de regla: cualquier usuario interno (commercial, viewer)
-- debe poder ver el listado de pedidos para hacer seguimiento de
-- los suyos y los de su equipo. La edicion sigue restringida a la
-- matriz original.
--
-- Tambien limpia la policy huerfana de shipping_events que aun
-- referencia 'creator' (rol eliminado) y abre user_profiles para
-- que los joins creator/assignee/changer/author resuelvan
-- correctamente desde el dashboard.
-- =============================================================

-- -----------------------------------------------
-- 1. ORDERS: commercial pasa de "solo los suyos" a "todos"
-- -----------------------------------------------

DROP POLICY IF EXISTS "orders: commercial select own"  ON public.orders;
DROP POLICY IF EXISTS "orders: commercial read all"    ON public.orders;
CREATE POLICY "orders: commercial read all"
  ON public.orders FOR SELECT
  USING (public.get_my_role() = 'commercial');

-- INSERT y UPDATE de commercial se mantienen restrictivos (definidos en
-- migracion 20260427000003): puede crear pedidos como suyos y solo
-- editar los propios en estados nuevo/falta_informacion.

-- -----------------------------------------------
-- 2. ORDER_ITEMS: commercial lectura global
-- -----------------------------------------------

DROP POLICY IF EXISTS "order_items: commercial select own" ON public.order_items;
DROP POLICY IF EXISTS "order_items: commercial read all"   ON public.order_items;
CREATE POLICY "order_items: commercial read all"
  ON public.order_items FOR SELECT
  USING (public.get_my_role() = 'commercial');

-- -----------------------------------------------
-- 3. STATUS_HISTORY: commercial lectura global
-- -----------------------------------------------

DROP POLICY IF EXISTS "status_history: commercial select own" ON public.status_history;
DROP POLICY IF EXISTS "status_history: commercial read all"   ON public.status_history;
CREATE POLICY "status_history: commercial read all"
  ON public.status_history FOR SELECT
  USING (public.get_my_role() = 'commercial');

-- -----------------------------------------------
-- 4. COMMENTS: commercial lectura global
-- -----------------------------------------------

DROP POLICY IF EXISTS "comments: commercial select own" ON public.comments;
DROP POLICY IF EXISTS "comments: commercial read all"   ON public.comments;
CREATE POLICY "comments: commercial read all"
  ON public.comments FOR SELECT
  USING (public.get_my_role() = 'commercial');

-- INSERT comentarios commercial sigue restringido (solo en pedidos propios)
-- segun migracion 20260427000003.

-- -----------------------------------------------
-- 5. SHIPPING_EVENTS: limpiar policy huerfana 'creator' + abrir commercial
-- -----------------------------------------------

DROP POLICY IF EXISTS "shipping_events: creator select own"   ON public.shipping_events;
DROP POLICY IF EXISTS "shipping_events: commercial read all"  ON public.shipping_events;
CREATE POLICY "shipping_events: commercial read all"
  ON public.shipping_events FOR SELECT
  USING (public.get_my_role() = 'commercial');

-- viewer ya tenia "shipping_events: viewer select all" desde migracion
-- 20260421000001 (esa policy SI usa el nombre correcto).

-- -----------------------------------------------
-- 6. USER_PROFILES: lectura global para commercial y viewer
-- Necesario para que los joins creator/assignee/changer/author en
-- las queries del dashboard devuelvan nombres y emails.
-- -----------------------------------------------

DROP POLICY IF EXISTS "user_profiles: commercial read all" ON public.user_profiles;
CREATE POLICY "user_profiles: commercial read all"
  ON public.user_profiles FOR SELECT
  USING (public.get_my_role() = 'commercial');

DROP POLICY IF EXISTS "user_profiles: viewer read all" ON public.user_profiles;
CREATE POLICY "user_profiles: viewer read all"
  ON public.user_profiles FOR SELECT
  USING (public.get_my_role() = 'viewer');
