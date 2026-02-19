# Instrucciones para Claude Code

Este repositorio define la plataforma de gestión de MainOperation para Hardware.

## Principios
- **Supabase** es la fuente de verdad.
- **Google Sheets** se mantiene como espejo mientras dure la transición.
- Validaciones server-side: no confiar en campos libres.
- Trazabilidad: todo cambio relevante debe quedar en `status_history`/auditoría.
- El Sheet tiene acceso restringido: la herramienta debe escribir/actualizar automáticamente.

## Cómo trabajar aquí
- Prompt recomendado: `/.claude/PROMPT_MVP.md`
- Usa los **agentes** en `/.claude/agents/` para repartir tareas.
- Usa los **skills** en `/.claude/skills/` para ejecutar patrones repetibles.
- Configura e integra **MCPs** en `/.claude/mcps/` (config principal en `.mcp.json`).
- Comandos útiles: `/.claude/commands/` (ej: `generate-tests.md`).

## Entregables esperados
- Migraciones SQL + políticas RLS.
- Edge Functions para webhooks e integraciones.
- App web (Next.js) con login Google Workspace (o preparado).
- Sincronización controlada (preferible unidireccional Supabase → Sheets).

## Convenciones
- Commits pequeños y descriptivos.
- Documentar decisiones (ADR ligero) en `docs/`.
- No romper el Excel: mantener compatibilidad durante el MVP.
