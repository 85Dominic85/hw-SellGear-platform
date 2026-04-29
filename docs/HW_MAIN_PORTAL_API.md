# API pública para HW Main Portal

Este documento describe el contrato del endpoint `/api/external/metrics` que MainOps expone al **HW Main Portal** (dashboard agregador de métricas Hardware).

## Resumen

- **Endpoint:** `GET https://hw-sellgear-platform.vercel.app/api/external/metrics`
- **Auth:** header `X-API-Key` con la secret compartida.
- **Tipo:** read-only. No hay escrituras.
- **Caché:** `Cache-Control: private, max-age=60`. Las métricas se refrescan como mucho cada minuto.
- **CORS:** habilitado solo desde los orígenes en `MAIN_PORTAL_ORIGIN`. Para llamadas server-to-server sin Origin, no aplica.

## Auth

```
X-API-Key: <secret de 64 caracteres hex>
```

La secret la gestiona MainOps en la env var `MAIN_PORTAL_API_KEY`. Para rotarla: cambiar la env en Vercel + redeploy + actualizar el portal HW. Se compara con `timingSafeEqual` para evitar timing attacks.

## Request

```
GET /api/external/metrics?from=2026-04-01&to=2026-04-30&purchase_type=all&recent_limit=20
```

| Param | Tipo | Default | Notas |
|---|---|---|---|
| `from` | `YYYY-MM-DD` | inicio del mes en curso (UTC) | Inclusivo |
| `to` | `YYYY-MM-DD` | hoy (UTC) | Inclusivo |
| `purchase_type` | `kit_digital \| hardware_one_off \| hardware_financiacion \| transferencias_saas \| otro \| all` | `all` | Filtra todos los agregados excepto SLA. `recent_orders` también se filtra. |
| `recent_limit` | int 1-50 | 10 | Tamaño de `recent_orders` |

## Response 200

```json
{
  "generated_at": "2026-04-29T14:32:00.000Z",
  "range": { "from": "2026-04-01", "to": "2026-04-30" },
  "kpis": {
    "total_orders": 142,
    "total_revenue": 285430.50,
    "avg_order_value": 2010.07,
    "completed_rate": 0.78
  },
  "comparison": {
    "prev_total_orders": 118,
    "prev_total_revenue": 241200.00,
    "prev_avg_order_value": 2044.07,
    "prev_completed_rate": 0.72
  },
  "time_series": {
    "orders_by_date": [
      { "date": "2026-04-01", "count": 4, "revenue": 7200.00 }
    ]
  },
  "breakdowns": {
    "by_purchase_type": [
      { "purchase_type": "hardware_one_off", "count": 80, "revenue": 160000 }
    ],
    "by_status": [
      { "status": "completado", "count": 110 }
    ],
    "by_product": [
      { "product_name": "Pack TPV Basic", "total_qty": 45, "order_count": 30 }
    ]
  },
  "sla": {
    "total_delivered": 110,
    "avg_delivery_days": 4.2,
    "on_time_pct": 0.91,
    "breached_count": 10,
    "active_at_risk": 3,
    "sla_by_week": [
      { "week_start": "2026-04-06", "count": 28, "avg_days": 3.8, "on_time_pct": 0.93 }
    ]
  },
  "recent_orders": [
    {
      "operation_id": "HW-202604-1748",
      "created_at": "2026-04-27T16:45:00Z",
      "customer_name": "KOINE CAFE S.L.",
      "venue_name": "Koine Cafe",
      "purchase_type": "transferencias_saas",
      "amount": 400.00,
      "status": "nuevo",
      "tracking_number": null
    }
  ]
}
```

### Notas sobre los campos

- `kpis.completed_rate`, `sla.on_time_pct` están en **ratio 0-1**, no porcentaje.
- `*_revenue` y `amount` están en **euros** (no céntimos).
- `comparison` compara contra el periodo inmediatamente anterior del mismo tamaño que `[from, to]`. Es `null` si no hay datos suficientes.
- `recent_orders[].status` ∈ `nuevo | pendiente | enviado_proveedor | enviado | pagado | falta_informacion | bloqueado | completado`.
- `recent_orders[].tracking_number` es `null` cuando aún no se ha creado envío.

## Errores

| Código | Cuerpo | Cuándo |
|---|---|---|
| `400` | `{ "error": "Rango from/to inválido" }` | `from > to`, formato no ISO, etc. |
| `400` | `{ "error": "purchase_type inválido" }` | Valor no enumerado |
| `401` | `{ "error": "Falta X-API-Key" }` | Header ausente |
| `403` | `{ "error": "API key inválida" }` | Header presente pero no coincide |
| `502` | `{ "error": "Error consultando métricas", "detail": "..." }` | Fallo en la BD |
| `503` | `{ "error": "Endpoint no disponible (config)" }` | `MAIN_PORTAL_API_KEY` no configurada en el deploy |

## Ejemplos

### curl

```bash
curl -sS "https://hw-sellgear-platform.vercel.app/api/external/metrics?from=2026-04-01&to=2026-04-30" \
  -H "X-API-Key: $MAIN_PORTAL_API_KEY" | jq
```

### TypeScript (cliente del portal HW)

```ts
import type { ExternalMetricsResponse } from '@hw/types' // copia los tipos de apps/web/types/external.ts

async function fetchMainOpsMetrics(): Promise<ExternalMetricsResponse> {
  const res = await fetch(
    `${process.env.MAINOPS_BASE_URL}/api/external/metrics?from=2026-04-01&to=2026-04-30`,
    {
      headers: { 'X-API-Key': process.env.MAINOPS_API_KEY! },
      // Server-to-server: si se llama desde un route handler de Next.js, OK.
      // Desde browser, asegúrate de que el origin del portal está en
      // MAIN_PORTAL_ORIGIN (CSV).
    },
  )
  if (!res.ok) {
    throw new Error(`MainOps metrics ${res.status}`)
  }
  return (await res.json()) as ExternalMetricsResponse
}
```

## Performance esperada

- Latencia p95 < 800ms (3 RPCs SQL + 1 query a `orders` en paralelo).
- El header `Cache-Control: max-age=60` permite que el CDN o el cliente cacheen un minuto. Si el portal pide cada 30s, la mitad serán cache hits.

## Cambios futuros (no rompedores hoy)

- Añadir versionado en path (`/api/external/v1/metrics`) si se prevén breaking changes.
- Añadir logging por API key (tabla `external_api_calls`) si hace falta auditoría.
- Webhook saliente complementario para eventos críticos (nuevo pedido, breach SLA) si se prefiere push sobre poll.
