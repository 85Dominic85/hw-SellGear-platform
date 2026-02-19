# Skill: Sync Supabase → Google Sheets

## Inputs
- `order_id`
- Mapeo de columnas Sheets

## Output
- Función que hace append/update y guarda `sheet_row`

## Checklist
- Service account + sharing correcto
- Append si no hay `sheet_row`
- Update si existe `sheet_row`
- Manejar tabs (Pedidos, Kit Digital, ...)
