#!/usr/bin/env npx tsx
// =============================================================
// Script: migrate-from-sheets.ts
// Migra datos históricos de Google Sheets → Supabase
//
// Uso:
//   npx tsx scripts/migrate-from-sheets.ts --csv ./data/pedidos.csv --tab Pedidos
//   npx tsx scripts/migrate-from-sheets.ts --csv ./data/kit-digital.csv --tab "KIT Digital"
//
// Requisitos:
//   npm install tsx @supabase/supabase-js csv-parse
//   SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
// =============================================================

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'

// -----------------------------------------------
// Config
// -----------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos en .env')
  process.exit(1)
}

const args = process.argv.slice(2)
const csvIndex = args.indexOf('--csv')
const tabIndex = args.indexOf('--tab')

if (csvIndex === -1 || tabIndex === -1) {
  console.error('❌ Uso: npx tsx scripts/migrate-from-sheets.ts --csv <file.csv> --tab <nombre_pestaña>')
  process.exit(1)
}

const csvPath = path.resolve(args[csvIndex + 1])
const sheetTab = args[tabIndex + 1]
const dryRun = args.includes('--dry-run')

// -----------------------------------------------
// Mapeo columnas CSV → campos de la tabla orders
// Ajusta los nombres de columna según el export real
// -----------------------------------------------

type PurchaseType = 'kit_digital' | 'hardware_one_off' | 'hardware_financiacion' | 'transferencias_saas' | 'otro'

const TAB_TO_PURCHASE_TYPE: Record<string, PurchaseType> = {
  'pedidos':              'otro',
  'kit digital':          'kit_digital',
  'hardware one off':     'hardware_one_off',
  'hardware financiación': 'hardware_financiacion',
  'hardware financiacion': 'hardware_financiacion',
  'transferencias saas':  'transferencias_saas',
}

function normalizePurchaseType(tab: string): PurchaseType {
  return TAB_TO_PURCHASE_TYPE[tab.toLowerCase()] ?? 'otro'
}

interface SheetRow {
  [key: string]: string
}

function parseAmount(raw: string | undefined): number | null {
  if (!raw || !raw.trim()) return null
  const cleaned = raw.replace(/[€$,\s]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function mapRowToOrder(row: SheetRow, sheetTab: string, rowIndex: number) {
  return {
    // Columnas del sheet MainOperation (nombres tal cual aparecen en el export CSV)
    customer_name:    (row['Nombre del cliente'] ?? row['nombre_del_cliente'] ?? '').trim() || 'Sin nombre',
    venue_name:       (row['Bar'] ?? row['bar'] ?? '').trim() || null,
    contact_email:    (row['Email'] ?? row['email'] ?? '').trim() || null,
    phone:            (row['Nº Teléfono'] ?? row['telefono'] ?? '').trim() || null,
    purchase_type:    normalizePurchaseType(sheetTab),
    amount:           parseAmount(row['Importe'] ?? row['importe']),
    bank_receipt_url: (row['Justificante Bancario'] ?? row['justificante_bancario'] ?? '').trim() || null,
    ae_ref:           (row['AE'] ?? row['ae'] ?? '').trim() || null,
    shipping_address: (row['Dirección de Envío'] ?? row['direccion_envio'] ?? '').trim() || null,
    status:           'completado' as const, // histórico = completado por defecto
    hubspot_ref:      (row['Hubspot'] ?? row['hubspot'] ?? '').trim() || null,
    invoice_ref:      (row['Factura'] ?? row['factura'] ?? '').trim() || null,
    notes:            (row['Otros'] ?? row['otros'] ?? '').trim() || null,
    source:           'legacy_import',
    sheet_tab:        sheetTab,
    sheet_row:        rowIndex + 2, // +1 para offset 1, +1 por header
  }
}

// -----------------------------------------------
// Main
// -----------------------------------------------

async function main() {
  console.log(`📄 Leyendo CSV: ${csvPath}`)
  console.log(`📋 Pestaña: ${sheetTab}`)
  if (dryRun) console.log('🔍 DRY RUN — no se escribirá en Supabase')

  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const rows: SheetRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  console.log(`\n📊 Filas encontradas: ${rows.length}`)

  if (dryRun) {
    console.log('\nMuestra de los primeros 3 registros mapeados:')
    rows.slice(0, 3).forEach((row, i) => {
      console.log(`\n[${i + 1}]`, JSON.stringify(mapRowToOrder(row, sheetTab, i), null, 2))
    })
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  let imported = 0
  let errors = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const orderData = mapRowToOrder(row, sheetTab, i)

    if (!orderData.customer_name || orderData.customer_name === 'Sin nombre') {
      console.warn(`⚠️  Fila ${i + 2}: sin customer_name — omitida`)
      continue
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select('id, operation_id')
      .single()

    if (orderError) {
      console.error(`❌ Fila ${i + 2}: ${orderError.message}`)
      errors++
      continue
    }

    // Crear product si hay columna Producto
    const productName = (row['Producto'] ?? row['producto'] ?? '').trim()
    if (productName && order) {
      await supabase.from('order_items').insert({
        order_id:     order.id,
        product_name: productName,
        qty:          1,
      })
    }

    // Seed status_history con estado completado
    if (order) {
      await supabase.from('status_history').insert({
        order_id:   order.id,
        from_status: null,
        to_status:  'completado',
        comment:    'Importado desde Google Sheets (legacy)',
      })
    }

    imported++
    if (imported % 10 === 0) {
      process.stdout.write(`\r✅ Importados: ${imported}/${rows.length}`)
    }
  }

  console.log(`\n\n✅ Importación completada: ${imported} pedidos / ${errors} errores`)
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
