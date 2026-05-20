-- =============================================================
-- Anadir 'saas_hardware' al ENUM purchase_type
-- Migration: 20260520000002_add_saas_hardware_purchase_type
-- =============================================================
--
-- Las ofertas comerciales que combinan software (SaaS) con equipos
-- fisicos (Hardware) son un tipo distinto de operacion para AE/AM:
-- contractualmente y operativamente no encajan ni en 'hardware_one_off'
-- ni en 'transferencias_saas'.
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE en PostgreSQL no puede usarse
-- en la misma transaccion que lo emplea. Por eso este archivo SOLO
-- aplica el ALTER TYPE; la reescritura de get_sla_metrics que usa el
-- nuevo valor vive en 20260520000003_sla_exclude_saas_hardware.sql.
--
-- Aplicacion: ejecutar manualmente en Supabase SQL Editor (segun
-- CLAUDE.md). Idempotente via IF NOT EXISTS (PostgreSQL >= 12).
-- =============================================================

ALTER TYPE purchase_type ADD VALUE IF NOT EXISTS 'saas_hardware';
