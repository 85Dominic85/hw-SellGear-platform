# Migración histórica

## Alcance
- Histórico desde mitad de 2025 hasta hoy.

## Estrategia
1. Export CSV desde Sheets.
2. Normalizar columnas.
3. Import a `orders` y `order_items`.
4. Marcar registros con `source = legacy_import`.
