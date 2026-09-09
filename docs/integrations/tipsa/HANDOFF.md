# TIPSA — Handoff

**Última actualización:** 2026-09-09 (noche)
**Rama:** `feature/mvp-foundation` · último commit `2a9c866`
**Estado:** Fase 1 (envíos + etiquetas) y Fase 2 (`/tracking` + refresco automático) **en producción y verificadas**.

---

## TL;DR para quien retoma

1. **`git pull` primero.** Este mismo fichero vive en el repo
   (`docs/integrations/tipsa/HANDOFF.md`), así que se relee y se actualiza desde
   cualquier máquina.
2. **No hay nada roto ni a medias.** La sesión cerró con 449 tests en verde,
   build OK y los datos de producción verificados.
3. Lo más urgente y lo único con riesgo para terceros: **avisar a HWToolbox y
   Qarvis** de que el significado de `tracking_last_status` ha cambiado. Texto
   listo para copiar en
   [`AVISO-CONSUMIDORES-2026-09-09.md`](./AVISO-CONSUMIDORES-2026-09-09.md).
   Hay más pendientes, todos en su sección.
4. **Antes de tocar códigos de estado de TIPSA, lee la sección "Las tres trampas" de este archivo.** Nos costó una sesión entera descubrirlas y las tres son contraintuitivas.

---

## Las tres trampas (lo importante de esta sesión)

Esto es conocimiento que no se deduce leyendo el código y que costó caro. Si vas
a tocar cualquier cosa de TIPSA, empieza por aquí.

### 1. El catálogo de códigos que usaba el proyecto era FALSO

Estaba **corrido una posición**. Lo que llamábamos "Entregado" (código `2`) es en
realidad **REPARTO** — el paquete va en la furgoneta, sin entregar. Y lo que
llamábamos "Incidencia" (código `3`) es **ENTREGADO**.

El catálogo bueno está en la **página 22** de
`docs/integrations/tipsa/extracted/Documentacion/Documentación WebServices 64.0_resumen_ES.pdf`,
sección "Tabla de tipos de estados". Es un PDF sin extraer, por eso no aparecía
en ningún grep.

| código | significado | |
|---|---|---|
| 0 | Documentado | |
| 1 | En tránsito | |
| 2 | En reparto | |
| 3 | **Entregado** | terminal |
| 4 | Incidencia | |
| 5 | **Devuelto** | terminal |
| 6 | Falta de expedición | |
| 7 | Recanalizado | |
| 9 | Falta de expedición administrativa | |
| 10 | Destruido | |
| 11 | Recogida · 12 Leída repartidor · 13 Leída | |
| 14 | Disponible para recoger | |
| 15 | Entrega parcial | |

Verificado uno a uno contra la web pública de TIPSA para el albarán
`0000012023`: los seis eventos que devuelve la API encajan al minuto con lo que
muestra dinapaqweb.

**El código 18 no está en la tabla pero es real** — `ConsEnvEstados` lo devuelve
(35 eventos desde mayo). El PDF es de la v64.0 y el WSDL va por la v74.0. Se deja
sin etiqueta a propósito: sale como "Estado 18". **No le inventes un
significado**; contrástalo primero contra la web pública (ver más abajo).

De aquel error salió una supuesta lógica de "anotación post-entrega" para el
código 3 tras el 2. Nunca existió: `2 → 3` es sencillamente REPARTO → ENTREGADO,
el camino normal. Esa lógica (`isPostDeliveryNote`) está eliminada.

#### Dónde vive el catálogo (léelo antes de tocar un código)

El mapa está replicado en varios sitios y ese es justo el motivo del commit
`b92e634`: `bcdc33c` corrigió `services.ts` y dejó atrás seis copias del mapa
viejo. **`apps/web/lib/tipsa/services.ts` es la fuente**; todo lo demás tiene que
cambiarse a la vez:

| fichero | qué guarda |
|---|---|
| `lib/tipsa/services.ts` | `TIPSA_EVENT_LABELS`, `TIPSA_TERMINAL_CODES` — **la fuente** |
| `lib/utils.ts` | `TIPSA_STATUS_COLORS` (color del badge) |
| `lib/tracking/types.ts` | `categorize()` — columnas del kanban |
| `lib/tracking/steps.ts` | `CODE_TO_STEP`, `TERMINAL_CODES` — pasos de la barra |
| `app/api/shipments/[id]/refresh-tracking/route.ts` | código TIPSA → estado de negocio del envío |
| `app/(dashboard)/page.tsx` | `ACTIVE_SHIPMENT_BLOCK` — KPI de envíos activos |
| `lib/tipsa/types.ts` | `TipsaEventCode` (solo documentación) |
| `types/external.ts` y `docs/HWTOOLBOX_API.md` | contrato público |
| migración `20260421000001` | `COMMENT ON COLUMN` (corregido en `20260909000004`) |

`steps.ts` duplica los códigos terminales **a propósito**: viaja al bundle de
cliente y no puede importar de `services.ts`, que lee `process.env`. Si cambias
uno, cambia el otro.

Tests que protegen esto: `tipsa-status.test.ts`, `tracking-steps.test.ts`,
`tracking-categorize.test.ts` y `tracking-order.test.ts`. Los tres últimos
existen porque esas funciones se quedaron atrás sin que nadie lo notara.

### 2. `ConsEnvEstIncCambiosEstados` NO sirve como historial

Su campo `D_FEC_HORA_ALTA_EST` es **la fecha en que TIPSA propagó el cambio a su
feed, no la del evento**. Y además omite eventos.

Comprobado con el albarán `0000012005`. Recorrido real (`ConsEnvEstados` y la web
de TIPSA coinciden al minuto):

```
0 doc      04/09 16:03      2 reparto   08/09 08:57
1 tránsito 04/09 18:15      4 incid     08/09 13:38
4 incid    07/09 09:26      3 ENTREGADO 08/09 14:23
```

Lo que había llegado por el feed para ese mismo envío:

```
1 el 08/09 18:50 · 18 el 09/09 07:29 · 2 el 09/09 07:29 · 4 el 09/09 17:15
```

Fechas que no existen, y sin la entrega. **Usa el feed solo para saber QUÉ
albaranes se han movido**, y pide el recorrido real con `ConsEnvEstados` por
albarán. Así funciona ya el cron.

Para saber de dónde viene una fila de `shipping_events`, mira su `raw_payload`:

| contiene | origen | ¿fiable? |
|---|---|---|
| `V_ALBARAN` | feed de deltas | **no** |
| `guid` | evento sintético que escribimos al crear el envío | sí, pero es nuestro |
| ninguno de los dos | `ConsEnvEstados` | sí |

### 3. `orders.delivered_at` NO es de TIPSA

La gobierna el trigger `orders_auto_delivered_at` (migración `20260414000002`),
que la pone al pasar el pedido a `completado`. De ahí comen `get_sla_metrics` y
el `SlaIndicator`. El refresco de TIPSA escribía encima y había dos dueños para
una columna.

**Regla actual:** TIPSA solo escribe `shipments.delivered_at` (esa sí es suya, no
tiene trigger). En `orders` no se toca. Si necesitas la fecha de entrega del
transportista para un pedido, derívala de `shipping_events`.

`orders` tiene **tres** triggers de UPDATE, no uno. Además de
`orders_auto_delivered_at` está `orders_updated_at` (`20260219000001:166`), un
BEFORE UPDATE que pisa `updated_at` en **cualquier** update. Y `SlaIndicator` usa
`updated_at` como "cuándo se bloqueó el pedido". Cualquier migración masiva sobre
`orders` **tiene que desactivar ese trigger** o destroza el reloj de SLA de los
pedidos bloqueados, irrecuperablemente.

---

## Cómo funciona el refresco ahora

```
pg_cron (Supabase, cada 30 min)
   └─ net.http_post  ── URL y secret salen del Vault
        └─ POST /api/cron/tipsa-refresh   (Vercel)
             1. lee el cursor app_settings.tipsa_last_poll_at
             2. ConsEnvEstIncCambiosEstados  → SOLO para saber qué albaranes se movieron
             3. por cada albarán: ConsEnvEstados → historial autoritativo
             4. inserta en shipping_events (UNIQUE hace de dedupe)
             5. recalcula el estado oficial y actualiza orders/shipments
             6. avanza el cursor SOLO si no falló ningún albarán
```

**Por qué vive en Vercel y no en una Edge Function:** Vercel ya tiene las
credenciales TIPSA y así se reutiliza `lib/tipsa/client.ts` en vez de mantener un
segundo cliente SOAP escrito para Deno. Además el usuario no puede gestionar
secrets de Edge Functions.

**Por qué el Vault y no `ALTER DATABASE ... SET`:** el rol `postgres` de Supabase
no es superusuario y devuelve `42501: permission denied to set parameter`.
Secrets en Vault: `tipsa_refresh_url` y `tipsa_cron_secret`.

### Endpoints

| endpoint | qué hace | quién lo llama |
|---|---|---|
| `POST /api/cron/tipsa-refresh` | barrido incremental | `pg_cron` cada 30 min |
| `POST /api/cron/tipsa-backfill?limit=20` | pasada única de recuperación de historial | a mano |
| `POST /api/tipsa/refresh-tracking` | un pedido (body `{order_id}`) | botón "Actualizar" de la ficha |
| `POST /api/shipments/[id]/refresh-tracking` | un envío libre | botón "Actualizar" de la ficha |

Los **dos** de `/api/cron/*` van protegidos con la cabecera `X-Cron-Secret`, cuyo
valor está en la env var `TIPSA_CRON_SECRET` de Vercel y en el Vault de Supabase
como `tipsa_cron_secret`. **Tienen que coincidir** o responde 401.
`tipsa-refresh` acepta además `GET` delegando en el `POST` con la misma auth, para
poder dispararlo desde el navegador; `tipsa-backfill` solo acepta `POST`.

Los dos de la ficha (`/api/tipsa/refresh-tracking` y
`/api/shipments/[id]/refresh-tracking`) NO usan el secret: van con sesión de
usuario y exigen rol distinto de `viewer`.

---

## Estado de los datos (verificado 2026-09-09 ~21:00)

De 292 envíos con albarán:

| estado | n |
|---|---|
| 3 Entregado | 282 |
| 7 Recanalizado | 4 |
| 4 Incidencia | 2 |
| 5 Devuelto | 1 |
| 1 En tránsito | 1 |
| 9 Falta de expedición admin. | 1 |
| 0 Documentado | 1 |

- 0 pedidos y 0 envíos con el estado desfasado respecto a sus eventos
- 0 filas del feed de deltas en `shipping_events`
- 1.990 eventos, ~1.450 recuperados hoy por el backfill

Antes del backfill, **283 de 292 (97%) mostraban algo que no era verdad**: 239
nunca se habían consultado a TIPSA (salían como "Documentado", que era el evento
que escribimos nosotros, no un estado de TIPSA) y 44 llevaban más de 7 días
congelados.

---

## Pendiente

### 1. Avisar a HWToolbox y Qarvis — necesita una persona

Único punto con riesgo real. `tracking_last_status` **no cambia de forma** pero
sí de significado, así que no se les romperá nada: seguirá funcionando
devolviendo lo contrario de lo que esperan. Acaban de cambiar 282 estados de
golpe.

Texto listo en [`AVISO-CONSUMIDORES-2026-09-09.md`](./AVISO-CONSUMIDORES-2026-09-09.md).

Qué se mueve para ellos:

| endpoint | ¿cambia? |
|---|---|
| `GET /hwtoolbox/shipments/{id}` | **sí** — `tracking_last_status` mantiene la forma pero cambia de significado |
| `GET /hwtoolbox/shipments` y `/{id}` | **sí** — `delivered_at` pasa a ser la entrega real, no la salida a reparto |
| `GET /external/metrics` | **sí, indirectamente** — devuelve `get_sla_metrics`, que se calcula sobre `orders.delivered_at`, y la migración cambió esa columna en 5 pedidos (3 reconstruidos desde `status_history`, 2 limpiados). El bloque `sla` se mueve un poco. |
| `GET /hwtoolbox/orders*` | no — no seleccionan nada de TIPSA |

### 2. Revisar a mano el `shipments.status` de los envíos libres

El auto-sync antiguo escribió estados de negocio con el mapa equivocado
('entregado' donde tocaba 'en_curso'). **No se corrigió por migración a
propósito**: es un campo que edita gente y `entregado` es casi terminal en
`SHIPMENT_STATUS_TRANSITIONS`. La consulta para revisarlos está en la cabecera de
la migración `20260909000004`, apartado 3b.

### 3. Borrar las tablas de backup cuando esto lleve unos días asentado

`_bk_tipsa_20260909_orders`, `_bk_tipsa_20260909_shipments`,
`_bk_tipsa_20260909_events`. Llevan RLS activado sin policies. Los `UPDATE` de
restauración están en la cabecera de la migración `20260909000004`.

### 4. Decisión abierta sobre el orden de `/tracking`

Ahora ordena por número de pedido: mes descendente, luego secuencia. Como HW va
por los 2000 y SH por los 0050, dentro de cada mes salen primero todos los `HW-`
y luego todos los `SH-`. El usuario lo vio y no dijo nada, pero se ofreció
cambiarlo si prefiere intercalarlos por fecha o separarlos en secciones.

---

## Cómo verificar que sigue todo bien

**Estado de los datos** (las tres primeras filas deben dar 0):

```sql
with oficial as (
  select order_id, shipment_id, coalesce(
    (array_agg(event_code order by event_date desc, id desc)
       filter (where event_code in ('3','5')))[1],
    (array_agg(event_code order by event_date desc, id desc))[1]) as code
  from shipping_events where carrier='tipsa' group by 1,2)
select 'orders desfasadas' k, count(*)::text v
  from orders o join oficial x on x.order_id=o.id
  where o.tracking_last_status is distinct from x.code
union all select 'shipments desfasados', count(*)::text
  from shipments s join oficial x on x.shipment_id=s.id
  where s.tracking_last_status is distinct from x.code
union all select 'basura del feed', count(*)::text
  from shipping_events where carrier='tipsa' and jsonb_exists(raw_payload,'V_ALBARAN')
union all select 'cursor (min de antiguedad)',
  round(extract(epoch from (now() - (select (value #>> '{}')::timestamptz
    from app_settings where key='tipsa_last_poll_at')))/60)::text;
```

**Ejecuciones del cron:**

```sql
select created, status_code, left(content,120)
from net._http_response order by created desc limit 5;
```

**Contrastar un albarán contra la fuente real:** abre la ficha del pedido y pulsa
el enlace "Seguimiento" — va a la web pública de TIPSA. Compara sus horas con
`shipping_events`. Es así como se verificó todo el catálogo.

---

## Trampas de entorno (te ahorran media hora)

- **El build**: usa `apps/web/node_modules/.bin/next build apps/web`. `npx tsc`
  desde la raíz falla silencioso y no reproduce el type-check de Vercel. Está en
  `CLAUDE.md`.
- **PostgREST corta a 1000 filas** por defecto. `shipping_events` tiene ~2000, así
  que cualquier consulta que las quiera todas **debe paginar** con `.range()`.
  Ya mordió una vez: `/tracking` pintaba las barras vacías con el badge en verde.
- **Timestamps empatados**: hay albaranes con dos eventos en el mismo segundo
  exacto. Todo `ORDER BY event_date` necesita `, id` de desempate o el resultado
  no es determinista y el estado oficial baila entre recargas.
- **TIPSA rechaza ventanas de más de 24h** en `ConsEnvEstIncCambiosEstados`
  ("El rango de fechas no puede superar las 24 horas"). El cron recorta a 23.5h.
- **Fechas de TIPSA**: la petición va en `YYYY/MM/DD HH:MM:SS` y la respuesta
  viene en `MM/DD/YYYY HH:MM:SS` (formato americano), las dos en hora de Madrid.
- **Supabase MCP**: `.mcp.json` no lleva ningún token — es un MCP HTTP con OAuth.
  Lo que caduca es la autorización, y se renueva con `/mcp` en una sesión
  interactiva. Mientras no esté autorizado, los cambios SQL van a mano por el SQL
  Editor del Dashboard, que es además lo que pide `CLAUDE.md`.
- **El editor SQL de Supabase** se cuelga si le metes SQL largo por teclado
  simulado. Va bien pasándole el texto al modelo de Monaco directamente.

---

## Commits de esta sesión

| commit | qué |
|---|---|
| `53b3389` | un código sin catalogar no puede degradar un Entregado |
| `bcdc33c` | **corregir el mapa de códigos, que estaba corrido** |
| `bd8011f` | dejar de pisar `orders.delivered_at` |
| `b92e634` | rematar el remapeo — quedaban 6 sitios con el catálogo viejo |
| `ffce46b` | desempatar por id los eventos con la misma fecha |
| `e2224ce` | **el feed de deltas no sirve como historial, solo como detector** |
| `8852681` | no avanzar el cursor si algún albarán falló |
| `b8b5026` | orden por recencia + endpoint de backfill |
| `fc9558a` | ordenar la lista por número de pedido |
| `2a9c866` | paginar los eventos (PostgREST cortaba a 1000) |

Migración aplicada a producción: `20260909000004_recalcular_estados_tipsa.sql`.
Las `20260909000001-3` (app_settings, realtime de shipments, pg_cron) ya estaban
aplicadas de antes en esta misma sesión.

---

## Contexto anterior

La Fase 1 (crear envíos, etiquetas PDF, dirección estructurada) está en
[`PLAN.md`](./PLAN.md). Los WSDL, PDFs y ejemplos SOAP están en
`docs/integrations/tipsa/extracted/`.
