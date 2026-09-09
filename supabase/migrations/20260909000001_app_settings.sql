-- =============================================================================
-- Migracion: tabla generica app_settings para state persistente cross-runtime.
-- Fecha: 2026-09-09
-- Tipo: aditiva, idempotente.
-- Objetivo: guardar el timestamp del ultimo poll del cron TIPSA
--          (tipsa_last_poll_at) y cualquier futura clave/valor global de la
--          app que no encaje en otra tabla.
-- Consumidor: supabase/functions/tipsa-refresh (Edge Function con service role).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_settings IS
  'Key/value store para settings runtime (ej. cursor de crons). Solo service role.';

-- Trigger para actualizar updated_at automaticamente.
CREATE OR REPLACE FUNCTION public.app_settings_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_settings_touch ON public.app_settings;
CREATE TRIGGER app_settings_touch
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.app_settings_touch_updated_at();

-- Seed: primera ventana = ultimas 24h (backfill de estados existentes al
-- primer tick del cron). Idempotente: si ya existe, no lo pisamos.
INSERT INTO public.app_settings (key, value) VALUES
  ('tipsa_last_poll_at', to_jsonb((now() - interval '24 hours')::text))
ON CONFLICT (key) DO NOTHING;

-- RLS estricta: solo service role puede leer/escribir. Los endpoints
-- normales de la app no tocan esta tabla.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings'
      AND policyname = 'app_settings: service only'
  ) THEN
    CREATE POLICY "app_settings: service only"
      ON public.app_settings FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
