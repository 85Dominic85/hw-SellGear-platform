// =============================================================
// Tests: lib/slack.ts — render del mensaje, menciones, formato de items,
// filtro de estados y logging. No tocan red; postToSlack se prueba con
// fetch mockeado.
// =============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatMentions,
  resolveCategoryMentions,
  formatItemsSummary,
  buildSlackMessage,
  notifyOrderEvent,
  postToSlack,
  SLACK_NOTIFY_STATUSES,
  type NotifyCtx,
} from '@/lib/slack'

const APP_URL = 'https://app.example.com'

// Texto del primer bloque (típicamente el header con menciones + título).
function blockText(msg: { blocks: object[] }): string {
  const first = msg.blocks[0] as { type: string; text: { text: string } }
  return first.text.text
}

// Concatena el texto de todos los bloques (section + fields + context).
// Útil cuando el contenido (cliente, mensaje, comentario...) está
// repartido en varios blocks tras el rediseño.
function allText(msg: { blocks: object[] }): string {
  return msg.blocks
    .map((b) => {
      const block = b as {
        type: string
        text?: { text?: string }
        fields?: { text?: string }[]
        elements?: { text?: string }[]
      }
      if (block.type === 'section') {
        if (block.text?.text) return block.text.text
        if (block.fields) return block.fields.map((f) => f.text ?? '').join(' ')
      }
      if (block.type === 'context') {
        return (block.elements ?? []).map((e) => e.text ?? '').join(' ')
      }
      return ''
    })
    .join('\n')
}

describe('formatMentions', () => {
  it('devuelve cadena vacía sin ids ni here', () => {
    expect(formatMentions([])).toBe('')
    expect(formatMentions([null, undefined, ''])).toBe('')
  })

  it('antepone <!here> cuando here:true', () => {
    expect(formatMentions(['U001'], { here: true })).toBe('<!here> <@U001>')
  })

  it('deduplica y filtra vacíos', () => {
    const out = formatMentions(['U001', ' U001 ', 'U002', '', null, 'U002'])
    expect(out).toBe('<@U001> <@U002>')
  })

  it('here sin ids devuelve solo <!here>', () => {
    expect(formatMentions([], { here: true })).toBe('<!here>')
  })
})

describe('resolveCategoryMentions', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('devuelve [] sin SLACK_CATEGORY_MENTIONS', () => {
    vi.stubEnv('SLACK_CATEGORY_MENTIONS', '')
    expect(resolveCategoryMentions('hardware_one_off')).toEqual([])
  })

  it('mapea por purchase_type', () => {
    vi.stubEnv(
      'SLACK_CATEGORY_MENTIONS',
      JSON.stringify({ hardware_financiacion: ['U001', 'U002'] }),
    )
    expect(resolveCategoryMentions('hardware_financiacion')).toEqual([
      'U001',
      'U002',
    ])
    // Sin match propio y sin default → []
    expect(resolveCategoryMentions('kit_digital')).toEqual([])
  })

  it('cae a "default" si no hay match propio', () => {
    vi.stubEnv(
      'SLACK_CATEGORY_MENTIONS',
      JSON.stringify({
        hardware_financiacion: ['U001'],
        default: ['UFALLBACK'],
      }),
    )
    expect(resolveCategoryMentions('kit_digital')).toEqual(['UFALLBACK'])
    // El específico no usa default.
    expect(resolveCategoryMentions('hardware_financiacion')).toEqual(['U001'])
  })

  it('devuelve [] con JSON inválido (no lanza)', () => {
    vi.stubEnv('SLACK_CATEGORY_MENTIONS', '{not json}')
    expect(resolveCategoryMentions('hardware_one_off')).toEqual([])
  })

  it('ignora arrays con elementos no-string', () => {
    vi.stubEnv(
      'SLACK_CATEGORY_MENTIONS',
      JSON.stringify({ kit_digital: ['U001', 42, null, '  '] }),
    )
    expect(resolveCategoryMentions('kit_digital')).toEqual(['U001'])
  })
})

describe('formatItemsSummary', () => {
  it('devuelve cadena vacía sin items', () => {
    expect(formatItemsSummary([])).toBe('')
  })

  it('formatea un solo ítem', () => {
    expect(formatItemsSummary([{ product_name: 'Pack Pro', qty: 2 }])).toBe(
      '2× Pack Pro',
    )
  })

  it('separa con punto medio (·) y respeta maxLines (3 por defecto)', () => {
    const items = [
      { product_name: 'Pack Pro', qty: 2 },
      { product_name: 'TPV', qty: 1 },
      { product_name: 'KDS', qty: 1 },
    ]
    expect(formatItemsSummary(items)).toBe('2× Pack Pro · 1× TPV · 1× KDS')
  })

  it('trunca añadiendo "+N más" cuando hay más items que maxLines', () => {
    const items = [
      { product_name: 'A', qty: 1 },
      { product_name: 'B', qty: 1 },
      { product_name: 'C', qty: 1 },
      { product_name: 'D', qty: 1 },
      { product_name: 'E', qty: 1 },
    ]
    expect(formatItemsSummary(items, 3)).toBe('1× A · 1× B · 1× C · +2 más')
  })
})

describe('buildSlackMessage — new_order', () => {
  it('incluye el operation_id como enlace, cliente, local y solicitante', () => {
    const ctx: NotifyCtx = {
      event: 'new_order',
      order_id: 'oid-123',
      operation_id: 'HW-202605-1788',
      customer_name: 'ACME S.L.',
      venue_name: 'Bar Test',
      requester_name: 'Ignacio Marín',
      purchase_type: 'hardware_one_off',
    }
    const msg = buildSlackMessage(ctx, '<!here> <@U001>', APP_URL)
    expect(msg.text).toBe('Nuevo pedido HW-202605-1788')
    // Header (block 0) lleva menciones + título + link
    const header = blockText(msg)
    expect(header).toContain('<!here> <@U001>')
    expect(header).toContain('Nuevo pedido')
    expect(header).toContain('<https://app.example.com/orders/oid-123|HW-202605-1788>')
    // Cuerpo combinado tiene los datos del pedido
    const t = allText(msg)
    expect(t).toContain('ACME S.L.')
    expect(t).toContain('Bar Test')
    expect(t).toContain('Ignacio Marín')
  })

  it('sin prefix de menciones el header empieza por *', () => {
    const ctx: NotifyCtx = {
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'X',
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    expect(blockText(msg).startsWith('*')).toBe(true)
  })

  it('enriquecido: incluye Tipo, Importe, Productos y Envío', () => {
    const ctx: NotifyCtx = {
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      purchase_type: 'hardware_one_off',
      amount_cents: 123456,
      items_summary: '2× Pack Pro · 1× TPV',
      shipping_city: 'Madrid',
      shipping_cp: '28001',
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    const t = allText(msg)
    expect(t).toContain('*Tipo:*')
    expect(t).toContain('Hardware One Off')
    expect(t).toContain('*Importe:*')
    // Regex tolerante: prod (Vercel full ICU) muestra "1.234,56 €"; entorno
    // de tests (Node small ICU) muestra "1234,56 €". Aceptamos ambos.
    expect(t).toMatch(/1\.?234,56\s?€/)
    expect(t).toContain('*Productos:*')
    expect(t).toContain('2× Pack Pro · 1× TPV')
    expect(t).toContain('*Envío:*')
    expect(t).toContain('Madrid (28001)')
  })

  it('renderiza el comentario libre como bloque quoted', () => {
    const ctx: NotifyCtx = {
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      comment: 'Urgente: necesitan KDS antes del viernes',
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    const t = allText(msg)
    expect(t).toContain('*Comentario:*')
    expect(t).toContain('> Urgente: necesitan KDS antes del viernes')
  })

  it('añade un segundo botón "Ver en HubSpot" si hubspot_ref está relleno', () => {
    const ctx: NotifyCtx = {
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      hubspot_ref: 'https://app.hubspot.com/contacts/123/deal/456',
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    const actions = msg.blocks.find(
      (b) => (b as { type: string }).type === 'actions',
    ) as { elements: Array<{ url: string }> } | undefined
    expect(actions).toBeDefined()
    expect(actions!.elements.length).toBe(2)
    expect(actions!.elements[1].url).toBe(
      'https://app.hubspot.com/contacts/123/deal/456',
    )
  })

  it('sin hubspot_ref el bloque actions tiene un solo botón', () => {
    const ctx: NotifyCtx = {
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    const actions = msg.blocks.find(
      (b) => (b as { type: string }).type === 'actions',
    ) as { elements: unknown[] } | undefined
    expect(actions!.elements.length).toBe(1)
  })

  it('context footer incluye al creador si está disponible', () => {
    const ctx: NotifyCtx = {
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      creator_name: 'Gloria Pérez',
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    const context = msg.blocks.find(
      (b) => (b as { type: string }).type === 'context',
    ) as { elements: Array<{ text: string }> } | undefined
    expect(context).toBeDefined()
    expect(context!.elements[0].text).toContain('Gloria Pérez')
  })
})

describe('buildSlackMessage — status_change', () => {
  it('renderiza transición con labels legibles + icono según destino', () => {
    const ctx: NotifyCtx = {
      event: 'status_change',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      from_status: 'pendiente',
      to_status: 'enviado',
      changed_by: 'Hardware Team',
      comment: 'Tracking 123',
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    expect(msg.text).toBe('HW-1 → Enviado')
    const header = blockText(msg)
    expect(header).toContain('Pendiente → Enviado')
    expect(header).toContain(':truck:') // icono para 'enviado'
    const t = allText(msg)
    expect(t).toContain('Hardware Team')
    expect(t).toContain('> Tracking 123')
  })

  it('context footer incluye Tipo + Importe', () => {
    const ctx: NotifyCtx = {
      event: 'status_change',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      from_status: 'pendiente',
      to_status: 'enviado',
      purchase_type: 'kit_digital',
      amount_cents: 50000,
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    const context = msg.blocks.find(
      (b) => (b as { type: string }).type === 'context',
    ) as { elements: Array<{ text: string }> } | undefined
    expect(context).toBeDefined()
    expect(context!.elements[0].text).toContain('KIT Digital')
    expect(context!.elements[0].text).toMatch(/500,00\s?€/)
  })
})

describe('buildSlackMessage — message_to_hardware', () => {
  it('incluye autor con rol y mensaje', () => {
    const ctx: NotifyCtx = {
      event: 'message_to_hardware',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      author_name: 'AE Juan',
      author_role: 'commercial',
      message: 'Hola Hardware,\ndos líneas.',
    }
    const msg = buildSlackMessage(ctx, '<!here>', APP_URL)
    const header = blockText(msg)
    expect(header).toContain('<!here>')
    const t = allText(msg)
    expect(t).toContain('AE Juan (commercial)')
    expect(t).toContain('> Hola Hardware,')
    expect(t).toContain('> dos líneas.')
  })
})

describe('buildSlackMessage — financing_payment', () => {
  it('renderiza el plazo y el importe del plazo en euros', () => {
    const ctx: NotifyCtx = {
      event: 'financing_payment',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      installment_no: 1,
      installment_amount_cents: 60500,
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    const t = allText(msg)
    expect(t).toContain('Entrada (1.º)')
    expect(t).toMatch(/605,00\s?€/)
  })

  it('context footer muestra "Total pedido" si amount_cents (global) está', () => {
    const ctx: NotifyCtx = {
      event: 'financing_payment',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      installment_no: 1,
      installment_amount_cents: 60500,
      amount_cents: 181500, // total = 3 plazos
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    const context = msg.blocks.find(
      (b) => (b as { type: string }).type === 'context',
    ) as { elements: Array<{ text: string }> } | undefined
    expect(context!.elements[0].text).toContain('Total pedido')
    expect(context!.elements[0].text).toMatch(/1\.?815,00\s?€/)
  })
})

describe('SLACK_NOTIFY_STATUSES + notifyOrderEvent skip', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    // Webhook sin configurar → postToSlack también haría skip.
    vi.stubEnv('SLACK_WEBHOOK_URL', '')
    // postToSlack loguea con console.warn cuando no hay URL; silenciamos.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('contiene los estados clave esperados', () => {
    for (const s of [
      'enviado_proveedor',
      'enviado',
      'pagado',
      'falta_informacion',
      'bloqueado',
      'completado',
    ]) {
      expect(SLACK_NOTIFY_STATUSES.has(s)).toBe(true)
    }
    expect(SLACK_NOTIFY_STATUSES.has('pendiente')).toBe(false)
    expect(SLACK_NOTIFY_STATUSES.has('nuevo')).toBe(false)
  })

  it('notifyOrderEvent salta status_change a estados no clave', async () => {
    const out = await notifyOrderEvent({
      event: 'status_change',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      from_status: 'nuevo',
      to_status: 'pendiente',
    })
    expect(out).toEqual({ ok: true, skipped: true })
  })

  it('notifyOrderEvent procesa estados clave (skip por webhook ausente)', async () => {
    const out = await notifyOrderEvent({
      event: 'status_change',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      from_status: 'pendiente',
      to_status: 'enviado',
    })
    // No filtra por estado; salta por SLACK_WEBHOOK_URL vacío.
    expect(out).toEqual({ ok: true, skipped: true })
  })
})

describe('new_order — mención al solicitante', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.test/x')
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'ok',
    })
    vi.stubGlobal('fetch', fetchSpy)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('incluye <@requester_slack_user_id> (sin @aquí: ruido fuera)', async () => {
    const out = await notifyOrderEvent({
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      requester_slack_user_id: 'UREQUESTER',
    })
    expect(out).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    const text = (body.blocks[0] as { text: { text: string } }).text.text
    expect(text).toContain('<@UREQUESTER>')
    expect(text).not.toContain('<!here>')
  })

  it('si requester_slack_user_id es null y sin categoría, no hay mención', async () => {
    await notifyOrderEvent({
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      requester_slack_user_id: null,
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    const text = (body.blocks[0] as { text: { text: string } }).text.text
    // Sin solicitante y sin SLACK_CATEGORY_MENTIONS, el header empieza
    // directamente por el título *:inbox_tray:* (sin prefijo de menciones).
    expect(text).not.toContain('<!here>')
    expect(text).not.toMatch(/<@U[A-Z0-9]+>/)
    expect(text.startsWith('*')).toBe(true)
  })

  it('dedupe: solicitante coincide con mención por categoría', async () => {
    vi.stubEnv(
      'SLACK_CATEGORY_MENTIONS',
      JSON.stringify({ default: ['UDUP', 'UOTRO'] }),
    )
    await notifyOrderEvent({
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      purchase_type: 'hardware_one_off',
      requester_slack_user_id: 'UDUP',
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    const text = (body.blocks[0] as { text: { text: string } }).text.text
    // UDUP aparece una sola vez, no dos.
    const matches = text.match(/<@UDUP>/g) ?? []
    expect(matches.length).toBe(1)
    expect(text).toContain('<@UOTRO>')
  })
})

describe('postToSlack — logging y fallos de red', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('avisa por console.warn cuando SLACK_WEBHOOK_URL no está', async () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', '')
    const out = await postToSlack({ text: 'hi', blocks: [] })
    expect(out).toEqual({ ok: true, skipped: true })
    expect(warnSpy).toHaveBeenCalledWith(
      '[slack] SLACK_WEBHOOK_URL no configurado; mensaje omitido.',
    )
  })

  it('loguea error cuando el webhook responde !ok y devuelve { ok:false }', async () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.test/xyz')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'invalid_payload',
      }),
    )
    const out = await postToSlack({ text: 'hi', blocks: [] })
    expect(out.ok).toBe(false)
    expect(out.error).toBe('invalid_payload')
    expect(errorSpy).toHaveBeenCalledWith('[slack] post falló:', 'invalid_payload')
  })
})
