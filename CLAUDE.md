# Instrucciones para Claude Code

Este repositorio define la plataforma de gestión de MainOperation para Hardware.

## Principios
- **Supabase** es la única fuente de verdad. Toda la operativa de la empresa vive en esta app.
- Validaciones server-side: no confiar en campos libres.
- Trazabilidad: todo cambio relevante debe quedar en `status_history`/auditoría.

## Cómo trabajar aquí
- Prompt recomendado: `/.claude/PROMPT_MVP.md`
- Usa los **agentes** en `/.claude/agents/` para repartir tareas.
- Usa los **skills** en `/.claude/skills/` para ejecutar patrones repetibles.
- Configura e integra **MCPs** en `/.claude/mcps/` (config principal en `.mcp.json`).
- Comandos útiles: `/.claude/commands/` (ej: `generate-tests.md`).

## Entregables esperados
- Migraciones SQL + políticas RLS.
- Edge Functions para webhooks e integraciones (TIPSA, Typeform, notify-slack).
- App web (Next.js) con login Google Workspace.

## Convenciones
- Commits pequeños y descriptivos.
- Documentar decisiones (ADR ligero) en `docs/`.
- Cambios SQL siempre manuales en Supabase SQL Editor; los archivos en `supabase/migrations/` quedan como trazabilidad y para CI.
- Verificar builds con `apps/web/node_modules/.bin/next build apps/web` (reproduce el type-check de Vercel; `npx tsc` desde la raíz falla silencioso).
