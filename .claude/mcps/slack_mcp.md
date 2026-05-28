# MCP: Slack

## Diseño actual (2026-05-28)

Avisos centralizados en `apps/web/lib/slack.ts` (server-side, sin edge
function). Postea directo a un Incoming Webhook del canal de Hardware.
La edge function `notify-slack` fue **retirada** (consistente con la
eliminación previa de `sync-to-sheets`: la app es la única fuente de
verdad).

## Eventos

- `new_order`: nuevo pedido creado. `@here` + categoría.
- `status_change`: solo si `to_status ∈ SLACK_NOTIFY_STATUSES`
  (`enviado_proveedor`, `enviado`, `pagado`, `falta_informacion`,
  `bloqueado`, `completado`). En `falta_informacion` se menciona al
  creador (`slack_user_id` de `user_profiles`).
- `message_to_hardware`: panel "Enviar a Hardware" desde la ficha.
  `@here` + categoría.
- `financing_payment`: cuando un plazo se marca pagado. Informativo
  (canal); puede llevar mención por categoría.

## Configuración

- **`SLACK_WEBHOOK_URL`** (Vercel env): Incoming Webhook del canal de
  Hardware. Si no está configurada, todo se silencia sin error.
- **`SLACK_CATEGORY_MENTIONS`** (Vercel env, JSON opcional):
  ```json
  {"hardware_financiacion":["U0123"],"default":["U0789"]}
  ```
- **`user_profiles.slack_user_id`** (manual): para mencionar al creador.
  Se rellena en `/admin/users` (modal de edición).

## Cómo obtener el Slack member ID

Perfil del usuario en Slack → menú `⋮` → "Copiar member ID" (empieza por
`U`). Pegar en `/admin/users` por cada compañero que deba ser mencionado.

## Garantías

- Los avisos NUNCA rompen la operación del pedido (`try/catch` en el
  caller; `lib/slack.ts` no lanza).
- Sin webhook configurado → la app funciona igual, sin errores.
- Estados rutinarios (`nuevo→pendiente`, etc.) no notifican (bajo ruido).
- `lib/slack.ts` es puro y testeado con vitest.
