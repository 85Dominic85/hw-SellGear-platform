-- =============================================================
-- MainOperation Platform — Eliminar columna contact_person
-- Migration: 20260427000004_drop_contact_person
-- =============================================================
-- El campo redunda con customer_name / venue_name. Se elimina del UI
-- y del modelo. Para TIPSA strPersContacto seguimos enviando el
-- customer_name desde el endpoint create-shipment.
-- Idempotente: en prod nunca se aplico la 20260424000001 (la columna
-- no existe), en local si.
-- =============================================================

ALTER TABLE public.orders DROP COLUMN IF EXISTS contact_person;
