# Aviso a consumidores de la API: cambio de significado en los códigos TIPSA

**Fecha:** 2026-09-09
**Afecta a:** HWToolbox, Qarvis, y cualquier consumidor de `/api/external/hwtoolbox/shipments/*`
**Commits:** `bcdc33c`, `bd8011f`, `b92e634`, `ffce46b` · **Migración:** `20260909000004`

---

## Qué pasó

El catálogo de códigos de estado de TIPSA que usaba MainOps era una deducción, y
era incorrecta: estaba **corrida una posición**. Lo que llamábamos «Entregado»
(código `2`) es en realidad **REPARTO**, y lo que llamábamos «Incidencia»
(código `3`) es **ENTREGADO**.

El catálogo bueno está en la página 22 de
`docs/integrations/tipsa/extracted/Documentacion/Documentación WebServices 64.0_resumen_ES.pdf`
(«Tabla de tipos de estados»), un PDF que ya estaba en el repo sin extraer.
Verificado uno a uno contra la web pública de TIPSA para el albarán
`0000012023`: los seis eventos que devuelve la API encajan exactamente con lo
que muestra dinapaqweb.

| código | correcto | lo que decíamos antes |
|--------|----------|-----------------------|
| 0 | Documentado | Documentado ✓ |
| 1 | **En tránsito** | Alta |
| 2 | **En reparto** | Entregado ❌ |
| 3 | **Entregado** | Incidencia ❌ |
| 4 | **Incidencia** | En tránsito ❌ |
| 5 | **Devuelto** | En reparto ❌ |
| 6 | Falta de expedición | Devuelto al origen ❌ |
| 7 | Recanalizado | Lectura en agencia ❌ |
| 14 | Disponible para recoger | *sin mapear* |
| 15 | Entrega parcial | Pendiente de llegada ❌ |

Terminales: **`3` y `5`** (antes creíamos que eran el `2` y el `6`).

## Qué endpoints se ven afectados

| endpoint | campo | ¿cambia? |
|---|---|---|
| `GET /shipments/{shipmentId}` | `tracking_last_status` | **Sí — mismo formato, otro significado** |
| `GET /shipments/{shipmentId}` | `tracking_last_status_label` | Sí, pero ya viene traducido y correcto |
| `GET /shipments/{shipmentId}` y `GET /shipments` | `delivered_at` | **Sí — ahora es la entrega real, no la salida a reparto** |
| `GET /orders*` | — | No. No exponen nada de TIPSA |
| `GET /metrics` | bloque `sla` | **Sí, indirectamente** — sale de `get_sla_metrics`, que se calcula sobre `orders.delivered_at` |

## Impacto en los datos ya corregidos

De 51 envíos libres:

- **39** cambiaron de `tracking_last_status`
- **9** cambiaron de `delivered_at`: 3 dejaron de constar como entregados
  (estaban en reparto, no entregados), 5 pasaron a constar entregados (lo
  estaban y no se detectaba), y 1 corrigió la fecha
- Las etiquetas `event_label` guardadas se reescribieron con el catálogo bueno

## Qué hay que revisar

`tracking_last_status` **no cambia de forma** — sigue siendo el mismo string con
un número dentro — así que ningún parser se va a romper. El riesgo es el
contrario: que siga funcionando y devuelva lo contrario de lo que se espera.

Hay que revisar cualquier sitio donde:

1. Se compare el código con un literal, sobre todo `=== '2'` para deducir
   «entregado» o `=== '3'` para deducir «incidencia». Ahora significan lo
   opuesto.
2. Se haya copiado la tabla de códigos. Esa copia está mal.
3. Se haya **guardado** el código y luego se interprete. Los valores históricos
   ya guardados en el consumidor tienen el significado antiguo; los que se lean
   a partir de ahora, el nuevo.
4. Se calculen métricas de entrega a partir de `delivered_at` de envíos libres.

**Recomendación:** leer `tracking_last_status_label` en vez del código crudo.
Ese campo lo traduce MainOps con el catálogo vigente, así que si TIPSA vuelve a
sorprendernos no hay nada que tocar del lado del consumidor. El código crudo
sigue ahí para quien lo necesite, pero mantener una segunda tabla de códigos es
justo lo que provocó este problema.

## Por qué no se ha versionado el endpoint

Se ha valorado sacar un `v2`. No compensa: el contrato no cambia de forma, el
único consumidor conocido del código crudo es la ficha de envío de HWToolbox, y
mantener dos versiones obligaría a servir indefinidamente un significado que
sabemos que es falso. Un aviso explícito y una doc corregida cubren el caso.

---

## Mensaje para enviar

> **Aviso: los códigos de estado de TIPSA que os damos significaban otra cosa**
>
> Hemos descubierto que el catálogo de códigos de TIPSA que usábamos en MainOps
> era una deducción nuestra, y estaba mal: corrido una posición. En corto, el
> código `2` **no es «entregado»**, es «en reparto» — el paquete va en la
> furgoneta. El «entregado» es el `3`, que nosotros llamábamos «incidencia».
> Lo hemos verificado contra la web pública de TIPSA para un albarán real y
> contra su documentación oficial. Ya está corregido en MainOps y los datos
> históricos recalculados.
>
> **Qué os afecta:** el campo `tracking_last_status` de
> `GET /api/external/hwtoolbox/shipments/{shipmentId}` y el `delivered_at` de los
> envíos libres. Los endpoints de pedidos (`/orders`) no exponen nada de esto y
> no cambian.
>
> Ojo con `GET /api/external/metrics`: no expone códigos de TIPSA, pero su bloque
> `sla` sale de `orders.delivered_at`, y hemos corregido esa columna en 5 pedidos
> a los que el refresco de TIPSA les había escrito una fecha que no tocaba. Si
> guardáis series históricas de esas métricas, los números de esos periodos se
> mueven un poco.
>
> **Ojo con esto:** el campo no cambia de formato, sigue siendo el mismo string.
> No se os va a romper nada — el riesgo es que siga funcionando y os devuelva lo
> contrario de lo que esperáis. Revisad si en algún sitio comparáis el código
> con un literal (`'2'` para dar algo por entregado, `'3'` para incidencia), o
> si guardáis el número y lo interpretáis después: lo que tengáis almacenado
> lleva el significado antiguo.
>
> De 51 envíos libres, 39 han cambiado de código y 9 de `delivered_at`
> (3 dejan de constar como entregados y 5 pasan a estarlo).
>
> **Recomendación:** leed `tracking_last_status_label`, que va en la misma
> respuesta y lo traducimos nosotros. Así si TIPSA vuelve a cambiar algo no
> tenéis que tocar nada.
>
> La tabla completa de códigos está en `docs/HWTOOLBOX_API.md`. Cualquier duda,
> nos decís.
