# Changelog 2026-04-30 — Para el equipo del HW Main Portal

> Documento dirigido al asistente / desarrollador que mantiene el HW Main Portal (consumer del endpoint `/api/external/metrics`). Resume qué ha cambiado hoy en MainOps y qué hay que hacer (si algo) en el portal.

## TL;DR

- **No hay breaking changes**. El contrato JSON de `/api/external/metrics` sigue intacto: mismos campos, mismas firmas, misma autenticación (`X-API-Key`). El portal sigue funcionando sin tocar nada.
- **`kpis.completed_rate`** ya no devuelve `0` siempre. Ahora refleja el valor real (ej. `84.1`). La escala SIEMPRE fue 0-100, aunque el doc decía erróneamente "ratio 0-1". **Si el portal multiplicaba este valor por 100 al renderizar, hay que quitar esa multiplicación** (ver §3).
- **`sla.*`** sigue excluyendo `transferencias_saas` y `otro` (cambio anterior, ya en producción).
- **Nuevo bloque `ops`** opcional con KPIs operativos del departamento Hardware. Es opt-in: el portal puede consumirlo cuando quiera.

## 1. Contexto

El panel `/metrics` interno mostraba "Tasa completado: 0 %" con 55 entregados de 67 pedidos. Smoking gun: la RPC `get_dashboard_metrics` filtraba `status = 'pagado'`, valor obsoleto desde la migración del 14-abril (todos los pedidos terminales pasaron a `'completado'`).

Hoy se ha:

1. Reescrito `get_dashboard_metrics` y `get_dashboard_comparison` (`completed_rate` ahora filtra `'completado'` y excluye `'bloqueado'` del denominador).
2. Añadido un bloque nuevo aditivo `ops` con KPIs operativos del depto.
3. Reorganizado el panel interno V2 (con feature flag, no afecta al portal).

## 2. Cambios en `/api/external/metrics`

### 2.1 Lo que NO cambia (contrato preservado)

- **URL**: `GET https://hw-sellgear-platform.vercel.app/api/external/metrics`
- **Auth**: header `X-API-Key`
- **Cache-Control**: `private, max-age=60`
- **CORS**: igual
- **Shape de los bloques existentes**: `kpis`, `comparison`, `time_series`, `breakdowns`, `sla`, `recent_orders` mantienen sus campos y tipos.
- **Códigos de error**: idénticos.
- **Filtros y query params**: `from`, `to`, `purchase_type`, `recent_limit` igual.

### 2.2 Lo que SÍ cambia (importante)

#### `kpis.completed_rate`

| | Antes | Ahora |
|---|---|---|
| **Valor** | siempre `0` (bug) | valor real, ej. `84.1` |
| **Escala** | 0-100 (siempre fue así, aunque el doc decía "ratio 0-1") | 0-100 (sin cambios) |
| **Fórmula** | `100 * count(status='pagado') / count(*)` (rota) | `100 * count(status='completado') / count(status<>'bloqueado')` |

**Decisión semántica**: el denominador excluye pedidos `'bloqueado'` (parados por causas externas: legal, cliente moroso, etc.) para no penalizar al departamento por situaciones que no controla.

#### `comparison.prev_completed_rate`

Mismo fix. También pasa de `0` constante a un valor real.

### 2.3 Nuevo bloque `ops` (opcional, aditivo)

Ahora el payload incluye una propiedad `ops` cuando la RPC devuelve los nuevos campos (que es siempre, tras el deploy de hoy):

```json
{
  // …kpis, comparison, time_series, breakdowns, sla, recent_orders…
  "ops": {
    "total_shipped": 25,
    "total_completed": 72,
    "avg_handling_days": 10.6,
    "avg_transit_days": 2.6,
    "on_time_shipping_pct": 75,
    "throughput_by_week": [
      { "week_start": "2026-04-20", "created": 14, "shipped": 11, "delivered": 22 }
    ],
    "blocked_count": 0,
    "excluded_admin": 16
  }
}
```

#### Significado de cada campo

| Campo | Definición |
|---|---|
| `total_shipped` | Pedidos con `shipped_at` en el periodo (envíos físicos despachados desde la oficina). |
| `total_completed` | Pedidos con `delivered_at` en el periodo y `status='completado'`. **Cohorte distinta** de `kpis.total_orders` (que filtra por `created_at`). |
| `avg_handling_days` | Promedio en días de `created → shipped`. **Lo que controla el depto.** Excluye `transferencias_saas` y `otro`. |
| `avg_transit_days` | Promedio en días de `shipped → delivered`. **Tiempo del transportista** (no controlado por el depto). |
| `on_time_shipping_pct` | % envíos físicos despachados en ≤ 5 días desde creación. Escala 0-100. |
| `throughput_by_week` | Serie semanal `[{ week_start, created, shipped, delivered }]`. Útil para gráfico de actividad. |
| `blocked_count` | Pedidos `status='bloqueado'` creados en el periodo. **No penaliza al depto** (causas externas). |
| `excluded_admin` | Pedidos `transferencias_saas` y `otro` completados en el periodo, excluidos del SLA físico (transparencia). |

#### Notas sobre TIPSA

La columna `shipped_at` se rellena cuando se genera la etiqueta TIPSA. La integración arrancó el **21-abril-2026**, por lo que para periodos anteriores los KPIs `ops_*` que dependen de `shipped_at` (`total_shipped`, `avg_handling_days`, `avg_transit_days`, `on_time_shipping_pct`) tendrán valores bajos o cero. Es esperado y mejorará progresivamente.

**Recomendación de UX en el portal**: si `ops.total_shipped < 10`, mostrar un badge "En rodaje desde 21-abr" para no confundir.

## 3. Acciones requeridas en el portal

### 3.1 Si el portal renderiza `kpis.completed_rate` directamente como `${value}%`

✅ **No hace falta tocar nada**. La escala 0-100 es la misma que ya recibías; el valor real ahora será correcto en lugar de 0.

### 3.2 Si el portal multiplicaba `kpis.completed_rate * 100` para convertir de "ratio" a porcentaje

⚠️ **Hay que quitar la multiplicación**. Antes el valor era `0`, así que `0 * 100 = 0` y nadie lo notó. Ahora el valor es `84.1`, y al multiplicar daría `8410 %`.

Buscar en el código del portal:

```ts
// MAL — el valor ya viene en 0-100
const completedPct = data.kpis.completed_rate * 100

// BIEN
const completedPct = data.kpis.completed_rate
```

Lo mismo para `comparison.prev_completed_rate` y `sla.on_time_pct` (este último ya estaba en 0-100, no había bug visible).

### 3.3 Para consumir el nuevo bloque `ops`

Es totalmente opcional. Si no lo lees, no pasa nada. Si quieres añadirlo:

```ts
// Tipos TypeScript actualizados (copia desde apps/web/types/external.ts)
export interface ExternalThroughputWeek {
  week_start: string
  created: number
  shipped: number
  delivered: number
}

export interface ExternalMetricsOps {
  total_shipped: number
  total_completed: number
  /** Días promedio created → shipped (envíos físicos). */
  avg_handling_days: number
  /** Días promedio shipped → delivered (transportista). */
  avg_transit_days: number
  /** Porcentaje 0-100 de envíos físicos despachados en ≤ 5 días. */
  on_time_shipping_pct: number
  throughput_by_week: ExternalThroughputWeek[]
  blocked_count: number
  /** Pedidos SaaS/otro completados, excluidos del SLA físico. */
  excluded_admin: number
}

// Y en la response:
export interface ExternalMetricsResponse {
  // …existente…
  ops?: ExternalMetricsOps   // NUEVO opcional
}
```

#### Ideas de UI en el portal (opcionales, no obligatorias)

- Tarjeta "Pedidos enviados" con `ops.total_shipped` y delta vs período anterior (necesitarías hacer una segunda llamada al endpoint con el rango anterior, o pedirnos que añadamos un `prev_ops_*` al `comparison` externo — hoy ya existe en la RPC interna pero no se expone en el bloque `comparison` del payload externo).
- Separar visualmente `ops.avg_handling_days` (lo que controla el depto) de `ops.avg_transit_days` (transportista). Hace evidente que cuando el SLA se incumple, no siempre es culpa del depto.
- Banner "+15 % envíos esta semana" cuando `total_shipped` mejore.
- Mostrar `ops.excluded_admin` como nota a pie del bloque SLA: *"Excluye N pedidos SaaS/otro completados en el periodo"*.

## 4. Plan de despliegue de MainOps (informativo)

| Commit | Estado | Contenido |
|---|---|---|
| `9561d68` | ✅ desplegado | Fix de RPCs en repo, null-checks, CSV con resumen, bloque `ops` en endpoint externo |
| `ce6748f` | ✅ desplegado (panel V2 con feature flag) | Layout interno nuevo, no afecta al portal |
| `67dc3e3` | ✅ desplegado | Tests vitest |

La migración SQL ya está aplicada en producción. El endpoint externo ya devuelve los valores nuevos.

## 5. Validación rápida

```bash
curl -sS \
  "https://hw-sellgear-platform.vercel.app/api/external/metrics?from=2026-04-01&to=2026-04-30" \
  -H "X-API-Key: $MAIN_PORTAL_API_KEY" \
  | jq '{ completed_rate: .kpis.completed_rate, ops: .ops }'
```

Resultado esperado (aprox.):

```json
{
  "completed_rate": 84.1,
  "ops": {
    "total_shipped": 25,
    "total_completed": 72,
    "avg_handling_days": 10.6,
    "avg_transit_days": 2.6,
    "on_time_shipping_pct": 75,
    "throughput_by_week": [...],
    "blocked_count": 0,
    "excluded_admin": 16
  }
}
```

Si `completed_rate` es `0`, el deploy aún no ha llegado o hay un error — avisar a MainOps.

## 6. Documentación de referencia en el repo de MainOps

- [docs/HW_MAIN_PORTAL_API.md](./HW_MAIN_PORTAL_API.md) — contrato actualizado del endpoint público (incluye sección nueva sobre el bloque `ops`).
- [apps/web/types/external.ts](../apps/web/types/external.ts) — tipos TypeScript de la response, copiables.
- [supabase/migrations/20260430000002_rewrite_dashboard_metrics.sql](../supabase/migrations/20260430000002_rewrite_dashboard_metrics.sql) — SQL exacto de las RPCs en producción.
- [supabase/migrations/20260430000001_sla_exclude_non_physical.sql](../supabase/migrations/20260430000001_sla_exclude_non_physical.sql) — exclusión SaaS/otro del SLA (commit anterior, ya desplegado).

## 7. Contacto / dudas

Si en el portal aparece algún número raro, ejecutar el `curl` de §5 y comparar con lo que muestra el portal. Si difieren más allá de cosas obvias (cache de un minuto, rangos de fecha distintos), pedir a MainOps el output de:

```sql
SELECT get_dashboard_metrics(NOW() - INTERVAL '30 days', NOW());
```

para comparar contra lo que cree el portal.
