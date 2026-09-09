/**
 * Tests para el envelope + parser de ConsEnvEstIncCambiosEstados.
 * -----------------------------------------------------------------------------
 * Verifica que:
 *  - El request se construye con formato YYYY/MM/DD HH:MM:SS (hora Madrid).
 *  - El parser extrae correctamente los deltas del CDATA con V_ALBARAN +
 *    V_COD_TIPO_EST + D_FEC_HORA_ALTA_EST (MM/DD/YYYY, hora Madrid a UTC).
 *  - Detecta hasMore segun iTotalPaginasOut vs iPagina solicitada.
 */

import { describe, expect, it } from 'vitest'
import {
  buildConsEnvEstIncCambiosEstadosEnvelope,
  formatTipsaRequestDate,
  parseConsEnvEstIncCambiosEstadosResponse,
  parseEnvEstIncCambiosCdata,
} from '@/lib/tipsa/envelopes'

describe('formatTipsaRequestDate', () => {
  it('formatea ISO UTC en YYYY/MM/DD HH:MM:SS hora Madrid (verano CEST +2)', () => {
    // 15 junio 2026 10:00 UTC -> 12:00 Madrid CEST
    expect(formatTipsaRequestDate('2026-06-15T10:00:00Z')).toBe('2026/06/15 12:00:00')
  })
  it('formatea ISO UTC en YYYY/MM/DD HH:MM:SS hora Madrid (invierno CET +1)', () => {
    // 15 enero 2026 11:00 UTC -> 12:00 Madrid CET
    expect(formatTipsaRequestDate('2026-01-15T11:00:00Z')).toBe('2026/01/15 12:00:00')
  })
})

describe('buildConsEnvEstIncCambiosEstadosEnvelope', () => {
  it('incluye session, ventana y pagina', () => {
    const xml = buildConsEnvEstIncCambiosEstadosEnvelope({
      sessionId: '{ABC}',
      sinceDate: '2026-06-15T08:00:00Z',
      untilDate: '2026-06-15T10:00:00Z',
      page: 0,
    })
    expect(xml).toContain('<tem:ID>{ABC}</tem:ID>')
    expect(xml).toContain('<tem:dtFecHoraEstadoInicio>2026/06/15 10:00:00</tem:dtFecHoraEstadoInicio>')
    expect(xml).toContain('<tem:dtFecHoraEstadoFin>2026/06/15 12:00:00</tem:dtFecHoraEstadoFin>')
    expect(xml).toContain('<tem:iPagina>0</tem:iPagina>')
    expect(xml).toContain('WebServService___ConsEnvEstIncCambiosEstados')
  })
  it('page > 0 se refleja en iPagina', () => {
    const xml = buildConsEnvEstIncCambiosEstadosEnvelope({
      sessionId: '{X}',
      sinceDate: '2026-06-15T08:00:00Z',
      untilDate: '2026-06-15T10:00:00Z',
      page: 3,
    })
    expect(xml).toContain('<tem:iPagina>3</tem:iPagina>')
  })
})

describe('parseEnvEstIncCambiosCdata', () => {
  it('extrae multiples deltas con albaran, code y date en ISO UTC', () => {
    const cdata =
      '<CONSULTA>' +
      '<ENV_EST_INC_CAMBIOS_ESTADOS V_ALBARAN="0000011291" V_COD_TIPO_EST="4" D_FEC_HORA_ALTA_EST="05/06/2026 10:00:00"/>' +
      '<ENV_EST_INC_CAMBIOS_ESTADOS V_ALBARAN="0000011291" V_COD_TIPO_EST="2" D_FEC_HORA_ALTA_EST="05/07/2026 09:30:00"/>' +
      '<ENV_EST_INC_CAMBIOS_ESTADOS V_ALBARAN="0000011346" V_COD_TIPO_EST="5" D_FEC_HORA_ALTA_EST="05/06/2026 15:45:00"/>' +
      '</CONSULTA>'
    const deltas = parseEnvEstIncCambiosCdata(cdata)
    expect(deltas).toHaveLength(3)
    expect(deltas[0].albaran).toBe('0000011291')
    expect(deltas[0].code).toBe('4')
    expect(deltas[0].label).toBe('Incidencia')
    // 05/06/2026 en MM/DD = 6 mayo 2026 10:00 Madrid CEST (+2) = 08:00 UTC
    expect(deltas[0].date).toBe('2026-05-06T08:00:00.000Z')
    expect(deltas[2].albaran).toBe('0000011346')
    expect(deltas[2].code).toBe('5')
  })

  it('devuelve array vacio con CDATA vacio', () => {
    expect(parseEnvEstIncCambiosCdata('')).toEqual([])
    expect(parseEnvEstIncCambiosCdata('   ')).toEqual([])
  })

  it('descarta nodos sin albaran o sin code', () => {
    const cdata =
      '<CONSULTA>' +
      '<ENV_EST_INC_CAMBIOS_ESTADOS V_ALBARAN="0001" V_COD_TIPO_EST="2" D_FEC_HORA_ALTA_EST="05/06/2026 10:00:00"/>' +
      '<ENV_EST_INC_CAMBIOS_ESTADOS V_ALBARAN="" V_COD_TIPO_EST="2" D_FEC_HORA_ALTA_EST="05/06/2026 10:00:00"/>' +
      '<ENV_EST_INC_CAMBIOS_ESTADOS V_ALBARAN="0002" V_COD_TIPO_EST="" D_FEC_HORA_ALTA_EST="05/06/2026 10:00:00"/>' +
      '</CONSULTA>'
    const deltas = parseEnvEstIncCambiosCdata(cdata)
    expect(deltas).toHaveLength(1)
    expect(deltas[0].albaran).toBe('0001')
  })

  it('conserva rawAttributes con V_OBS_INC cuando existe', () => {
    const cdata =
      '<CONSULTA>' +
      '<ENV_EST_INC_CAMBIOS_ESTADOS V_ALBARAN="0001" V_COD_TIPO_EST="3" D_FEC_HORA_ALTA_EST="05/06/2026 10:00:00" V_OBS_INC="Destinatario ausente"/>' +
      '</CONSULTA>'
    const deltas = parseEnvEstIncCambiosCdata(cdata)
    expect(deltas[0].rawAttributes['V_OBS_INC']).toBe('Destinatario ausente')
  })
})

describe('parseConsEnvEstIncCambiosEstadosResponse', () => {
  const responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:v1="http://tempuri.org/" xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <v1:WebServService___ConsEnvEstIncCambiosEstadosResponse>
      <v1:strEnvEstIncCambioEstado><![CDATA[<CONSULTA><ENV_EST_INC_CAMBIOS_ESTADOS V_ALBARAN="0001" V_COD_TIPO_EST="4" D_FEC_HORA_ALTA_EST="05/06/2026 10:00:00"/></CONSULTA>]]></v1:strEnvEstIncCambioEstado>
      <v1:iTotalPaginasOut>3</v1:iTotalPaginasOut>
    </v1:WebServService___ConsEnvEstIncCambiosEstadosResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`

  it('parsea deltas + hasMore=true cuando totalPages > page+1', () => {
    const result = parseConsEnvEstIncCambiosEstadosResponse(responseXml, 0)
    expect(result.deltas).toHaveLength(1)
    expect(result.deltas[0].albaran).toBe('0001')
    expect(result.page).toBe(0)
    expect(result.totalPages).toBe(3)
    expect(result.hasMore).toBe(true)
  })

  it('hasMore=false en ultima pagina', () => {
    const result = parseConsEnvEstIncCambiosEstadosResponse(responseXml, 2)
    expect(result.hasMore).toBe(false)
  })
})
