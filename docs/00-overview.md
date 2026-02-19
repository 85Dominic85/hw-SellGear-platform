# Visión general

Esta plataforma centraliza la gestión de pedidos/operaciones que hoy se registran en **MainOperation (Google Sheets)**.

## Dolor actual
- La información llega por Slack/DM/1:1.
- Errores por datos incompletos o mal introducidos.
- Lentitud y dificultad para encontrar el estado real.

## Solución
- **Supabase** como fuente de verdad.
- Ingesta validada (Typeform → BD).
- Flujo por estados, asignación, auditoría.
- Sync hacia Sheets mientras exista dependencia.
