-- =============================================================================
-- Migracion: publicar shipments en supabase_realtime.
-- Fecha: 2026-09-09
-- Tipo: aditiva, idempotente.
-- Objetivo: la vista /tracking debe reaccionar a cambios en shipments (envios
--          libres SH-*) igual que ya reacciona a orders. Sin esto, un delta
--          del cron a shipments.tracking_last_status no llega al front.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shipments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
  END IF;
END $$;
