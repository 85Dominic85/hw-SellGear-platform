// =============================================================
// Tests: lib/slack.ts — render del mensaje, menciones y filtro de estados.
// No tocan red; postToSlack solo se prueba en su ruta de skip (sin webhook).
// =============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatMentions,
  resolveCategoryMentions,
  buildSlackMessage,
  notifyOrderEvent,
  postToSlack,
  SLACK_NOTIFY_STATUSES,
  type NotifyCtx,
} from '@/lib/slack'

const APP_URL = 'https://app.example.com'

// Helper: extrae el texto markdown del primer section block (el del mensaje).
function blockText(msg: { blocks: object[] }): string {
  const first = msg.blocks[0] as { type: string; text: { text: string } }
  return first.text.text
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

describe('buildSlackMessage — new_order', () => {
  it('incluye el operation_id como enlace y el cliente', () => {
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
    const t = blockText(msg)
    expect(t).toContain('<!here> <@U001>')
    expect(t).toContain('Nuevo pedido')
    expect(t).toContain('<https://app.example.com/orders/oid-123|HW-202605-1788>')
    expect(t).toContain('ACME S.L.')
    expect(t).toContain('Bar Test')
    expect(t).toContain('Ignacio Marín')
  })

  it('sin prefix de menciones no añade saltos extra', () => {
    const ctx: NotifyCtx = {
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'X',
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    expect(blockText(msg).startsWith('*')).toBe(true)
  })
})

describe('buildSlackMessage — status_change', () => {
  it('renderiza transición con labels legibles', () => {
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
    const t = blockText(msg)
    expect(t).toContain('Pendiente → Enviado')
    expect(t).toContain('Hardware Team')
    expect(t).toContain('> Tracking 123')
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
    const t = blockText(msg)
    expect(t).toContain('<!here>')
    expect(t).toContain('AE Juan (commercial)')
    expect(t).toContain('> Hola Hardware,')
    expect(t).toContain('> dos líneas.')
  })
})

describe('buildSlackMessage — financing_payment', () => {
  it('renderiza el plazo y el importe en euros', () => {
    const ctx: NotifyCtx = {
      event: 'financing_payment',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      installment_no: 1,
      amount_cents: 60500,
    }
    const msg = buildSlackMessage(ctx, '', APP_URL)
    const t = blockText(msg)
    expect(t).toContain('Entrada (1.º)')
    expect(t).toMatch(/605,00\s?€/)
  })
})

describe('SLACK_NOTIFY_STATUSES + notifyOrderEvent skip', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    // Webhook sin configurar → postToSlack también haría skip.
    vi.stubEnv('SLACK_WEBHOOK_URL', '')
    // postToSlack ahora loguea con console.warn cuando no hay URL;
    // silenciamos para que el output de los tests no se ensucie.
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

  it('incluye <@requester_slack_user_id> junto a <!here>', async () => {
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
    expect(text).toContain('<!here>')
    expect(text).toContain('<@UREQUESTER>')
  })

  it('si requester_slack_user_id es null, solo @aquí (sin extra mención)', async () => {
    await notifyOrderEvent({
      event: 'new_order',
      order_id: 'oid',
      operation_id: 'HW-1',
      customer_name: 'ACME',
      requester_slack_user_id: null,
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    const text = (body.blocks[0] as { text: { text: string } }).text.text
    expect(text).toContain('<!here>')
    expect(text).not.toMatch(/<@U[A-Z0-9]+>/)
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
