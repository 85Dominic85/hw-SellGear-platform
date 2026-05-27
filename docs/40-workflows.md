# Flujos

## Estados propuestos (MVP)
- Nuevo
- En revisión
- Falta info
- Aprobado
- Pedido a proveedor
- En tránsito
- Recibido
- Preparación
- Enviado/Completado
- Cancelado

## Reglas
- Cualquier cambio de estado crea registro en `status_history`.
- `Falta info` debe notificar al creador.

## Creación manual de pedido (`/orders/new`)

Desde el 2026-05-26 la creación manual usa un **wizard de 3 pasos** que
adapta el formulario al tipo de compra elegido por el AE/AM:

1. **Paso 1 — Tipo de compra**: el AE selecciona uno de los 6 tipos
   (Hardware One Off, Hardware Financiación, KIT Digital, SaaS + Hardware,
   Transferencias SaaS, Otro). Visualmente se muestra como un grid de
   tiles con icono + descripción corta.

2. **Paso 2 — Datos**: solicitante, cliente, referencias, justificante
   bancario y dirección de envío. Los campos obligatorios cambian según
   el tipo elegido (ver tabla más abajo).

3. **Paso 3 — Productos**: catálogo visual (tiles con foto, precio,
   descripción y botón "+ Añadir") + resumen del pedido (base, impuesto,
   total) + botón "Crear pedido".

### Campos obligatorios por `purchase_type`

| Campo               | `hardware_*` / `kit_digital` / `saas_hardware` / `otro` | `transferencias_saas` |
|---------------------|:-:|:-:|
| `requester_name`    | ✅ | ✅ |
| `requester_email`   | ✅ | ✅ |
| `customer_name`     | ✅ | ✅ |
| `contact_email`     | ✅ | ✅ |
| `phone`             | ✅ | ❌ |
| `hubspot_ref`       | ✅ | ✅ |
| `bank_receipt_url`  | ✅ | ✅ |
| `shipping_street`   | ✅ | ❌ |
| `shipping_cp`       | ✅ | ❌ |
| `shipping_city`     | ✅ | ❌ |
| ≥ 1 ítem en carrito | ✅ | ✅ |

La fuente única de estas reglas vive en
[`apps/web/lib/order-requirements.ts`](../apps/web/lib/order-requirements.ts).
Tanto el cliente (`page.tsx`) como el server (`/api/orders` POST) la
importan para evitar divergencias.

### Catálogo visual

El componente [`ProductCatalog`](../apps/web/components/orders/ProductCatalog.tsx)
muestra todos los productos `active=true` del catálogo Qamarero 2026
excepto los SKUs internos `otro` y categoría `saas_hardware`, que se
acceden vía botón "Añadir línea libre" (con UI extra de descripción +
precio negociado por el AE).

Imágenes: convención `apps/web/public/products/{code}.png`, extraídas del
PDF oficial del catálogo 2026. Fallback a icono de categoría si la imagen
no existe.

## Financiación: planes de pago y control de plazos

Desde el 2026-05-27, `hardware_financiacion` tiene un tratamiento propio.

**Productos financiables**: solo **Pack Pro**, **Pack Premium** y **KDS
Estándar**. En el paso 3 del wizard, el catálogo de financiación
([`FinancingCatalog`](../apps/web/components/orders/FinancingCatalog.tsx))
muestra solo estos 3 como selección única (1 producto, cantidad 1, sin
descuento).

**Precio**: cada producto tiene un plan de 3 pagos (importes **base
s/IVA**; se les suma 21 %, o 0 % si Canarias). El total del plan
**reemplaza** al precio de catálogo (financiar es más caro que pagar al
contado). Planes en [`apps/web/lib/financing.ts`](../apps/web/lib/financing.ts):

| Producto       | Entrada | 2.º plazo | 3.er plazo | Base total |
|----------------|--------:|----------:|-----------:|-----------:|
| Pack Pro       |   500 € |     225 € |      225 € |     950 €  |
| Pack Premium   |   699 € |     350 € |      350 € |   1.399 €  |
| KDS Estándar   |   390 € |     190 € |      190 € |     770 €  |

`order.amount` = total del plan **con IVA**. Al crear el pedido, el POST
`/api/orders` inserta 3 filas en `order_payments` (estado `pendiente`)
cuya suma gross coincide con `order.amount`.

**Control de plazos** (ficha del pedido `/orders/[id]`): el componente
[`FinancingPaymentsPanel`](../apps/web/components/orders/FinancingPaymentsPanel.tsx)
muestra una tabla con los 3 plazos. Los roles `admin`/`manager`/`hardware`
pueden marcar cada plazo como pagado, fijar la fecha y adjuntar el
justificante de transferencia (bucket `order-attachments`). Comercial y
viewer lo ven en solo lectura. Endpoint: `PATCH /api/orders/[id]/payments`
(actualizar plazo) y `POST` (generar el plan para pedidos antiguos).

**Vista de categoría** (`/orders?type=hardware_financiacion`): la tabla
añade una columna **"Pagos"** con un badge de progreso
([`FinancingProgressBadge`](../apps/web/components/orders/FinancingProgressBadge.tsx)):
Sin pagos · Entrada 1/3 · En curso 2/3 · Completado 3/3.
