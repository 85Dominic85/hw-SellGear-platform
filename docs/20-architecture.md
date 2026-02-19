# Arquitectura

## Propuesta
- Frontend: Next.js (TypeScript)
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions)
- Integraciones: Typeform Webhook, Google Sheets API, Slack Webhook

## Flujo (MVP)
1. Typeform → Webhook
2. Edge Function valida payload
3. Inserta/actualiza en Supabase
4. Sincroniza a Google Sheets (append/update)
5. Notifica Slack en eventos relevantes
