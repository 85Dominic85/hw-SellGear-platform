# Integraciones

## Typeform
- Recomendado: Webhook → Edge Function → Supabase (source of truth)

## Google Sheets (MainOperation)
- La plataforma escribe/actualiza filas.
- Guardar `sheet_tab` y `sheet_row` en la BD.

## Slack
- Canal cerrado: notificar cambios de estado y entradas nuevas.

## Email a proveedor
- MVP: generador de texto + `mailto:`
- Fase 2: creación de borradores Gmail
