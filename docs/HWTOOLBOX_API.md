# API pública para HWToolbox

Este documento describe el contrato de los endpoints `/api/external/hwtoolbox/*` que MainOps expone a **HWToolbox** (gestión de inventario interna).

HWToolbox lo consume cuando un usuario crea una transacción de salida de inventario y necesita asociarla a un movimiento existente de MainOps: primero **lista** los candidatos para que el usuario seleccione uno, luego pide el **detalle** completo del seleccionado.

Hay **dos familias**, porque en MainOps el material sale por dos vías distintas:

| | Pedidos (`HW-…`) | Envíos libres (`SH-…`) |
|---|---|---|
| Tabla | `orders` | `shipments` |
| Qué es | una venta, con líneas de producto y precios | una etiqueta TIPSA que no cuelga de un pedido: cliente a cliente, o material que vuelve (RMA, reparación) |
| Contenido | `items[]` con SKU, cantidades e importes | `content`, **texto libre** |
| Estado | enum de `orders`, filtrado a los de envío | enum propio de `shipments`, sin filtro |
| Importes | sí | no lleva precios |

Un envío libre **no es un pedido**: no tiene tipo de compra, ni importe, ni líneas. Por eso vive en sus propios endpoints en vez de colarse en el array `orders` con tres campos inventados.

## Resumen

- **Endpoints:**
  - `GET /api/external/hwtoolbox/orders` — listado paginado de pedidos.
  - `GET /api/external/hwtoolbox/orders/{operation_id}` — detalle de pedido.
  - `GET /api/external/hwtoolbox/shipments` — listado paginado de envíos libres.
  - `GET /api/external/hwtoolbox/shipments/{shipment_id}` — detalle de envío.
- **Base URL producción:** `https://hw-sellgear-platform.vercel.app`
- **Auth:** header `X-API-Key` con la secret compartida.
- **Tipo:** read-only. No hay escrituras desde HWToolbox.
- **Scope pedidos:** solo en estado `enviado_proveedor`, `enviado`, `completado` o `bloqueado`. Los estados `nuevo`, `pendiente`, `falta_informacion` y `pagado` **no son visibles** (devuelven 404 en detalle, no aparecen en listado).
- **Scope envíos:** **todos**. `shipments` no tiene borradores — la fila se crea junto con la etiqueta TIPSA — así que filtrar solo esconderría un envío recién dado de alta. El estado va en el payload y decide el consumidor.
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
| `purchase_type` | enum | — | `kit_digital \| hardware_one_off \| hardware_financiacion \| transferencias_saas \| saas_hardware \| otro`. `saas_hardware` añadido el 21-may-2026 (ofertas mixtas SaaS + equipos físicos). |
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
- **Política de tasas (actualizada 21-may-2026)** — MainOps aplica automáticamente la tasa según el destino del envío:
  - **IVA 21 %** (`vat_rate: 21`) para envíos peninsulares y Baleares.
  - **Exento (`vat_rate: 0`)** cuando `shipping_cp` del pedido empieza por `35` o `38` (Canarias). Por acuerdo comercial de la empresa, las ventas/envíos a Canarias **no llevan impuesto** desde el 21-may-2026.
  - **IGIC 7 % (legacy, `vat_rate: 7`)** — pedidos canarios creados entre el 12-may-2026 y el 20-may-2026 mantienen IGIC 7 % por snapshot inmutable. Filtrar por `created_at` para distinguir.
  - **Snapshot inmutable**: la tasa se congela al crear el pedido y no se rectifica desde la app. Pedidos canarios creados antes del 12-may-2026 mantienen IVA 21 %.
  - **Convención para distinguir desde HWToolbox**: comprueba `vat_rate` por línea. No uses el CP para inferir, el snapshot manda. `vat_rate === 7` → IGIC legacy, `vat_rate === 21` → IVA, `vat_rate === 0` → exento (Canarias).
- **`product_code`** existe solo si la línea está vinculada a un producto del catálogo. Para líneas legacy con `product_name` libre, vale `null`.
- **`ae`** procede de `orders.created_by` join `user_profiles`. Si el pedido entró por Typeform y no tiene `created_by`, pero sí tiene `ae_ref`, devolvemos `{ full_name: null, email: null, ae_ref: "..." }`. Si no hay nada, `ae: null`.
- **`purchase_type_label`** es la etiqueta humana (es-ES) usada en la app. Mapping:
  - `kit_digital` → `KIT Digital`
  - `hardware_one_off` → `Hardware One Off`
  - `hardware_financiacion` → `Hardware Financiación`
  - `transferencias_saas` → `Transferencias SaaS`
  - `saas_hardware` → `SaaS + Hardware` (añadido 20-may-2026)
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

---

## `GET /api/external/hwtoolbox/shipments` — listado de envíos libres

Envíos TIPSA que **no cuelgan de un pedido** (tabla `shipments`, id `SH-YYYYMM-NNNN`): material de cliente a cliente, o que vuelve a nosotros (RMA, reparación). Son movimientos de almacén igual de reales que un pedido.

```
GET /api/external/hwtoolbox/shipments?q=0000012006&from=2026-09-01&to=2026-09-30&limit=25&offset=0
```

| Param | Tipo | Default | Notas |
|---|---|---|---|
| `q` | string | — | Búsqueda fuzzy (ILIKE) en `shipment_id`, `recipient_name`, `sender_name`, `reference`, `albaran` y `tracking_number`. Son más campos que en pedidos a propósito: quien usa un inventario tiene delante la etiqueta física, así que el dato a mano es el albarán, no el nombre. |
| `from` | `YYYY-MM-DD` | — | Filtro inclusivo sobre `created_at`. |
| `to` | `YYYY-MM-DD` | — | Filtro inclusivo sobre `created_at`. |
| `limit` | int 1-50 | 25 | Tamaño de página. |
| `offset` | int ≥ 0 | 0 | Para paginar. |

**No hay filtro implícito de estado**, al contrario que en pedidos. Ordenado por `created_at` descendente.

No existe `purchase_type`: un envío libre no es una venta.

### Response 200

```json
{
  "generated_at": "2026-09-08T12:00:00.000Z",
  "pagination": { "total": 50, "limit": 25, "offset": 0 },
  "shipments": [
    {
      "shipment_id": "SH-202609-0055",
      "status": "en_curso",
      "sender_name": "QR PAYMENTS QAMARERO",
      "recipient_name": "Bar Pepe",
      "recipient_city": "Sevilla",
      "content": "PACK PREMIUM: TPV, 2 PRINTER WIFI, KDS",
      "packages": 1,
      "return_shipment": false,
      "albaran": "0000012006",
      "tracking_number": "0000012006",
      "shipped_at": "2026-09-05T09:12:00.000Z",
      "delivered_at": null,
      "created_at": "2026-09-05T08:40:00.000Z"
    }
  ]
}
```

### Campos que importan para un inventario

- **`content`** es **texto libre** que escribe quien crea la etiqueta: `"TPV PRO"`, `"pack pro + flint"`, `"TPV PARA REPARACIÓN"`, `"TPV RMA"`. **No hay SKU ni cantidades estructuradas**, y MainOps no intenta deducirlos — se entrega tal cual y HWToolbox decide qué hacer con él. Si en el futuro hace falta estructurarlo, hay que cambiarlo en el formulario de MainOps, no aquí.
- **`return_shipment`** — `true` = el material **vuelve** (recogida, RMA). Para un inventario es la diferencia entre una entrada y una salida, así que va en el listado y no solo en el detalle.
- **`status`** — estado **manual** que fija el equipo, enum propio de envíos: `pendiente | en_curso | entregado | incidencia | devuelto | cancelado`. Es la columna «Estado» de la pestaña de envíos y **manda sobre el tracking automático de TIPSA**. Ojo: `entregado` aquí puede convivir con `delivered_at: null`, porque una cosa la pone una persona y la otra el transportista.
- **`sender_name`** — el remitente es libre. En los envíos de salida es la empresa; en una recogida, el cliente.

### Errores

- `400` — `from`/`to` mal formateados o `from > to`.
- `401`/`403` — auth.
- `502` — error consultando la base de datos.
- `503` — config ausente.

### Ejemplo curl

```bash
curl -H "X-API-Key: $HWTOOLBOX_API_KEY" \
     "https://hw-sellgear-platform.vercel.app/api/external/hwtoolbox/shipments?limit=10"
```

---

## `GET /api/external/hwtoolbox/shipments/{shipment_id}` — detalle de envío

Path param: `shipment_id` con formato `SH-YYYYMM-NNNN` (ej. `SH-202609-0055`).

`404` si no existe. A diferencia del detalle de pedido, aquí un 404 **solo** significa eso: no hay estados ocultos que disimular.

### Response 200

```json
{
  "generated_at": "2026-09-08T12:00:00.000Z",
  "shipment": {
    "shipment_id": "SH-202609-0055",
    "status": "en_curso",
    "sender": {
      "name": "QR PAYMENTS QAMARERO",
      "address": "Calle Ejemplo 1",
      "cp": "41001",
      "city": "Sevilla",
      "phone": "600000000"
    },
    "recipient": {
      "name": "Bar Pepe",
      "address": "Avenida Ejemplo 2",
      "cp": "03005",
      "city": "Alicante",
      "phone": "600111222",
      "email": "pepe@ejemplo.com",
      "contact_person": "Pepe"
    },
    "service_code": "24",
    "packages": 1,
    "weight_kg": 7,
    "content": "PACK PREMIUM: TPV, 2 PRINTER WIFI, KDS",
    "observations": null,
    "notes": null,
    "reference": null,
    "return_shipment": false,
    "albaran": "0000012006",
    "tracking_number": "0000012006",
    "tracking_public_url": "https://...",
    "tracking_last_status": "1",
    "tracking_last_status_label": "Alta",
    "tracking_last_checked_at": "2026-09-06T06:00:00.000Z",
    "shipped_at": "2026-09-05T09:12:00.000Z",
    "delivered_at": null,
    "shipping_label_url": "https://...",
    "created_at": "2026-09-05T08:40:00.000Z",
    "updated_at": "2026-09-06T06:00:00.000Z",
    "created_by": {
      "full_name": "María García",
      "email": "maria.garcia@qamarero.com"
    }
  }
}
```

### Notas sobre el shape

- **No hay `items` ni `totals`**: un envío libre no lleva precios. Si HWToolbox necesita valorarlo, el dato no existe en MainOps.
- **`weight_kg`** es un número, no un string. La columna es `NUMERIC(10,3)` y PostgREST la serializa como texto, así que MainOps la normaliza antes de responder.
- **No se inventa un estado de progreso.** Van los hechos crudos y el consumidor concluye:
  - `status` — lo que dice el equipo (manual, y es lo que manda en la app).
  - `tracking_last_status` — el último código que devolvió TIPSA, tal cual (`'1'`, `'2'`…).
  - `tracking_last_status_label` — el mismo código traducido con la tabla que usa MainOps (`'1'` → «Alta», `'2'` → «Entregado», `'3'` → «Incidencia», `'4'` → «En tránsito», `'5'` → «En reparto», `'6'` → «Devuelto al origen»; un código desconocido da `Estado {code}`). Se traduce en MainOps a propósito: duplicar la tabla en el consumidor la condena a desincronizarse.
  - `shipped_at` / `delivered_at` — fechas reales del transportista.
- **`observations`** viaja impreso en la etiqueta; **`notes`** son notas internas de MainOps. Los dos son texto libre.
- **`created_by`** sale de `shipments.created_by` join `user_profiles`. `null` si la fila no lo tiene.
- **`service_code`** es el código de servicio TIPSA con el que se contrató (ej. `"24"`).
- **No se expone** `saturday_delivery` ni `carrier_guid`: son detalles de la contratación con TIPSA, sin valor para un inventario. Si hacen falta, se piden.

### Errores

- `400` — `shipmentId` vacío.
- `401`/`403` — auth.
- `404` — envío no encontrado.
- `502` — error consultando la base de datos.
- `503` — config ausente.

### Ejemplo curl

```bash
curl -H "X-API-Key: $HWTOOLBOX_API_KEY" \
     https://hw-sellgear-platform.vercel.app/api/external/hwtoolbox/shipments/SH-202609-0055
```

## Estados visibles

### Pedidos (`orders`)

```
enviado_proveedor | enviado | completado | bloqueado
```

El resto de estados (`nuevo`, `pendiente`, `falta_informacion`, `pagado`) **no son visibles** desde HWToolbox.

### Envíos libres (`shipments`)

Enum propio, **distinto** al de pedidos, y **todos son visibles**:

```
pendiente | en_curso | entregado | incidencia | devuelto | cancelado
```

No se filtra porque `shipments` no tiene borradores: la fila nace junto con la etiqueta TIPSA. Filtrar solo esconderría un envío recién dado de alta. Un `cancelado` sí se entrega, con su estado, para que HWToolbox no lo cuente como material que salió.

> **Nota**: existe en `orders` un boolean `prepared` que indica si el pedido está físicamente preparado, pero no es un estado del enum. Si HWToolbox necesita filtrar por este flag o ampliar la lista de estados visibles, solicitarlo a MainOps y se evalúa.

## Cambios futuros

- **v1.1** (futuro) — incluir `tracking_number`, `shipping_label_url` y `delivered_at` en el detalle de **pedido**. En el de envío ya van.
- **v1.2** (futuro) — filtros propios del listado de envíos (`status`, `return_shipment`, solo no entregados) si HWToolbox los pide. Hoy se entrega todo y filtra el consumidor.
- **v2** (futuro) — webhook push hacia HWToolbox cuando cambie el estado de un pedido o un envío (eliminaría polling).
- **v2** (futuro) — tabla `external_api_calls` para auditoría compartida con `/api/external/metrics`.

### Pendiente de decidir

- **`content` estructurado.** Lo que sale en un envío libre es texto libre, así que HWToolbox no puede casarlo con SKU automáticamente. Estructurarlo exige cambiar el formulario de creación de envíos en MainOps (líneas de producto en vez de una descripción), no este contrato.
- **`isValidDate` acepta un día que no existe en su mes.** `from=2026-02-30` no devuelve 400: rueda a `2026-03-02` y desplaza la ventana dos días en silencio. Afecta a los dos listados. Está fijado con un test (`__tests__/external-query.test.ts`) para que endurecerlo sea una decisión deliberada, porque cambiaría el contrato.
