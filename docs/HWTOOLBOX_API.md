# API pública para HWToolbox

Este documento describe el contrato de los endpoints `/api/external/hwtoolbox/*` que MainOps expone a **HWToolbox** (gestión de inventario interna).

HWToolbox lo consume cuando un usuario crea una transacción de salida de inventario y necesita asociarla a un pedido existente de MainOps: primero **lista** los pedidos disponibles para que el usuario seleccione uno, luego pide el **detalle** completo del seleccionado.

## Resumen

- **Endpoints:**
  - `GET /api/external/hwtoolbox/orders` — listado paginado.
  - `GET /api/external/hwtoolbox/orders/{operation_id}` — detalle.
- **Base URL producción:** `https://hw-sellgear-platform.vercel.app`
- **Auth:** header `X-API-Key` con la secret compartida.
- **Tipo:** read-only. No hay escrituras desde HWToolbox.
- **Scope:** solo pedidos en estado `enviado_proveedor`, `enviado`, `completado` o `bloqueado`. Pedidos `nuevo`, `pendiente`, `falta_informacion` y `pagado` **no son visibles** (devuelven 404 en detalle, no aparecen en listado).
- **Caché:** `Cache-Control: private, max-age=30`.
- **CORS:** habilitado solo desde los orígenes en `HWTOOLBOX_ORIGIN`. Para llamadas server-to-server sin Origin, no aplica.

## Autenticación

```
X-API-Key: <secret de 64 caracteres hex>
```

La secret la gestiona MainOps en la env var `HWTOOLBOX_API_KEY`. Para rotarla: cambiar la env en Vercel + redeploy + actualizar HWToolbox. Se compara con `timingSafeEqual` (no vulnerable a timing attacks).

Códigos:
- `401 Unauthorized` — falta header `X-API-Key`.
- `403 Forbidden` — key no coincide.
- `503 Service Unavailable` — env var `HWTOOLBOX_API_KEY` no configurada en MainOps.

---

## `GET /api/external/hwtoolbox/orders` — listado

```
GET /api/external/hwtoolbox/orders?q=Pepe&purchase_type=hardware_one_off&from=2026-04-01&to=2026-05-08&limit=25&offset=0
```

| Param | Tipo | Default | Notas |
|---|---|---|---|
| `q` | string | — | Búsqueda fuzzy (ILIKE) en `operation_id`, `customer_name`, `venue_name`. |
| `purchase_type` | enum | — | `kit_digital \| hardware_one_off \| hardware_financiacion \| transferencias_saas \| otro` |
| `from` | `YYYY-MM-DD` | — | Filtro inclusivo sobre `created_at`. |
| `to` | `YYYY-MM-DD` | — | Filtro inclusivo sobre `created_at`. |
| `limit` | int 1-50 | 25 | Tamaño de página. |
| `offset` | int ≥ 0 | 0 | Para paginar. |

Filtro implícito siempre presente: `status IN ('enviado_proveedor','enviado','completado','bloqueado')`. Ordenado por `created_at` descendente.

### Response 200

```json
{
  "generated_at": "2026-05-08T12:00:00.000Z",
  "pagination": { "total": 245, "limit": 25, "offset": 0 },
  "orders": [
    {
      "operation_id": "HW-202605-0001",
      "customer_name": "Bar Pepe",
      "venue_name": "Bar Pepe Sevilla",
      "purchase_type": "hardware_one_off",
      "status": "enviado",
      "amount": 603.79,
      "created_at": "2026-05-01T10:23:00.000Z"
    }
  ]
}
```

`amount` es el total con IVA en euros (puede ser `null` para pedidos legacy sin items).

### Errores

- `400` — `purchase_type` inválido, `from`/`to` mal formateados o `from > to`.
- `401`/`403` — auth.
- `502` — error consultando la base de datos.
- `503` — config ausente.

### Ejemplo curl

```bash
curl -H "X-API-Key: $HWTOOLBOX_API_KEY" \
     "https://hw-sellgear-platform.vercel.app/api/external/hwtoolbox/orders?q=Pepe&limit=10"
```

### Ejemplo TypeScript

```ts
import type { HwToolboxListResponse } from './types/hwtoolbox'

const res = await fetch(
  'https://hw-sellgear-platform.vercel.app/api/external/hwtoolbox/orders?limit=25',
  { headers: { 'X-API-Key': process.env.MAINOPS_API_KEY! } },
)
if (!res.ok) throw new Error(`MainOps error ${res.status}`)
const data = (await res.json()) as HwToolboxListResponse
```

---

## `GET /api/external/hwtoolbox/orders/{operation_id}` — detalle

Path param: `operation_id` con formato legible `HW-YYYYMM-NNNN` (ej. `HW-202605-0001`).

Si el pedido no existe **o** está en un estado no visible (borrador): respuesta uniforme `404` para evitar leak de existencia.

### Response 200

```json
{
  "generated_at": "2026-05-08T12:00:00.000Z",
  "order": {
    "operation_id": "HW-202605-0001",
    "customer_name": "Bar Pepe",
    "venue_name": "Bar Pepe Sevilla",
    "purchase_type": "hardware_one_off",
    "purchase_type_label": "Hardware One Off",
    "status": "enviado",
    "created_at": "2026-05-01T10:23:00.000Z",
    "ae": {
      "full_name": "María García",
      "email": "maria.garcia@qamarero.com",
      "ae_ref": "AE-1234"
    },
    "items": [
      {
        "product_code": "tpv-pack-essential",
        "product_name": "Pack TPV Esencial",
        "qty": 1,
        "unit_price_cents": 49900,
        "vat_rate": 21.00,
        "discount_pct": 0,
        "subtotal_cents": 49900,
        "vat_amount_cents": 10479,
        "total_cents": 60379,
        "currency": "EUR"
      }
    ],
    "totals": {
      "subtotal_cents": 49900,
      "discount_cents": 0,
      "taxable_cents": 49900,
      "vat_amount_cents": 10479,
      "total_cents": 60379,
      "currency": "EUR"
    }
  }
}
```

### Notas sobre el shape

- **Importes en céntimos enteros + `currency: "EUR"`**. No se devuelven decimales — el cliente decide formateo. Esto evita errores de coma flotante.
- **`unit_price_cents` es SIN IVA** (snapshot al momento de crear el pedido — los cambios futuros del catálogo no afectan a pedidos antiguos).
- **`vat_rate` y `discount_pct`** son los valores aplicados en cada línea. La fórmula utilizada coincide con la del formulario interno de MainOps:
  ```
  subtotal_cents = round(unit_price_cents * qty * (1 - discount_pct/100))
  vat_amount_cents = round(subtotal_cents * vat_rate/100)
  total_cents = subtotal_cents + vat_amount_cents
  ```
  El redondeo se aplica en cada paso para coincidir con la facturación en `/orders/new`.
- **`product_code`** existe solo si la línea está vinculada a un producto del catálogo. Para líneas legacy con `product_name` libre, vale `null`.
- **`ae`** procede de `orders.created_by` join `user_profiles`. Si el pedido entró por Typeform y no tiene `created_by`, pero sí tiene `ae_ref`, devolvemos `{ full_name: null, email: null, ae_ref: "..." }`. Si no hay nada, `ae: null`.
- **`purchase_type_label`** es la etiqueta humana (es-ES) usada en la app. Mapping:
  - `kit_digital` → `KIT Digital`
  - `hardware_one_off` → `Hardware One Off`
  - `hardware_financiacion` → `Hardware Financiación`
  - `transferencias_saas` → `Transferencias SaaS`
  - `otro` → `Otro`

### Errores

- `400` — `operationId` vacío.
- `401`/`403` — auth.
- `404` — pedido no encontrado o en estado no visible.
- `502` — error consultando la base de datos.
- `503` — config ausente.

### Ejemplo curl

```bash
curl -H "X-API-Key: $HWTOOLBOX_API_KEY" \
     https://hw-sellgear-platform.vercel.app/api/external/hwtoolbox/orders/HW-202605-0001
```

---

## Estados visibles

```
enviado_proveedor | enviado | completado | bloqueado
```

El resto de estados (`nuevo`, `pendiente`, `falta_informacion`, `pagado`) **no son visibles** desde HWToolbox.

> **Nota**: existe en `orders` un boolean `prepared` que indica si el pedido está físicamente preparado, pero no es un estado del enum. Si HWToolbox necesita filtrar por este flag o ampliar la lista de estados visibles, solicitarlo a MainOps y se evalúa.

## Cambios futuros

- **v1.1** (futuro) — incluir `tracking_number`, `shipping_label_url` y `delivered_at` si HWToolbox necesita información de envío TIPSA.
- **v2** (futuro) — webhook push hacia HWToolbox cuando cambie el estado de un pedido (eliminaría polling).
- **v2** (futuro) — tabla `external_api_calls` para auditoría compartida con `/api/external/metrics`.
