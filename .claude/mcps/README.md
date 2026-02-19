# MCPs

MCPs = conectores/herramientas externas para operar desde Claude Code.

## Config principal
- Claude Code lee servidores MCP desde **`.mcp.json`** (en la raíz).
- En este repo, `.mcp.json` incluye Supabase (actualmente en modo `--read-only` para inspección).
- Para añadir Sheets/Slack/Gmail, sigue la guía en los `.md` de esta carpeta y usa la plantilla `mcp_servers.example.json`.

## MCPs documentados
- `supabase_mcp.md`
- `google_sheets_mcp.md`
- `slack_mcp.md`
- `gmail_mcp.md` (fase 2)
