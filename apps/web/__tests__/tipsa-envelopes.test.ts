/**
 * Tests del parser SOAP TIPSA con fixtures reales de la documentacion oficial.
 * Fixtures: docs/integrations/tipsa/extracted/Ejemplos/
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildConsEnvEstadosEnvelope,
  buildConsEtiquetaEnvelope,
  buildGrabaEnvio24Envelope,
  buildLoginEnvelope,
  parseConsEnvEstadosResponse,
  parseEnvEstadosCdata,
  parseGrabaEnvioResponse,
  parseLoginResponse,
  parseTipsaDate,
  xmlEscape,
} from '@/lib/tipsa/envelopes'
import { buildPublicTrackingUrl, tipsaEventLabel } from '@/lib/tipsa/services'

const FIXTURES_BASE = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'integrations',
  'tipsa',
  'extracted',
  'Ejemplos',
)

function fixture(relativePath: string): string {
  return readFileSync(resolve(FIXTURES_BASE, relativePath), 'utf-8')
}

// ==========================================================
// xmlEscape
// ==========================================================

describe('xmlEscape', () => {
  it('escapes XML special chars', () => {
    expect(xmlEscape('A & B < C > D "E" \'F\'')).toBe(
      'A &amp; B &lt; C &gt; D &quot;E&quot; &apos;F&apos;',
    )
  })
  it('returns empty string for null/undefined', () => {
    expect(xmlEscape(null)).toBe('')
    expect(xmlEscape(undefined)).toBe('')
  })
  it('stringifies numbers and booleans', () => {
    expect(xmlEscape(1.5)).toBe('1.5')
    expect(xmlEscape(true)).toBe('true')
  })
})

// ==========================================================
// Login
// ==========================================================

describe('Login', () => {
  it('builds a valid LoginCli2 envelope with escaped password', () => {
    const xml = buildLoginEnvelope({
      agencyCode: '000000',
      clientCode: '33333',
      password: 'Ts#<>&"',
    })
    expect(xml).toContain('<tem:LoginWSService___LoginCli2>')
    expect(xml).toContain('<tem:strCodAge>000000</tem:strCodAge>')
    expect(xml).toContain('<tem:strCod>33333</tem:strCod>')
    expect(xml).toContain('Ts#&lt;&gt;&amp;&quot;')
  })

  it('parses LoginCli_response fixture (legacy) and returns session id', () => {
    const xml = fixture('Login/LoginCli_response.txt')
    const parsed = parseLoginResponse(xml)
    expect(parsed.sessionId).toBe('{8D5400DC-1FEA-42CC-BFB6-B829E11ACBDF}')
    expect(parsed.clientName).toBe('CLIENTES PRUEBAS MAGENTO')
    expect(parsed.version).toBe('0.01.71')
    expect(parsed.trackingBaseUrl).toContain('dinapaqweb')
    expect(parsed.trackingBaseUrl).toContain('{GUID}')
    expect(parsed.trackingBaseUrl).toContain('{FECHA}')
  })

  it('throws if strError != 0 / Result != true', () => {
    const malformed = `<?xml version="1.0"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
<SOAP-ENV:Body>
  <v1:LoginWSService___LoginCliResponse xmlns:v1="http://tempuri.org/">
    <v1:Result>false</v1:Result>
    <v1:strError>5</v1:strError>
  </v1:LoginWSService___LoginCliResponse>
</SOAP-ENV:Body>
</SOAP-ENV:Envelope>`
    expect(() => parseLoginResponse(malformed)).toThrow(/login failed.*strError=5/i)
  })
})

// ==========================================================
// GrabaEnvio24
// ==========================================================

describe('GrabaEnvio24', () => {
  const creds = { agencyCode: '000000', clientCode: '33333' }
  const sessionId = '{TEST-GUID}'
  const sender = {
    name: 'QR PAYMENTS Qamarero',
    address: 'P.º Alcalde Marqués del Contadero, s/n',
    city: 'Sevilla',
    cp: '41001',
    phone: '602687553',
  }
  const input = {
    serviceCode: '48',
    packages: 1,
    weightKg: 1.5,
    content: 'Productos hardware',
    observations: 'Dejar en portería',
    reference: 'HW-202604-0001',
    recipient: {
      name: 'Bar El Rinconcito',
      address: 'Calle Betis 12',
      city: 'Sevilla',
      cp: '41010',
      phone: '666111222',
      email: 'bar@example.com',
      country: 'ES',
    },
    date: '2026-04-20',
  }

  it('builds a valid GrabaEnvio24 envelope', () => {
    const xml = buildGrabaEnvio24Envelope({ creds, sessionId, sender, input })
    expect(xml).toContain('<tem:WebServService___GrabaEnvio24>')
    expect(xml).toContain('<tem:strCodAgeCargo>000000</tem:strCodAgeCargo>')
    expect(xml).toContain('<tem:strCodCli>33333</tem:strCodCli>')
    expect(xml).toContain('<tem:strCodTipoServ>48</tem:strCodTipoServ>')
    expect(xml).toContain('<tem:strNomOri>QR PAYMENTS Qamarero</tem:strNomOri>')
    expect(xml).toContain('<tem:strCPOri>41001</tem:strCPOri>')
    expect(xml).toContain('<tem:strNomDes>Bar El Rinconcito</tem:strNomDes>')
    expect(xml).toContain('<tem:strCPDes>41010</tem:strCPDes>')
    // CP prefijado en strPobDes para que TIPSA lo imprima siempre en la etiqueta.
    expect(xml).toContain('<tem:strPobDes>41010 Sevilla</tem:strPobDes>')
    expect(xml).toContain('<tem:intPaq>1</tem:intPaq>')
    expect(xml).toContain('<tem:dPesoOri>1.5</tem:dPesoOri>')
    expect(xml).toContain('<tem:strRef>HW-202604-0001</tem:strRef>')
    expect(xml).toContain('<tem:boDesEmail>true</tem:boDesEmail>')
    expect(xml).toContain('<tem:dtFecha>2026-04-20</tem:dtFecha>')
    expect(xml).toContain('<tem:ID>{TEST-GUID}</tem:ID>')
    // boRetorno false por defecto (envio sin recogida)
    expect(xml).toContain('<tem:boRetorno>false</tem:boRetorno>')
  })

  it('sets boDesEmail=false when recipient has no email', () => {
    const xml = buildGrabaEnvio24Envelope({
      creds,
      sessionId,
      sender,
      input: { ...input, recipient: { ...input.recipient, email: undefined } },
    })
    expect(xml).toContain('<tem:boDesEmail>false</tem:boDesEmail>')
  })

  it('sets boRetorno=true when returnShipment flag is on', () => {
    const xml = buildGrabaEnvio24Envelope({
      creds,
      sessionId,
      sender,
      input: { ...input, returnShipment: true },
    })
    expect(xml).toContain('<tem:boRetorno>true</tem:boRetorno>')
  })

  it('includes strPersContacto when contactPerson is set on recipient', () => {
    const xml = buildGrabaEnvio24Envelope({
      creds,
      sessionId,
      sender,
      input: {
        ...input,
        recipient: { ...input.recipient, contactPerson: 'Juan García' },
      },
    })
    expect(xml).toContain('<tem:strPersContacto>Juan García</tem:strPersContacto>')
  })

  it('sends empty strPersContacto when contactPerson is omitted', () => {
    const xml = buildGrabaEnvio24Envelope({ creds, sessionId, sender, input })
    expect(xml).toContain('<tem:strPersContacto></tem:strPersContacto>')
  })

  it('falls back to city only when recipient cp is empty', () => {
    const xml = buildGrabaEnvio24Envelope({
      creds,
      sessionId,
      sender,
      input: { ...input, recipient: { ...input.recipient, cp: '' } },
    })
    // Sin CP no se prefija (evita "  Sevilla" con espacio suelto)
    expect(xml).toContain('<tem:strPobDes>Sevilla</tem:strPobDes>')
  })

  it('parses GrabaEnvio16_response fixture and extracts albaran + guid', () => {
    const xml = fixture('GrabaEnvio/GrabaEnvio16_response.txt')
    const parsed = parseGrabaEnvioResponse(xml)
    expect(parsed.albaran).toBe('9999154621')
    expect(parsed.guid).toBe('{A01CCC2A-0E00-43F0-A669-F42B21195FFE}')
    expect(parsed.packagesCount).toBe(1)
    expect(parsed.deliveryDate).toContain('2019-11-12')
  })

  it('parses GrabaEnvio24_response fixture', () => {
    const xml = fixture('GrabaEnvio/GrabaEnvio24_response.txt')
    const parsed = parseGrabaEnvioResponse(xml)
    expect(parsed.albaran).toBeTruthy()
    expect(parsed.albaran.length).toBeGreaterThan(5)
  })
})

// ==========================================================
// ConsEtiqueta
// ==========================================================

describe('ConsEtiquetaEnvio6', () => {
  it('builds a valid ConsEtiqueta envelope', () => {
    const xml = buildConsEtiquetaEnvelope({
      creds: { agencyCode: '000000' },
      sessionId: '{SESSION}',
      albaran: '9999135190',
      format: 'pdf',
    })
    expect(xml).toContain('<tem:StrAlbaran>9999135190</tem:StrAlbaran>')
    expect(xml).toContain('<tem:strFormato>pdf</tem:strFormato>')
    expect(xml).toContain('<tem:intIdRepDet>233</tem:intIdRepDet>')
  })
})

// ==========================================================
// ConsEnvEstados
// ==========================================================

describe('ConsEnvEstados', () => {
  it('builds a valid ConsEnvEstados envelope', () => {
    const xml = buildConsEnvEstadosEnvelope({
      creds: { agencyCode: '000000' },
      sessionId: '{SESSION}',
      albaran: '9999171970',
    })
    expect(xml).toContain('<tem:strAlbaran>9999171970</tem:strAlbaran>')
  })

  it('parses ConsEnvEstados_response and extracts events', () => {
    const xml = fixture('ConsEnvEstados/ConsEnvEstados_response.txt')
    const parsed = parseConsEnvEstadosResponse(xml, '9999171970')
    expect(parsed.events.length).toBe(5)
    // Primer evento es "Alta" (codigo 1)
    expect(parsed.events[0].code).toBe('1')
    expect(parsed.events[0].label).toBe('Alta')
    // Ultimo es codigo 3 (incidencia) segun fixture
    expect(parsed.events[parsed.events.length - 1].code).toBe('3')
    // Todas las fechas son ISO
    for (const e of parsed.events) {
      expect(() => new Date(e.date).toISOString()).not.toThrow()
      expect(new Date(e.date).toISOString()).toBe(e.date)
    }
  })

  it('parses empty CDATA as empty events', () => {
    expect(parseEnvEstadosCdata('')).toEqual([])
    expect(parseEnvEstadosCdata('   ')).toEqual([])
  })
})

// ==========================================================
// Helpers
// ==========================================================

describe('parseTipsaDate', () => {
  it('parses TIPSA date as MM/DD/YYYY (US format)', () => {
    // TIPSA envia fechas en formato americano MM/DD/YYYY a pesar de ser
    // servicio espanol. "02/06/2020" significa 6 de febrero de 2020 (mm=02, dd=06).
    const iso = parseTipsaDate('02/06/2020 17:28:02')
    expect(iso).toBe('2020-02-06T17:28:02.000Z')
  })
  it('parses unambiguous MM/DD with day > 12', () => {
    // El "28" solo puede ser dia. Esto desambigua MM/DD vs DD/MM.
    // Fixture oficial: ConsEnvEstados_code4_response.txt
    const iso = parseTipsaDate('11/28/2019 17:50:44')
    expect(iso).toBe('2019-11-28T17:50:44.000Z')
  })
  it('returns a valid ISO string on malformed input', () => {
    const iso = parseTipsaDate('not a date')
    expect(() => new Date(iso)).not.toThrow()
  })
})

describe('tipsaEventLabel', () => {
  it('maps known codes', () => {
    expect(tipsaEventLabel('1')).toBe('Alta')
    expect(tipsaEventLabel('2')).toBe('Entregado')
    expect(tipsaEventLabel('3')).toBe('Incidencia')
    expect(tipsaEventLabel('4')).toBe('En tránsito')
  })
  it('falls back on unknown codes', () => {
    expect(tipsaEventLabel('99')).toBe('Estado 99')
  })
})

describe('buildPublicTrackingUrl', () => {
  it('strips braces from GUID and formats date as DD/MM/YYYY per TIPSA docs', () => {
    const url = buildPublicTrackingUrl(
      'https://example/seg.php?servicio={GUID}&fecha={FECHA}',
      '{ABC-123}',
      new Date(2026, 3, 21, 12, 0, 0), // 21 abril 2026 (local time)
    )
    expect(url).toBe('https://example/seg.php?servicio=ABC-123&fecha=21/04/2026')
  })
  it('pads single-digit day and month to 2 chars', () => {
    const url = buildPublicTrackingUrl(
      'https://example/seg.php?servicio={GUID}&fecha={FECHA}',
      'XYZ',
      new Date(2026, 0, 5, 12, 0, 0), // 5 enero 2026
    )
    expect(url).toContain('fecha=05/01/2026')
  })
  it('preserves GUID without braces unchanged', () => {
    const url = buildPublicTrackingUrl(
      'https://example/seg.php?servicio={GUID}',
      'NO-BRACES-GUID',
      new Date(2026, 3, 21),
    )
    expect(url).toContain('servicio=NO-BRACES-GUID')
  })
  it('returns null if base is null', () => {
    expect(buildPublicTrackingUrl(null, 'x', new Date())).toBeNull()
  })
})
