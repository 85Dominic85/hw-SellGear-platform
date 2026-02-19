# Prompt de arranque — MainOperation Platform (Hardware)

Eres **Claude Code** actuando como **Lead Engineer + Product Engineer** para Qamarero (Hardware). Debes arrancar y construir el **MVP** de la plataforma de gestión de MainOperation usando este repo como fuente de verdad de instrucciones y capacidades.

## Regla 0 (obligatoria)
Antes de escribir código: **descubre y aplica** lo que ya existe en el repo.

Debes leer y obedecer, en este orden:
1) `CLAUDE.md`
2) `README.md`
3) `/docs/**`
4) `/.claude/agents/**`
5) `/.claude/skills/**`
6) `/.claude/mcps/**`
7) `/.mcp.json` (config MCP real) y `/.claude/mcps/mcp_servers.example.json` (plantilla)

---

## Fase A — Descubrimiento (obligatorio)
1) Recorre el árbol del repo y **lista**:
   - Agentes disponibles en `/.claude/agents/` (nombre + cuándo usarlos)
   - Skills disponibles en `/.claude/skills/` (qué automatizan)
   - MCPs documentados en `/.claude/mcps/` y qué hay realmente configurado en `.mcp.json`
2) Resume “Capacidades detectadas” y construye un “Plan de ejecución” (6–10 bullets).
3) Tras el plan: **empieza a implementar** sin pedir confirmación por cada paso.

> Nota MCP: si `.mcp.json` solo habilita Supabase en modo `--read-only`, úsalo para inspección; para cambios aplica **migraciones SQL** y config del proyecto.

---

## Contexto / Problema
- Hoy “MainOperation” es un **Google Sheet** (Drive) con varias pestañas.
- La info llega por Slack/DM/1:1 y se vuelca manualmente: **errores y pérdida de tiempo**.
- Typeform ya escribe en el sheet, pero queremos pasar a **Typeform → BD**.
- El sheet debe tener **acceso muy restringido** (solo 2 personas). La herramienta es la que escribe/actualiza.

Volumen: ~30/40 operaciones por semana, ~15 creadores.

Campos actuales del sheet:
- ent, Nombre del cliente, Bar, Tipo de compra, Producto, Importe, Justificante Bancario, AE,
  Dirección de Envío, Estado del pedido, Otros, Nº Teléfono, Hubspot, Factura, Email

Pestañas/hojas frecuentes:
- Pedidos, KIT Digital, Hardware One Off, Hardware Financiación, Transferencias SaaS, Facturas WEB, etc.

Decisiones confirmadas:
- Podemos añadir columnas nuevas al sheet.
- Cada operación debe tener `operation_id` único.
- Un pedido puede tener **uno o varios productos** (items).

---

## Objetivo MVP
- **Supabase** como fuente de verdad.
- **Google Sheets** como espejo (sync desde Supabase) mientras haya dependencia.
- Ingesta: **Typeform → Webhook → Supabase** (validación server-side).
- Gestión por **estados**, asignación, auditoría/historial, filtros/búsqueda.
- Notificaciones a **Slack** en canal privado por cambios de estado.
- Generación de **correo plantillado** a proveedor (MVP: copiar + `mailto:`).

---

## Arquitectura recomendada
- Frontend: **Next.js + TypeScript**
- Backend/DB: **Supabase** (Postgres + Auth + RLS + Storage + Edge Functions)
- Auth: ideal **Google Workspace SSO** (si no, deja preparado y usa Supabase Auth temporalmente)
- Sync Sheets: Google Sheets API con **Service Account** (compartir el sheet con el SA).

---

## Modelo de datos (MVP)
Tablas mínimas:
- `orders`: operation_id, created_at, created_by, source_department, purchase_type,
  customer_name, venue_name, contact_email, phone, shipping_address, amount,
  bank_receipt_url, ae_ref, hubspot_ref, invoice_ref,
  status, assigned_to, notes, sheet_tab, sheet_row
- `order_items`: order_id, product_name, qty (y opcional unit_price)
- `status_history`: order_id, from_status, to_status, changed_by, changed_at, comment
- `comments` (interno)

---

## Estados (MVP)
Nuevo → En revisión → Falta info → Aprobado → Pedido a proveedor → En tránsito → Recibido → Preparación/Envío → Completado
+ Cancelado

---

## Roles / RLS (obligatorio, deny-by-default)
- Creadores (Ventas/AM/AE/KitDigital): crear pedidos; ver lo suyo (o su depto si se define)
- Hardware: acceso completo
- Manager: lectura global + métricas

---

## Entregables MVP (debe quedar funcionando en local)
1) Migraciones SQL + RLS + seed de estados.
2) Web app:
   - Login
   - Inbox/lista con filtros + búsqueda
   - Detalle con edición controlada
   - Gestión de items (1..n)
   - Cambio de estado + historial
   - Botón “Sync a Sheets”
3) Webhook Typeform (Edge Function o API route) que valide y cree order + items.
4) Sync a Google Sheets (append/update con `sheet_row`, soportando pestañas).
5) Slack: notificar cambios relevantes.
6) Email a proveedor: generar asunto/cuerpo + `mailto:`.
7) Testing mínimo + lint/format.
8) Documentación: actualizar README + docs.

---

## Cómo debes trabajar (delegación sugerida)
- `product_owner`: convierte requisitos en stories con criterios.
- `supabase-schema-architect` + `backend_supabase`: migraciones + RLS + índices.
- `integrations_engineer`: Typeform, Sheets, Slack, email template.
- `frontend_nextjs` / `expert-nextjs-developer`: app web.
- `code-reviewer` + `debugger`: calidad y fixes.

Empieza ahora por el Descubrimiento, luego implementa.
