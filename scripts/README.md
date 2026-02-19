# Scripts

## migrate-from-sheets.ts — Importación histórica

Importa pedidos históricos desde CSV exportado de Google Sheets.

```bash
# Instalar dependencias locales del script
npm install tsx @supabase/supabase-js csv-parse

# Dry run (no escribe en Supabase)
npx tsx scripts/migrate-from-sheets.ts \
  --csv ./data/pedidos.csv \
  --tab "Pedidos" \
  --dry-run

# Importación real
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
npx tsx scripts/migrate-from-sheets.ts \
  --csv ./data/pedidos.csv \
  --tab "Pedidos"
```

### Proceso recomendado

1. Exportar cada pestaña como CSV desde Google Sheets (Archivo → Descargar → CSV)
2. Guardar en `data/` (carpeta ignorada por git — añadir a .gitignore)
3. Ejecutar `--dry-run` primero para verificar el mapeo
4. Ejecutar la importación real
5. Verificar en la app web que los datos son correctos

### Pestañas a importar

```bash
for tab in "Pedidos" "KIT Digital" "Hardware One Off" "Hardware Financiación" "Transferencias SaaS"; do
  npx tsx scripts/migrate-from-sheets.ts \
    --csv "./data/${tab}.csv" \
    --tab "${tab}"
done
```
