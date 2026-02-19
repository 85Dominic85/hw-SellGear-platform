# Skill: Crear migraciones Supabase

## Inputs
- Modelo de datos (docs/30-data-model.md)

## Output
- Archivos SQL en `supabase/migrations/`

## Checklist
- Tablas: orders, order_items, status_history
- Índices: operation_id, status, created_at
- Constraints: NOT NULL en campos obligatorios
- Seed básico: estados
