-- =============================================================================
-- Migracion: pg_cron job para el sweep TIPSA cada 30 min.
-- Fecha: 2026-09-09
-- Tipo: aditiva, idempotente.
--
-- El job hace un POST a /api/cron/tipsa-refresh de la app en Vercel. NO a una
-- Edge Function: Vercel ya tiene configuradas las credenciales TIPSA (las usa
-- /api/tipsa/create-shipment), asi que evitamos duplicarlas en Supabase y
-- reutilizamos lib/tipsa/client.ts en vez de mantener un segundo cliente SOAP
-- escrito para Deno.
--
-- PRE-REQUISITOS:
--   1. Extensions pg_cron y pg_net habilitadas
--      (Dashboard -> Database -> Extensions).
--   2. Dos secretos en Supabase Vault. Supabase NO permite
--      `ALTER DATABASE ... SET` (error 42501: permission denied to set
--      parameter) porque el rol postgres no es superusuario, de ahi el Vault:
--
--        SELECT vault.create_secret(
--          'https://hw-sell-gear-platform-tsm1.vercel.app/api/cron/tipsa-refresh',
--          'tipsa_refresh_url',
--          'Endpoint del cron TIPSA en Vercel');
--
--        SELECT vault.create_secret(
--          '<openssl rand -hex 32>',
--          'tipsa_cron_secret',
--          'Secret de la cabecera X-Cron-Secret');
--
--   3. La MISMA cadena de tipsa_cron_secret como env var TIPSA_CRON_SECRET
--      en Vercel. Si no coinciden, cada ejecucion responde 401.
--
-- Para rotar el secret basta con actualizar el Vault y Vercel; el job lee el
-- valor en cada ejecucion, no hay que reprogramarlo.
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

  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'tipsa_refresh_url') THEN
    RAISE NOTICE 'Falta el secreto tipsa_refresh_url en Vault — crearlo y re-aplicar.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'tipsa_cron_secret') THEN
    RAISE NOTICE 'Falta el secreto tipsa_cron_secret en Vault — crearlo y re-aplicar.';
    RETURN;
  END IF;

  -- Idempotencia: reprogramar si ya existia (permite cambiar el schedule).
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tipsa-refresh-30min') THEN
    PERFORM cron.unschedule('tipsa-refresh-30min');
  END IF;

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
