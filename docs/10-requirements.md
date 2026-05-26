# Requisitos

## Funcionales (MVP)
- Crear operaciones (Typeform o formulario interno)
- Generar `operation_id` único
- Gestión por estados + asignación
- Comentarios internos + historial de cambios
- Dashboard de lectura para no-Hardware
- **Formulario manual adaptativo por `purchase_type`** (wizard 3 pasos).
  Campos obligatorios cambian según el tipo de compra; el catálogo de
  productos se muestra como tiles visuales con foto del catálogo
  Qamarero 2026 (ver `docs/40-workflows.md`).

## No funcionales
- Login con Google Workspace
- Permisos por rol (RLS)
- Auditoría mínima
- Rendimiento: búsqueda y filtros ágiles
- Validación de campos obligatorios centralizada en
  `apps/web/lib/order-requirements.ts` (cliente y servidor importan el
  mismo helper, cero divergencias).
