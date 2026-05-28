# Integraciones

## Typeform
- Webhook → Edge Function (`supabase/functions/typeform-webhook/`) → Supabase.

## Slack (avisos al canal de Hardware)

Server-side desde [`apps/web/lib/slack.ts`](../apps/web/lib/slack.ts) (no
hay edge function; se retiró en 2026-05-28). Postea directo al Incoming
Webhook del canal con menciones.

**Eventos**: `new_order`, `status_change` (solo `SLACK_NOTIFY_STATUSES`:
`enviado_proveedor`, `enviado`, `pagado`, `falta_informacion`,
`bloqueado`, `completado`), `message_to_hardware`, `financing_payment`.

**Menciones**: `@here` (canal Hardware) + creador (`slack_user_id` en
`user_profiles`) en `falta_informacion` + personas fijas por categoría
(env `SLACK_CATEGORY_MENTIONS`, JSON).

**Configuración**:
- `SLACK_WEBHOOK_URL` (Vercel env). Sin esto, los avisos se silencian.
- `SLACK_CATEGORY_MENTIONS` (Vercel env, JSON, opcional).
- `user_profiles.slack_user_id` (manual, `/admin/users`).

Detalle completo: [`.claude/mcps/slack_mcp.md`](../.claude/mcps/slack_mcp.md).

## Email a proveedor
- MVP: generador de texto + `mailto:`
- Fase 2: creación de borradores Gmail
