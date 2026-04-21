# Integración TIPSA — Plan de implementación

**Autor:** Claude Code + @qamarero
**Fecha:** 2026-04-20
**Estado:** Pendiente de aprobación
**Branch destino:** `feature/mvp-foundation` (o rama hija `feature/tipsa-integration`)

---

## 1. Contexto

TIPSA (Heliopolis / Tip-SA) es la agencia de transporte que usamos. Hoy el tracking de los envíos se registra manualmente en la ficha del pedido (`orders.tracking_number`, `orders.shipping_label_url`, `orders.shipped`). Queremos **automatizar**:

1. Crear el envío en TIPSA desde el propio pedido (1 click).
2. Descargar y guardar la etiqueta PDF.
3. Consultar y mostrar el estado real del envío en el detalle (pollin) + historial de eventos.
4. (Fase futura) Webhook push si TIPSA lo soporta — a confirmar en `docs/integrations/tipsa/extracted/Documentacion/Documentación WebServices 74.0.pdf`.

La API TIPSA es **SOAP 1.1** sobre HTTPS. Credenciales por entorno:

| Entorno | URL Login | URL Métodos | CodAge | CodCli | Contraseña |
|---|---|---|---|---|---|
| Pruebas | `https://wsval.tipsa-dinapaq.com/SOAP?service=LoginWSService` | `https://wsval.tipsa-dinapaq.com/SOAP?service=WebServService` | `000000` | `33333` | (env var) |
| Producción | `https://ws.tipsa-dinapaq.com/SOAP?service=LoginWSService` | `https://ws.tipsa-dinapaq.com/SOAP?service=WebServService` | `41033` | `010` | (env var) |

> Contraseñas **nunca** van al repo. Se guardan como env vars en `.env.local` (local) y en Vercel / Supabase Secrets (deploy).

---

## 2. Decisiones (ADR condensado)

| # | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| 1 | SOAP client en **Next.js API routes** (Node.js, `fetch` + XML manual) | Edge Functions Deno | Mejor ergonomía con SOAP; TypeScript compartido con la app; Vercel hace el deploy. |
| 2 | Usar **GrabaEnvio24** (versión más reciente) | GrabaEnvio16/18 | Soporta más campos (agrupación, referencia, país destino, etc.). |
| 3 | Datos de envío **en `orders` + tabla `shipping_events`** nueva | Tabla `shipments` separada | Mantiene la UX actual (tracking inline). `shipping_events` da auditoría granular del transportista sin acoplar `orders` a él. |
| 4 | Remitente **fijo por env var** con override opcional | Editable por pedido | QR Payments sale siempre del mismo origen (Sevilla). Simplifica UX. |
| 5 | Código de servicio **seleccionable en UI** | Fijo 48 | El usuario envía en 24h/48h/sábado según pedido. |
| 6 | Polling de estados vía **Vercel Cron** cada 30 min | Supabase cron extension | Ya tenemos Vercel para la app; cron de Vercel es trivial de configurar. |
| 7 | Etiqueta PDF almacenada en **Supabase Storage** (bucket `shipping-labels`) | URL directa desde TIPSA | TIPSA devuelve PDF base64; lo persistimos nosotros para no depender de su URL/sesión. |

---

## 3. Variables de entorno (`.env.example`)

Añadir sección nueva:

```bash
# -----------------------------------------------
# TIPSA (Transporte)
# -----------------------------------------------
# Entorno: "test" (wsval) o "prod" (ws)
TIPSA_ENV=test

# Credenciales — distintas por entorno. La app usa las que apliquen según TIPSA_ENV.
TIPSA_TEST_AGENCY_CODE=000000
TIPSA_TEST_CLIENT_CODE=33333
TIPSA_TEST_PASSWORD=<solicitar>

TIPSA_PROD_AGENCY_CODE=41033
TIPSA_PROD_CLIENT_CODE=010
TIPSA_PROD_PASSWORD=<solicitar>

# Remitente fijo (Qamarero)
TIPSA_SENDER_NAME=QR PAYMENTS Qamarero
TIPSA_SENDER_ADDRESS=P.º Alcalde Marqués del Contadero, s/n, Casco Antiguo
TIPSA_SENDER_CITY=Sevilla
TIPSA_SENDER_CP=41001
TIPSA_SENDER_PHONE=602687553

# Catálogo servicios (JSON) — se puede sobrescribir sin deploy
# Formato: [{ "code": "48", "label": "24 horas" }, ...]
TIPSA_SERVICES_CATALOG=[{"code":"48","label":"24h estándar"},{"code":"10","label":"48h"},{"code":"52","label":"Sábado"},{"code":"40","label":"14h (next day)"},{"code":"01","label":"Económico"}]
```

---

## 4. Modelo de datos

### 4.1 Ampliar `orders`

**Migración:** `supabase/migrations/20260421000001_add_tipsa_fields.sql`

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS carrier              TEXT,              -- "tipsa" (futureproof)
  ADD COLUMN IF NOT EXISTS carrier_service_code TEXT,              -- "48", "10"...
  ADD COLUMN IF NOT EXISTS carrier_guid         TEXT,              -- strGuidOut TIPSA
  ADD COLUMN IF NOT EXISTS shipping_weight_kg   NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS shipping_packages    INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shipping_content     TEXT,              -- strContenido
  ADD COLUMN IF NOT EXISTS shipping_observations TEXT,             -- strObs
  ADD COLUMN IF NOT EXISTS shipped_at           TIMESTAMPTZ,       -- cuando se creó el envío
  ADD COLUMN IF NOT EXISTS tracking_public_url  TEXT,              -- URL pública TIPSA
  ADD COLUMN IF NOT EXISTS tracking_last_status TEXT,              -- último V_COD_TIPO_EST
  ADD COLUMN IF NOT EXISTS tracking_last_checked_at TIMESTAMPTZ;

-- Nota: tracking_number y shipping_label_url ya existían.
-- Reutilizamos: tracking_number = strAlbaranOut, shipping_label_url = URL de Supabase Storage.

COMMENT ON COLUMN public.orders.carrier IS 'Código transportista: "tipsa" por ahora';
COMMENT ON COLUMN public.orders.carrier_guid IS 'GUID devuelto por TIPSA (para URL pública de seguimiento)';
```

### 4.2 Nueva tabla `shipping_events` (historial TIPSA)

```sql
CREATE TABLE public.shipping_events (
  id            BIGSERIAL PRIMARY KEY,
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier       TEXT NOT NULL DEFAULT 'tipsa',
  event_code    TEXT NOT NULL,         -- V_COD_TIPO_EST (1,2,3,4...)
  event_label   TEXT,                  -- texto humano ("En tránsito", "Entregado")
  event_date    TIMESTAMPTZ NOT NULL,  -- D_FEC_HORA_ALTA de TIPSA
  raw_payload   JSONB,                 -- respuesta cruda de ConsEnvEstados por trazabilidad
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (order_id, event_code, event_date)  -- idempotencia en polling
);

CREATE INDEX idx_shipping_events_order_id ON public.shipping_events(order_id);
CREATE INDEX idx_shipping_events_date ON public.shipping_events(event_date DESC);

-- RLS: mismas reglas que orders (heredadas por FK + policies análogas)
ALTER TABLE public.shipping_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipping_events: read authenticated"
  ON public.shipping_events FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "shipping_events: insert admin/hardware"
  ON public.shipping_events FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','hardware'))
  );
```

### 4.3 Storage bucket para etiquetas

```sql
-- Bucket: shipping-labels (privado, signed URLs)
-- Se crea desde Supabase Dashboard o vía MCP.
-- Policy: solo service_role puede escribir; lectura mediante signed URL temporal.
```

---

## 5. Arquitectura

```
┌─────────────────┐
│  UI Order Detail│
│  [Crear envío]  │───┐
└─────────────────┘   │
                      ▼
┌──────────────────────────────────────────────┐
│  Next.js API Routes  (apps/web/app/api/tipsa)│
│                                              │
│  ├─ POST /create-shipment    → LoginCli +    │
│  │                             GrabaEnvio24 +│
│  │                             ConsEtiqueta  │
│  ├─ POST /refresh-tracking   → ConsEnvEstados│
│  └─ GET  /label/[orderId]    → signed URL    │
│                                              │
│  Usa lib/tipsa/* (client SOAP wrapper)       │
└──────────────────────────────────────────────┘
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
┌──────────┐   ┌────────────┐   ┌─────────────┐
│  TIPSA   │   │  Supabase  │   │   Supabase  │
│  SOAP    │   │  Postgres  │   │   Storage   │
│  API     │   │ (orders +  │   │ (labels PDF)│
│          │   │  events)   │   │             │
└──────────┘   └────────────┘   └─────────────┘

┌──────────────────────────────────────────────┐
│  Vercel Cron (cada 30 min)                   │
│  GET /api/cron/tipsa-refresh?secret=CRON_KEY │
│    └─ itera orders activos con tracking_number│
│       llama ConsEnvEstados y upserta events  │
└──────────────────────────────────────────────┘
```

### 5.1 Estructura de ficheros nuevos

```
apps/web/
├── app/api/
│   ├── tipsa/
│   │   ├── create-shipment/route.ts
│   │   ├── refresh-tracking/route.ts
│   │   └── label/[orderId]/route.ts
│   └── cron/
│       └── tipsa-refresh/route.ts
├── lib/tipsa/
│   ├── client.ts          ← wrapper SOAP (login + cache sesión)
│   ├── envelopes.ts       ← builders XML (request) + parsers (response)
│   ├── types.ts           ← TipsaShipment, TipsaEvent, TipsaService...
│   └── services.ts        ← catálogo de servicios (lee TIPSA_SERVICES_CATALOG)
└── components/orders/
    ├── CreateShipmentModal.tsx   ← formulario: servicio, bultos, peso, observaciones
    ├── ShippingTrackingPanel.tsx ← timeline de shipping_events
    └── ShippingLabelViewer.tsx   ← (ya existe, se reutiliza)
```

### 5.2 Flujo "Crear envío" (happy path)

1. Usuario pulsa **Crear envío TIPSA** en detalle del pedido.
2. Modal pide: servicio (dropdown), nº bultos (default 1), peso kg, observaciones.
3. Submit → `POST /api/tipsa/create-shipment { orderId, serviceCode, packages, weight, observations }`.
4. API route server-side:
   - Carga `order` desde Supabase (con admin client).
   - Valida permisos (hardware/admin).
   - Llama `tipsa.login()` → obtiene `sessionGuid` (cacheado 30 min en memoria).
   - Llama `tipsa.grabaEnvio24({ order, sender, serviceCode, packages, ... })` → `{ albaran, guid }`.
   - Llama `tipsa.consEtiquetaEnvio6({ albaran, formato: 'pdf' })` → PDF base64.
   - Sube PDF a Supabase Storage bucket `shipping-labels` como `order_{id}/{albaran}.pdf`.
   - `UPDATE orders SET carrier='tipsa', tracking_number=$albaran, carrier_guid=$guid, shipping_label_url=$signedUrl, shipping_weight_kg=$weight, shipping_packages=$packages, shipped_at=now(), status='enviado'`.
   - Inserta `shipping_events` inicial (event_code='1', label='Alta').
   - Notifica Slack ("Envío #OP-XXX creado — tracking 9999XXXX").
   - Devuelve `{ albaran, labelUrl, publicTrackingUrl }`.
5. UI refresca, muestra panel de tracking y botón "Ver etiqueta".

### 5.3 Flujo polling tracking

- Vercel cron `0,30 * * * *` → `GET /api/cron/tipsa-refresh?secret=$CRON_SECRET`.
- Endpoint itera:
  ```sql
  SELECT id, tracking_number FROM orders
  WHERE carrier = 'tipsa'
    AND tracking_number IS NOT NULL
    AND status NOT IN ('completado','bloqueado')
    AND (tracking_last_checked_at IS NULL OR tracking_last_checked_at < now() - interval '20 min');
  ```
- Para cada uno: `tipsa.consEnvEstados(albaran)` → parsea XML CDATA → upsert `shipping_events` (UNIQUE previene duplicados).
- Actualiza `orders.tracking_last_status` y `tracking_last_checked_at`.
- Si último estado = 2 (entregado): `UPDATE orders SET status='completado'` + notifica Slack.

### 5.4 Seguridad de la sesión TIPSA

- Sesión (GUID) se cachea **en memoria del proceso Next.js** con TTL 25 min (TIPSA expira antes de 30).
- Si `Result=false` o la siguiente llamada falla con error de sesión → login de nuevo una vez y reintento.
- **NO** se persiste la sesión en BD (corta vida, riesgo innecesario).

---

## 6. Fases de entrega

### Fase 1 — MVP funcional (objetivo inmediato)

- [ ] Migración SQL (columnas + tabla `shipping_events` + bucket Storage).
- [ ] `lib/tipsa/client.ts` con `login`, `grabaEnvio24`, `consEtiquetaEnvio6`, `consEnvEstados`.
- [ ] Tests unitarios del parser XML (mocks de respuestas reales de los ejemplos).
- [ ] API routes `create-shipment`, `refresh-tracking`, `label/[orderId]`.
- [ ] UI: modal `CreateShipmentModal`, panel `ShippingTrackingPanel`, botón en detalle.
- [ ] Env vars en `.env.example` + documentación setup.
- [ ] Probar contra entorno `wsval` con credenciales de test.

### Fase 2 — Polling automático

- [ ] Endpoint `/api/cron/tipsa-refresh` con auth por header `X-Cron-Secret`.
- [ ] `apps/web/vercel.json` → añadir `crons: [{ path: "/api/cron/tipsa-refresh", schedule: "*/30 * * * *" }]`.
- [ ] Variables `CRON_SECRET` en Vercel.
- [ ] Slack notification en cambio de estado clave (entregado / incidencia).

### Fase 3 — Producción

- [ ] Configurar `TIPSA_ENV=prod` + `TIPSA_PROD_PASSWORD` en Vercel.
- [ ] Solicitar a TIPSA la activación del entorno de producción si hay pruebas previas requeridas.
- [ ] Runbook de rollback: si TIPSA cae, fallback a creación manual (ya existe el modo actual).

### Fase 4 (opcional, futura) — Webhook push entrante

- Confirmar en PDF si TIPSA expone webhook de cambio de estado.
- Si sí: endpoint `POST /api/tipsa/webhook` con verificación de firma/origen, reemplaza parte del cron.

---

## 7. UI / UX

### Detalle de pedido — nuevo bloque lateral "Envío"

```
┌─────────────────────────────────────┐
│  Envío                              │
│                                     │
│  Estado: En tránsito (hace 2h)      │
│  Albarán: 9999154621                │
│  [Ver etiqueta] [Seguimiento ↗]     │
│                                     │
│  Timeline:                          │
│  • 20/04 17:25 Alta                 │
│  • 20/04 19:10 En tránsito          │
│                                     │
└─────────────────────────────────────┘
```

Si no hay envío aún:
```
┌─────────────────────────────────────┐
│  Envío                              │
│  [  Crear envío TIPSA  ]            │
└─────────────────────────────────────┘
```

Modal crear envío:
- Servicio (select con catálogo)
- Nº bultos (default 1)
- Peso total kg (default 1.0)
- Contenido (default "Productos hardware")
- Observaciones (opcional)
- Botones: Cancelar / Crear envío

Validaciones client + server:
- `shipping_address` del pedido debe existir y contener al menos calle + CP + población (parseo o campos separados). Si no, bloquear con mensaje "Dirección incompleta".
- `contact_email` y `phone` del pedido → se envían como `strDesDirEmails` y `strDesMoviles` en TIPSA para notificación al destinatario.

---

## 8. Seguridad

- Credenciales TIPSA **solo** en env vars server-side (nunca expuestas al cliente).
- API routes de TIPSA validan rol `hardware` o `admin` vía Supabase session.
- Bucket `shipping-labels` privado; acceso vía signed URL de 7 días.
- Cron endpoint protegido por `CRON_SECRET` (header o query param).
- Log de errores TIPSA en Supabase `integration_logs` (tabla futura) — por ahora console.error + Slack alert si falla 3 veces seguidas.

---

## 9. Testing

```bash
cd apps/web && npm test

# Nuevos tests:
# - lib/tipsa/envelopes.test.ts → builders y parsers con fixtures de docs/integrations/tipsa/extracted/Ejemplos/
# - api/tipsa/create-shipment/route.test.ts → flujo end-to-end con mock del SOAP client
```

Fixtures: usar los `.txt` de los ejemplos de TIPSA (ya descargados en `docs/integrations/tipsa/extracted/Ejemplos/`).

---

## 10. Verificación end-to-end

```bash
# 1. Aplicar migración
npx supabase db push

# 2. Crear bucket Storage
# (Dashboard → Storage → New bucket → "shipping-labels" privado)

# 3. Configurar .env.local con TIPSA_TEST_*

# 4. Arrancar dev
cd apps/web && npm run dev

# 5. Flujo manual:
# - Abrir un pedido en estado "pendiente" con dirección completa
# - Pulsar "Crear envío TIPSA"
# - Seleccionar servicio 48, 1 bulto, 1kg
# - Verificar: albarán 9999XXXX, etiqueta PDF visible, estado del pedido = "enviado"
# - Verificar en Supabase: orders.tracking_number, shipping_label_url, carrier_guid populados
# - Verificar: 1 fila en shipping_events con event_code='1'

# 6. Simular polling:
curl -H "X-Cron-Secret: $CRON_SECRET" http://localhost:3000/api/cron/tipsa-refresh
# → debería añadir eventos a shipping_events

# 7. Producción: cambiar TIPSA_ENV=prod + credenciales reales en Vercel
```

---

## 11. Archivos clave a modificar/crear

**Nuevos:**
- `supabase/migrations/20260421000001_add_tipsa_fields.sql`
- `apps/web/lib/tipsa/client.ts`
- `apps/web/lib/tipsa/envelopes.ts`
- `apps/web/lib/tipsa/types.ts`
- `apps/web/lib/tipsa/services.ts`
- `apps/web/app/api/tipsa/create-shipment/route.ts`
- `apps/web/app/api/tipsa/refresh-tracking/route.ts`
- `apps/web/app/api/tipsa/label/[orderId]/route.ts`
- `apps/web/app/api/cron/tipsa-refresh/route.ts`
- `apps/web/components/orders/CreateShipmentModal.tsx`
- `apps/web/components/orders/ShippingTrackingPanel.tsx`
- Tests correspondientes en `apps/web/__tests__/tipsa/`

**Modificados:**
- `.env.example` → añadir sección TIPSA
- `apps/web/app/(dashboard)/orders/[id]/page.tsx` → insertar `ShippingTrackingPanel`
- `apps/web/types/database.ts` → regenerar (MCP Supabase) tras migración
- `apps/web/vercel.json` → añadir cron (Fase 2)
- `README.md` → sección setup TIPSA

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| TIPSA cambia formato SOAP | Fixtures de los ejemplos oficiales + tests de parser. Si falla, detectamos en CI. |
| Sesión expira entre llamadas | Retry automático con re-login transparente en el wrapper. |
| Direcciones de pedido mal formadas | Validación previa antes de llamar a TIPSA; mensaje claro al usuario. |
| Etiqueta PDF muy grande | Storage Supabase soporta hasta 50MB por fichero — etiquetas TIPSA son <500KB. |
| Password rotada | Sola operación: actualizar env var en Vercel + redeploy. No requiere cambio de código. |
| Errores masivos en cron | Rate-limit: máximo 50 pedidos por ejecución; exponential backoff si TIPSA devuelve 5xx. |

---

## 13. Tiempo estimado

- Fase 1 (MVP funcional): **~1.5 días** de trabajo enfocado (client SOAP + API routes + UI + tests).
- Fase 2 (polling): ~0.5 día.
- Fase 3 (prod): ~2 horas (config + smoke test).
- Fase 4 (webhook): solo si aplica, ~0.5 día.

---

## 14. Herramientas del proyecto a utilizar

### 14.1 MCP activos (`.mcp.json`)

| MCP | Uso concreto en esta integración |
|---|---|
| **`supabase` MCP** (proyecto `gbuifpsgcvxmuwzoyush`) | `apply_migration` para `20260421000001_add_tipsa_fields.sql`; `execute_sql` para verificar policies/datos; `generate_typescript_types` tras la migración → regenera `apps/web/types/database.ts`; `list_tables` para confirmar estructura; `list_migrations` para auditar orden; `get_logs` si fallan edge functions. |

> MCPs documentados pero **no activos** (Gmail, Sheets, Slack): no se usan aquí. Si se necesitan (aviso email al cliente al crear envío), se activan en fase posterior.

### 14.2 Subagentes (`.claude/agents/`)

| Agente | Cuándo lo uso |
|---|---|
| **`supabase-schema-architect`** | Revisar la migración SQL (columnas nuevas en `orders` + tabla `shipping_events` + índices + RLS) antes de aplicarla. |
| **`integrations_engineer`** | Implementar `lib/tipsa/*` (cliente SOAP, envelopes XML, parsers, manejo de sesión + reintentos). |
| **`expert-nextjs-developer`** | Construir las API routes (`/api/tipsa/create-shipment`, `/refresh-tracking`, `/label/[orderId]`, `/cron/tipsa-refresh`). |
| **`frontend_nextjs`** | Componentes `CreateShipmentModal`, `ShippingTrackingPanel` (Tailwind v4, lucide-react). |
| **`backend_supabase`** | Validar RLS de `shipping_events` y uso de admin client server-side. |
| **`code-reviewer`** | Revisión final antes de cerrar cada fase (seguridad, errores, secretos, validación inputs). |
| **`debugger`** | Diagnóstico si fallan llamadas SOAP (sesión expirada, parseo CDATA, timeouts). |

### 14.3 Skills (`.claude/skills/`)

| Skill | Uso |
|---|---|
| **`create_supabase_migrations`** | Esqueleto de la migración `20260421000001_add_tipsa_fields.sql`. |
| **`implement_rls_policies`** | Políticas RLS de `shipping_events`. |
| **`typeform_webhook_edge_function`** | Referencia de patrón para API route con payload externo (útil en Fase 4). |
| **`slack_notifications`** | Reutilizar wrapper Slack en eventos "envío creado" / "entregado" / "incidencia". |
| **`testing_checklist`** | Gate antes de cerrar Fase 1. |
| **`/generate-tests` (command)** | Generar tests para `lib/tipsa/envelopes.ts` con fixtures de `docs/integrations/tipsa/extracted/Ejemplos/`. |

### 14.4 Recursos internos reutilizados

| Recurso existente | Uso |
|---|---|
| `apps/web/components/orders/ShippingLabelViewer.tsx` | Se reutiliza tal cual para mostrar etiqueta. |
| `apps/web/lib/supabase/admin.ts` | Cliente admin en API routes TIPSA. |
| Patrón de `apps/web/app/api/orders/[id]/notify-slack/route.ts` | Molde para las API routes TIPSA (auth + errores + respuesta JSON). |
| Función auth/roles existente (usada en `/api/admin/users`) | Validar `hardware`/`admin` en endpoints TIPSA. |
| Edge Function `notify-slack` | Invocada desde API routes TIPSA en eventos relevantes. |
| `vercel.json` (root `apps/web`) | Se amplía con `crons` en Fase 2. |
| `docs/integrations/tipsa/extracted/` | WSDL + ejemplos ya descargados → fixtures de tests. |

### 14.5 Dependencias externas nuevas

| Herramienta | Uso |
|---|---|
| `fetch` nativo Node.js 20 | HTTP POST SOAP (XML raw). Sin dep `soap`. |
| `fast-xml-parser` (npm, ~50KB) | Parsear respuestas SOAP. |
| Supabase Storage bucket `shipping-labels` | Etiquetas PDF privadas (signed URLs). |
| Vercel Cron | Polling Fase 2. |

### 14.6 Decisiones explícitas de no hacer

- **No** usar `npm soap` (overkill para 4 métodos, añade ~1MB).
- **No** crear agentes/skills nuevos: los existentes cubren el caso.
- **No** activar MCP Slack/Gmail en esta fase.
- **No** introducir ORM: seguimos con cliente Supabase directo.
