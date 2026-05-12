# TIPSA Integration — Handoff Status

**Última actualización:** 2026-04-20 (noche)
**Estado:** Fase 1 implementada · bloqueada en smoke test por credenciales TIPSA
**Quién retoma:** Domingo (otro ordenador, mañana)

---

## TL;DR para la próxima sesión de Claude

1. **Lee este archivo + [PLAN.md](./PLAN.md) primero.** Todo el contexto está ahí.
2. El código de la Fase 1 está **completo y en `feature/mvp-foundation`**. El usuario tendrá que hacer `git pull` en el ordenador nuevo.
3. El bloqueo actual es **credenciales TIPSA**: Heliopolis (@tip-sa.com) nos dio unas credenciales que `wsval.tipsa-dinapaq.com` rechaza con `1: Cliente o password incorrecto.`. Se les escribió un email pidiendo confirmación.
4. Cuando Heliopolis responda con credenciales válidas, el flujo es: actualizar `TIPSA_TEST_*` en `.env.local`, reiniciar `pnpm dev`, abrir pedido → pulsar **Crear envío TIPSA**. Debería funcionar a la primera.

---

## Qué hay hecho (Fase 1 completa)

### Código
- **SOAP client** en `apps/web/lib/tipsa/`:
  - `types.ts` — tipos TipsaConfig, TipsaCreateShipmentInput, etc.
  - `services.ts` — URLs por entorno, catálogo de servicios, event labels, helper `loadTipsaConfig()`
  - `envelopes.ts` — builders XML + parsers para Login, GrabaEnvio24, ConsEtiquetaEnvio6, ConsEnvEstados
  - `client.ts` — wrapper HTTP con cache de sesión 25 min + relogin automático si expira

- **3 API routes** en `apps/web/app/api/tipsa/`:
  - `create-shipment/route.ts` — Login + GrabaEnvio24 + ConsEtiquetaEnvio6 + upload a Storage + update orders + insert shipping_events + notify Slack
  - `refresh-tracking/route.ts` — ConsEnvEstados + upsert shipping_events con UNIQUE idempotente
  - `label/[orderId]/route.ts` — genera signed URL del PDF en Storage (5 min)

- **UI** en `apps/web/components/orders/`:
  - `CreateShipmentModal.tsx` — form modal (servicio, bultos, peso, contenido, observaciones)
  - `ShippingTrackingPanel.tsx` — sidebar del pedido: CTA crear envío o timeline de tracking
  - Integrado en `app/(dashboard)/orders/[id]/page.tsx` (solo no-viewers)

- **Tests** en `apps/web/__tests__/tipsa-envelopes.test.ts`:
  - 20 tests nuevos con fixtures reales de `docs/integrations/tipsa/extracted/Ejemplos/`
  - Todos pasan. El único test que falla en el repo es `STATUS_TRANSITIONS > every status can transition to all others` y **NO es de TIPSA** (pre-existente).

### Supabase (ya aplicado en producción, project `gbuifpsgcvxmuwzoyush`)
- **Migración** `supabase/migrations/20260421000001_add_tipsa_fields.sql` aplicada vía SQL Editor:
  - 11 columnas nuevas en `orders` (`carrier`, `carrier_guid`, `tracking_public_url`, `shipped_at`, etc.)
  - Tabla `shipping_events` con UNIQUE idempotente + 5 policies RLS + publicación en `supabase_realtime`
  - Índice `idx_orders_carrier_tracking` para el cron de polling Fase 2
- **Storage bucket `shipping-labels`** creado (privado, 10 MB, MIME `application/pdf`)

### Configuración
- `.env.example` actualizado con sección TIPSA completa
- `apps/web/types/database.ts` actualizado con los 11 nuevos campos de `Order` + interfaz `ShippingEvent`
- Dep nueva: `fast-xml-parser`

### Docs
- [PLAN.md](./PLAN.md) — plan completo secciones 1-14 (incluye qué agentes/skills/MCPs del proyecto se usan)
- [extracted/](./extracted/) — WSDL + PDFs oficiales + ejemplos SOAP (fixtures de tests)
- [webservices.zip](./webservices.zip) — bundle original de TIPSA

---

## Qué está bloqueado

### Smoke test end-to-end no pasa

Con las credenciales facilitadas por Heliopolis (`041033 / 010 / Paymer26.`), TIPSA responde:

```xml
<SOAP-ENV:Fault>
  <faultcode>Exception</faultcode>
  <faultstring>1: Cliente o password incorrecto.</faultstring>
</SOAP-ENV:Fault>
```

Hemos verificado:
- Los datos llegan correctamente al SOAP envelope (agency `041033`, client `010`, password `Paymer26.` sin transformar).
- Variante client code padded a `000010` → mismo error.
- Variante agency sin leading zero (`41033`) → mismo error.

Es un problema de provisioning/credenciales lado TIPSA, no de código nuestro.

### Email enviado a Heliopolis

Contenido del email mandado a `heliopolis@tip-sa.com` con el payload SOAP exacto y la respuesta, pidiendo que confirmen si la cuenta está activada en `wsval`.

---

## Qué hacer cuando Heliopolis responda

1. Abrir `apps/web/.env.local` y actualizar las 3 líneas:
   ```bash
   TIPSA_TEST_AGENCY_CODE=<el-correcto>
   TIPSA_TEST_CLIENT_CODE=<el-correcto>
   TIPSA_TEST_PASSWORD=<el-correcto>
   ```
2. `Ctrl+C` en la terminal del `pnpm dev` → `pnpm dev` (Next.js lee `.env.local` solo al arrancar).
3. Refrescar el navegador, abrir un pedido con `shipping_address` que tenga CP de 5 dígitos (ej: `Calle Betis 12, 41010 Sevilla`).
4. Sidebar → **Crear envío TIPSA** → servicio `24h estándar (48)`, 1 bulto, 1 kg → **Crear**.

**Debería funcionar a la primera.** Verificar:
- Modal cierra sin error.
- Panel "Envío" muestra albarán `9999XXXXXX`, estado "Alta", timeline 1 evento.
- Botón **Ver etiqueta** abre un PDF de TIPSA (aunque sea sandbox, es válido).
- En Supabase: `orders.tracking_number` populado + 1 fila en `shipping_events`.

Si falla con el mismo Fault: el provisioning sigue sin estar OK, reenganchar con Heliopolis.

---

## Siguiente fase tras smoke test OK

### Fase 2 — Polling automático (0.5 día)

- Endpoint nuevo: `apps/web/app/api/cron/tipsa-refresh/route.ts` → itera pedidos activos con `tracking_number` y hace `ConsEnvEstados` para cada uno.
- Añadir `vercel.json` en `apps/web/` → sección `crons: [{ path: "/api/cron/tipsa-refresh", schedule: "*/30 * * * *" }]`.
- Env var `TIPSA_CRON_SECRET` (ya declarada en `.env.example`, generar con `openssl rand -hex 32`).
- Detalles en PLAN.md sección 5.3.

### Fase 3 — Producción (2h)

- Confirmar con Heliopolis las credenciales de prod (distintas de las de test — hoy tenemos `Qpayments26.` de la primera tanda pero probablemente obsoleta).
- Setear `TIPSA_ENV=prod` + `TIPSA_PROD_PASSWORD` en Vercel Env Vars.
- Redeploy.

### Fase 4 — Webhook push entrante (opcional)

- Confirmar en `docs/integrations/tipsa/extracted/Documentacion/Documentación WebServices 74.0.pdf` si TIPSA ofrece webhook push.
- Si sí: endpoint `POST /api/tipsa/webhook` reemplaza parte del cron.

---

## Para la próxima sesión de Claude

- **Rama actual**: `feature/mvp-foundation`. El commit con toda la Fase 1 TIPSA es el último de la rama (mensaje: `feat: TIPSA Dinapaq integration (fase 1)`).
- **Memoria Claude local**: en la máquina nueva no estará hasta que Domingo la restaure desde Bitwarden o la reconstruya. Si no está, empieza leyendo este archivo + `PLAN.md` + `docs/integrations/tipsa/extracted/Documentacion/Documentación WebServices 74.0.pdf` para el contexto TIPSA completo.
- **Credenciales**: están en `apps/web/.env.local` (gitignored). Domingo las restaura desde su Bitwarden al arrancar.
- **Supabase MCP**: el token en `.mcp.json` estaba expirado el 2026-04-20. Si Domingo renovó, funcionará. Si no, sigue aplicando cambios SQL vía Dashboard.
