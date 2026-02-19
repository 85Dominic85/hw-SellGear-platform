# Agentes

Perfiles para delegar tareas dentro de Claude Code. Recomendación: usa un agente por tipo de trabajo y dales objetivo + criterios de salida.

## Agentes disponibles (repo)
- `product_owner` — alcance MVP, criterios, backlog
- `integrations_engineer` — Typeform/Sheets/Slack/Email
- `supabase-schema-architect` — schema + migraciones + RLS
- `backend_supabase`, `backend-architect` — backend/edge functions/arquitectura
- `frontend_nextjs`, `expert-nextjs-developer`, `frontend-developer` — app web
- `ui-ux-designer` — UX/UI
- `manager_analytics` — métricas/dashboard
- `code-reviewer`, `debugger` — calidad y fixes
- `nextjs-architecture-expert`, `react-performance-optimizer` — arquitectura/performance
- `supabase-realtime-optimizer` — realtime (fase posterior)

## Flujo recomendado
1) PO define stories → 2) Schema/RLS → 3) Integraciones → 4) Web app → 5) Tests/review
