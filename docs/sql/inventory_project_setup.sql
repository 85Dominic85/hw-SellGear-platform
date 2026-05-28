-- =============================================================
-- Función RPC: public.get_inventory_by_type()
-- PROYECTO DE INVENTARIO (olcxbtvjkjmofrbvzpat) — NO el principal.
--
-- Esta función vive en un Supabase separado donde están las tablas
-- hw_staging.hw_inventory y hw_staging.hw_articles. El Next.js
-- principal la consume con un cliente Supabase secundario usando
-- service_role key (server-side only).
--
-- Aplicación: pegar este SQL en el SQL Editor del proyecto
-- olcxbtvjkjmofrbvzpat (https://supabase.com/dashboard/project/
-- olcxbtvjkjmofrbvzpat/sql/new) y ejecutar.
--
-- Seguridad:
--   - El check de autorización lo hace Next.js (apps/web/app/
--     (dashboard)/inventory/page.tsx) antes de llamar la función.
--   - El cliente JS usa service_role key (en env de Vercel, no en
--     el bundle). Esto bypassa RLS — adecuado para una BD interna
--     de staging consultada desde server-only code.
--   - Si en el futuro queréis exponer al cliente con anon key,
--     habría que añadir RLS en hw_staging y un check en la función.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_inventory_by_type()
RETURNS TABLE (
  tipo_articulo TEXT,
  total_unidades_nuevas BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, hw_staging
AS $$
  SELECT
    a.article_type::TEXT AS tipo_articulo,
    COUNT(*)::BIGINT AS total_unidades_nuevas
  FROM hw_staging.hw_inventory i
  JOIN hw_staging.hw_articles a ON i.article_id = a.id
  WHERE i.estado = 'disponible'
    AND i.condicion = 'nuevo'
  GROUP BY a.article_type
  ORDER BY total_unidades_nuevas DESC;
$$;

-- Permisos: el cliente Next.js usa service_role (bypassa RLS), pero
-- también dejamos authenticated por si en el futuro queremos llamarla
-- con la sesión del usuario.
GRANT EXECUTE ON FUNCTION public.get_inventory_by_type()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_inventory_by_type() IS
  'Devuelve unidades nuevas + disponibles agrupadas por article_type. '
  'Lee de hw_staging.hw_inventory y hw_staging.hw_articles. '
  'Consumida por la app principal vía cliente secundario (service_role).';

-- =============================================================
-- Verificación: ejecuta esto en el mismo SQL Editor después de crear
-- la función. Debería devolver filas (asumiendo que hay datos en
-- hw_staging.hw_inventory con estado='disponible' y condicion='nuevo').
-- =============================================================
-- SELECT * FROM public.get_inventory_by_type();
