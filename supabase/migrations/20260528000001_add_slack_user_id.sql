-- =============================================================
-- Añade slack_user_id a user_profiles para menciones en Slack.
-- Migration: 20260528000001_add_slack_user_id
-- Tipo: aditiva (columna nullable). No rompe datos existentes.
-- =============================================================
--
-- Se usa en lib/slack.ts (notifyOrderEvent) para mencionar al creador
-- del pedido en eventos como status_change → falta_informacion.
--
-- Formato esperado: Slack member ID (empieza por "U" + alfanumérico).
-- Cómo obtenerlo: perfil en Slack → ⋮ → "Copiar member ID".
--
-- Aplicar MANUALMENTE en Supabase SQL Editor (CLAUDE.md - cambios SQL
-- siempre manuales). Verificar después con:
--   SELECT id, email, slack_user_id FROM public.user_profiles LIMIT 5;
-- =============================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

COMMENT ON COLUMN public.user_profiles.slack_user_id IS
  'Slack member ID (U…) para menciones en avisos. Manual. Ver lib/slack.ts.';

-- Rollback manual si fuera necesario:
--   ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS slack_user_id;
