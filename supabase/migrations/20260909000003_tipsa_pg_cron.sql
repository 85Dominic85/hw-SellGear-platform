-- =============================================================================
-- Migracion: pg_cron job para el sweep TIPSA cada 30 min.
-- Fecha: 2026-09-09
-- Tipo: aditiva, idempotente.
-- Objetivo: llamar automaticamente a la Edge Function tipsa-refresh cada 30
--          min via pg_cron + pg_net. Sin Vercel Pro.
--
-- PRE-REQUISITOS (setup manual en Supabase Dashboard, NO reproducibles en
-- migracion; documentados en docs/integrations/tipsa/CRON_SETUP.md):
--   1. Extensions habilitadas: pg_cron, pg_net.
--      Dashboard -> Database -> Extensions.
--   2. Custom Config (Dashboard -> Database -> Custom Postgres Config):
--        ALTER DATABASE postgres SET app.tipsa_refresh_url =
--          'https://<project-ref>.supabase.co/functions/v1/tipsa-refresh';
--        ALTER DATABASE postgres SET app.tipsa_cron_secret = '<secret>';
--   3. Reiniciar el pool de conexiones despues del ALTER DATABASE para que
--      los nuevos parametros esten disponibles en las sesiones.
--
-- Verificacion:
--   SELECT * FROM cron.job WHERE jobname = 'tipsa-refresh-30min';
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
-- =============================================================================

-- Guarda: solo intentar programar si pg_cron esta disponible. Si no, la
-- migracion no falla (soft-fail con NOTICE) — el operador aplica los
-- pre-requisitos y re-corre esta migracion.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron no habilitado — habilitar en Dashboard y re-aplicar esta migracion.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net no habilitado — habilitar en Dashboard y re-aplicar esta migracion.';
    RETURN;
  END IF;

  -- Unschedule si ya existe (idempotencia + poder cambiar el schedule).
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tipsa-refresh-30min') THEN
    PERFORM cron.unschedule('tipsa-refresh-30min');
  END IF;

  -- Schedule cada 30 min.
  PERFORM cron.schedule(
    'tipsa-refresh-30min',
    '*/30 * * * *',
    $cron$
    SELECT net.http_post(
      url := current_setting('app.tipsa_refresh_url', true),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', current_setting('app.tipsa_cron_secret', true)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    ) AS request_id;
    $cron$
  );

  RAISE NOTICE 'pg_cron job tipsa-refresh-30min programado (*/30 * * * *).';
END $$;
