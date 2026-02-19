# MainOperation Platform — Hardware Ops

Plataforma interna para centralizar y controlar la operativa de **MainOperation** en el departamento de Hardware.

**Supabase es la fuente de la verdad. Google Sheets es el espejo.**

## Estado del MVP

- [x] Schema Supabase + RLS (3 migraciones)
- [x] Edge Functions: Typeform webhook, Sheets sync, Slack notify
- [x] App web Next.js: Auth, Inbox, Detalle, Nuevo pedido
- [x] Script migración histórica desde CSV
- [x] Tests (36 passing)

---

## Setup local (10 minutos)

### 1. Variables de entorno

```bash
# Copiar y rellenar con valores reales
cp .env.example apps/web/.env.local
```

Variables requeridas en `apps/web/.env.local`:
| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (pública) |
| `NEXT_PUBLIC_APP_URL` | URL de la app (ej: http://localhost:3000) |

Variables requeridas en Edge Functions (Supabase Dashboard → Settings → Edge Functions):
| Variable | Descripción |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo servidor) |
| `GOOGLE_SHEET_ID` | ID del spreadsheet MainOperation |
| `GOOGLE_SERVICE_ACCOUNT_B64` | Service account JSON en base64 |
| `TYPEFORM_WEBHOOK_SECRET` | Secret HMAC del webhook Typeform |
| `SLACK_WEBHOOK_URL` | Webhook URL del canal Hardware |
| `NEXT_PUBLIC_APP_URL` | URL pública (para enlaces en Slack) |

### 2. Supabase — aplicar migraciones

```bash
# Con Supabase CLI
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push

# O manualmente: copiar y ejecutar en Supabase SQL Editor:
# supabase/migrations/20260219000001_create_schema.sql
# supabase/migrations/20260219000002_rls_policies.sql
# supabase/migrations/20260219000003_seed_statuses.sql
```

### 3. Auth Google — Supabase Dashboard

1. Supabase → Authentication → Providers → Google
2. Habilitar y añadir `Client ID` + `Client Secret` de Google Cloud Console
3. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`

### 4. App web

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

### 5. Deploy Edge Functions

```bash
npx supabase functions deploy typeform-webhook
npx supabase functions deploy sync-to-sheets
npx supabase functions deploy notify-slack
```

### 6. Configurar webhook en Typeform

- URL: `https://<project-ref>.supabase.co/functions/v1/typeform-webhook`
- Secret: el valor de `TYPEFORM_WEBHOOK_SECRET`
- Evento: `form_response`

**Importante:** Los `ref` de los campos del formulario Typeform deben coincidir con los de `FIELD_MAP` en `supabase/functions/typeform-webhook/index.ts`. Ajustar según el formulario real.

### 7. Google Service Account

1. Google Cloud Console → IAM → Service Accounts → crear cuenta
2. Compartir el spreadsheet MainOperation con el email de la service account (rol Editor)
3. Descargar JSON → convertir a base64: `base64 -i service-account.json`
4. Guardar el resultado como `GOOGLE_SERVICE_ACCOUNT_B64`

---

## Estructura del repositorio

```
├── .claude/          # Config Claude Code (agentes, skills, MCPs)
├── apps/
│   └── web/          # Next.js app (TypeScript + Tailwind)
│       ├── app/      # App Router: login, orders inbox, detail, new
│       ├── components/orders/  # OrdersTable, StatusBadge, etc.
│       ├── lib/supabase/       # Clients (browser, server, middleware)
│       └── types/    # TypeScript types del schema
├── docs/             # Requisitos, arquitectura, modelo de datos
├── scripts/          # migrate-from-sheets.ts (importación histórica)
└── supabase/
    ├── functions/    # Edge Functions (Deno)
    │   ├── typeform-webhook/
    │   ├── sync-to-sheets/
    │   └── notify-slack/
    └── migrations/   # SQL migrations (aplicar en orden)
```

## Tests

```bash
cd apps/web
npm test          # 36 tests (typeform parsing, sheets sync, utils)
npm run test:coverage
```

## Migración histórica

Ver `scripts/README.md` para importar datos desde CSV exportado de Google Sheets.

## Convenciones

- Commits pequeños y descriptivos.
- Supabase manda, Sheets es espejo — nunca editar Sheets manualmente y esperar que se propague.
- Secrets: nunca subir `.env` / `.env.local` al repo.
- Decisiones de arquitectura: documentar en `docs/` (ADR ligero).

