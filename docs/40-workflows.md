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
