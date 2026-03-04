-- Allow managers to update orders (e.g. toggle invoiced checkbox)
CREATE POLICY "orders: manager update all"
  ON public.orders FOR UPDATE
  USING (public.get_my_role() = 'manager');
