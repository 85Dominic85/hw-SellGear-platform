-- =============================================================
-- Función RPC: get_inventory_by_type()
-- Agrega unidades de inventario disponibles y nuevas por tipo de
-- artículo. Se expone en el schema `public` para que el cliente JS
-- pueda llamarla con `supabase.rpc('get_inventory_by_type')` sin
-- necesidad de exponer el schema `hw_staging`.
--
-- Seguridad:
--   - SECURITY DEFINER + check de rol interno dentro (admin, manager,
--     hardware, commercial). El SQL Editor con role service_role salta
--     el check (auth.uid() es null), eso es lo esperado para tests.
--   - REVOKE PUBLIC + GRANT EXECUTE a authenticated.
--
-- Aplicación: copiar y ejecutar en Supabase SQL Editor. Per CLAUDE.md
-- los archivos en supabase/migrations/ son solo trazabilidad/CI; la
-- aplicación es manual.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_inventory_by_type()
RETURNS TABLE (
  tipo_articulo TEXT,
  total_unidades_nuevas BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, hw_staging
AS $$
BEGIN
  -- Autorización: solo internos (no viewer, no anon).
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'hardware', 'commercial')
  ) THEN
    RAISE EXCEPTION 'No autorizado para consultar inventario'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      a.article_type::TEXT AS tipo_articulo,
      COUNT(*)::BIGINT AS total_unidades_nuevas
    FROM hw_staging.hw_inventory i
    JOIN hw_staging.hw_articles a ON i.article_id = a.id
    WHERE i.estado = 'disponible'
      AND i.condicion = 'nuevo'
    GROUP BY a.article_type
    ORDER BY total_unidades_nuevas DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_inventory_by_type() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_by_type() TO authenticated;

COMMENT ON FUNCTION public.get_inventory_by_type() IS
  'Devuelve unidades nuevas + disponibles agrupadas por article_type. '
  'Lee de hw_staging.hw_inventory y hw_staging.hw_articles. '
  'Acceso restringido a roles internos (admin, manager, hardware, commercial).';
