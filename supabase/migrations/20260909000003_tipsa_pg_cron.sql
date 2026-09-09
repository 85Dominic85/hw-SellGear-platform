-- =============================================================================
-- Migracion: pg_cron job para el sweep TIPSA cada 30 min.
-- Fecha: 2026-09-09
-- Tipo: aditiva, idempotente.
-- Objetivo: llamar automaticamente a la Edge Function tipsa-refresh cada 30
--          min via pg_cron + pg_net. Sin Vercel Pro.
--
-- PRE-REQUISITOS:
--   1. Extensions habilitadas: pg_cron, pg_net (Dashboard -> Database -> Extensions).
--   2. Secretos en Supabase Vault. Supabase NO permite `ALTER DATABASE ... SET`
--      (error 42501: permission denied to set parameter) porque el rol postgres
--      no es superusuario, asi que la URL y el secret viven en el Vault:
--
--        SELECT vault.create_secret(
--          'https://<project-ref>.supabase.co/functions/v1/tipsa-refresh',
--          'tipsa_refresh_url',
--          'URL Edge Function cron TIPSA');
--
--        SELECT vault.create_secret(
--          '<openssl rand -hex 32>',
--          'tipsa_cron_secret',
--          'Secret cabecera X-Cron-Secret del cron TIPSA');
--
--      El mismo valor de tipsa_cron_secret debe existir como env var
--      TIPSA_CRON_SECRET en la Edge Function.
--
-- Verificacion:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'tipsa-refresh-30min';
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
-- =============================================================================

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

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'tipsa_refresh_url'
  ) THEN
    RAISE NOTICE 'Falta el secreto tipsa_refresh_url en Vault — crearlo y re-aplicar.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'tipsa_cron_secret'
  ) THEN
    RAISE NOTICE 'Falta el secreto tipsa_cron_secret en Vault — crearlo y re-aplicar.';
    RETURN;
  END IF;

  -- Unschedule si ya existe (idempotencia + poder cambiar el schedule).
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tipsa-refresh-30min') THEN
    PERFORM cron.unschedule('tipsa-refresh-30min');
  END IF;

  -- Schedule cada 30 min. URL y secret se leen del Vault en cada ejecucion,
  -- asi que rotar el secret no requiere reprogramar el job.
  PERFORM cron.schedule(
    'tipsa-refresh-30min',
    '*/30 * * * *',
    $cron$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'tipsa_refresh_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'tipsa_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    ) AS request_id;
    $cron$
  );

  RAISE NOTICE 'pg_cron job tipsa-refresh-30min programado (*/30 * * * *).';
END $$;
