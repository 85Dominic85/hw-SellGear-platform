// E2E integration test contra TIPSA wsval (entorno de pruebas).
// Ejecuta: login -> GrabaEnvio24 -> ConsEtiquetaEnvio6 -> ConsEnvEstados
// y verifica que cada paso responde como se espera.
//
// Uso:
//   cd apps/web
//   node scripts/tipsa-e2e-test.mjs
//
// Requiere .env.local (o env vars directas) con TIPSA_TEST_* configurados.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Cargar .env.local manualmente (sin depender de Next.js)
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const envFile = readFileSync(envPath, 'utf-8')
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    // Desescape de comillas
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[m[1]]) process.env[m[1]] = value
  }
} catch (e) {
  console.warn('[warn] no .env.local found, using process.env directly')
}

const LOGIN_URL = 'https://wsval.tipsa-dinapaq.com/SOAP?service=LoginWSService'
const WEBSERV_URL = 'https://wsval.tipsa-dinapaq.com/SOAP?service=WebServService'

const AGENCY = process.env.TIPSA_TEST_AGENCY_CODE ?? '000000'
const CLIENT = process.env.TIPSA_TEST_CLIENT_CODE ?? '33333'
const PASS = process.env.TIPSA_TEST_PASSWORD ?? ''
const SENDER = {
  name: process.env.TIPSA_SENDER_NAME ?? 'Test Sender',
  address: process.env.TIPSA_SENDER_ADDRESS ?? 'Calle Test 1',
  city: process.env.TIPSA_SENDER_CITY ?? 'Sevilla',
  cp: process.env.TIPSA_SENDER_CP ?? '41001',
  phone: process.env.TIPSA_SENDER_PHONE ?? '600000000',
}

const results = []
function log(step, ok, extra = '') {
  const icon = ok ? 'OK  ' : 'FAIL'
  console.log(`[${icon}] ${step}${extra ? ' - ' + extra : ''}`)
  results.push({ step, ok, extra })
}

async function postSoap(url, body, soapAction) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${soapAction}"`,
      'User-Agent': 'qamarero-tipsa-client/1.0',
      Accept: '*/*',
    },
    body,
  })
  const text = await res.text()
  return { status: res.status, text }
}

function loginEnvelope() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">',
    '  <soapenv:Header>',
    '    <tem:ROClientIDHeader>',
    '    </tem:ROClientIDHeader>',
    '  </soapenv:Header>',
    '  <soapenv:Body>',
    '    <tem:LoginWSService___LoginCli2>',
    `      <tem:strCodAge>${AGENCY}</tem:strCodAge>`,
    `      <tem:strCod>${CLIENT}</tem:strCod>`,
    `      <tem:strPass>${PASS}</tem:strPass>`,
    '    </tem:LoginWSService___LoginCli2>',
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('\n')
}

function grabaEnvioEnvelope(session) {
  const date = new Date().toISOString().slice(0, 10)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">',
    '  <soapenv:Header>',
    '    <tem:ROClientIDHeader>',
    `      <tem:ID>${session}</tem:ID>`,
    '    </tem:ROClientIDHeader>',
    '  </soapenv:Header>',
    '  <soapenv:Body>',
    '    <tem:WebServService___GrabaEnvio24>',
    `      <tem:strCodAgeCargo>${AGENCY}</tem:strCodAgeCargo>`,
    `      <tem:strCodAgeOri>${AGENCY}</tem:strCodAgeOri>`,
    `      <tem:dtFecha>${date}</tem:dtFecha>`,
    '      <tem:strCodTipoServ>48</tem:strCodTipoServ>',
    `      <tem:strCodCli>${CLIENT}</tem:strCodCli>`,
    `      <tem:strNomOri>${SENDER.name}</tem:strNomOri>`,
    `      <tem:strDirOri>${SENDER.address}</tem:strDirOri>`,
    `      <tem:strPobOri>${SENDER.city}</tem:strPobOri>`,
    `      <tem:strCPOri>${SENDER.cp}</tem:strCPOri>`,
    `      <tem:strTlfOri>${SENDER.phone}</tem:strTlfOri>`,
    '      <tem:strNomDes>E2E Test Destino</tem:strNomDes>',
    '      <tem:strDirDes>Carrer de Sant Antoni 49</tem:strDirDes>',
    '      <tem:strPobDes>Terrassa</tem:strPobDes>',
    '      <tem:strCPDes>08221</tem:strCPDes>',
    '      <tem:strCodPais>ES</tem:strCodPais>',
    '      <tem:strTlfDes>666555444</tem:strTlfDes>',
    '      <tem:intPaq>1</tem:intPaq>',
    '      <tem:dPesoOri>1.0</tem:dPesoOri>',
    '      <tem:strRef>E2E-TEST</tem:strRef>',
    '      <tem:strObs>Test automatizado</tem:strObs>',
    '      <tem:strContenido>E2E script validation</tem:strContenido>',
    '      <tem:boDesSMS>false</tem:boDesSMS>',
    '      <tem:boDesEmail>false</tem:boDesEmail>',
    '      <tem:strDesMoviles></tem:strDesMoviles>',
    '      <tem:strDesDirEmails></tem:strDesDirEmails>',
    '      <tem:boInsert>true</tem:boInsert>',
    '    </tem:WebServService___GrabaEnvio24>',
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('\n')
}

function etiquetaEnvelope(session, albaran) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">',
    '  <soapenv:Header>',
    '    <tem:ROClientIDHeader>',
    `      <tem:ID>${session}</tem:ID>`,
    '    </tem:ROClientIDHeader>',
    '  </soapenv:Header>',
    '  <soapenv:Body>',
    '    <tem:WebServService___ConsEtiquetaEnvio6>',
    `      <tem:strCodAgeOri>${AGENCY}</tem:strCodAgeOri>`,
    `      <tem:strCodAgeCargo>${AGENCY}</tem:strCodAgeCargo>`,
    `      <tem:StrAlbaran>${albaran}</tem:StrAlbaran>`,
    '      <tem:intIdRepDet>233</tem:intIdRepDet>',
    '      <tem:strFormato>pdf</tem:strFormato>',
    '    </tem:WebServService___ConsEtiquetaEnvio6>',
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('\n')
}

function estadosEnvelope(session, albaran) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">',
    '  <soapenv:Header>',
    '    <tem:ROClientIDHeader>',
    `      <tem:ID>${session}</tem:ID>`,
    '    </tem:ROClientIDHeader>',
    '  </soapenv:Header>',
    '  <soapenv:Body>',
    '    <tem:WebServService___ConsEnvEstados>',
    `      <tem:strCodAgeCargo>${AGENCY}</tem:strCodAgeCargo>`,
    `      <tem:strCodAgeOri>${AGENCY}</tem:strCodAgeOri>`,
    `      <tem:strAlbaran>${albaran}</tem:strAlbaran>`,
    '    </tem:WebServService___ConsEnvEstados>',
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('\n')
}

function extract(xml, tag) {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)<\/(?:\\w+:)?${tag}>`))
  return m ? m[1] : null
}

async function main() {
  console.log('== TIPSA E2E test (wsval) ==\n')

  // -----------------------------
  // Paso 1: LOGIN
  // -----------------------------
  console.log('1) LoginCli2')
  const loginResp = await postSoap(LOGIN_URL, loginEnvelope(), 'urn:DinaPaq-LoginWSService#LoginCli2')
  if (loginResp.status !== 200) {
    log('login.status', false, `HTTP ${loginResp.status}`)
    process.exit(1)
  }
  const loginResult = extract(loginResp.text, 'Result')
  const sessionId = extract(loginResp.text, 'strSesion')
  const trackingBase = extract(loginResp.text, 'strURLDetSegEnv')
  log('login.result=true', loginResult === 'true')
  log('login.sessionId present', Boolean(sessionId && sessionId.length > 10), sessionId ?? '')
  log('login.trackingBaseUrl present', Boolean(trackingBase && trackingBase.includes('dinapaq')))
  if (loginResult !== 'true' || !sessionId) process.exit(1)

  // -----------------------------
  // Paso 2: GrabaEnvio24
  // -----------------------------
  console.log('\n2) GrabaEnvio24')
  const grabaResp = await postSoap(
    WEBSERV_URL,
    grabaEnvioEnvelope(sessionId),
    'urn:DinaPaq-WebServService#GrabaEnvio24',
  )
  log('grabaEnvio.http 200', grabaResp.status === 200)
  const albaran = extract(grabaResp.text, 'strAlbaranOut')
  const guid = extract(grabaResp.text, 'strGuidOut')
  log('grabaEnvio.albaran present', Boolean(albaran && /^\d{8,12}$/.test(albaran)), albaran ?? '(missing)')
  log('grabaEnvio.guid present', Boolean(guid && guid.startsWith('{')), guid ?? '(missing)')
  if (!albaran) {
    console.log('--- raw graba response ---\n', grabaResp.text.slice(0, 1500))
    process.exit(1)
  }

  // -----------------------------
  // Paso 3: ConsEtiquetaEnvio6
  // -----------------------------
  console.log('\n3) ConsEtiquetaEnvio6')
  const etiResp = await postSoap(
    WEBSERV_URL,
    etiquetaEnvelope(sessionId, albaran),
    'urn:DinaPaq-WebServService#ConsEtiquetaEnvio6',
  )
  log('etiqueta.http 200', etiResp.status === 200)
  const noFault = !/<(?:\w+:)?Fault[>\s]/.test(etiResp.text)
  log('etiqueta.no soap fault', noFault)
  // El PDF base64 tiene que ser largo; buscamos al menos 500 chars base64
  const base64Chunk = etiResp.text.match(/>([A-Za-z0-9+\/=\r\n\s]{500,})</)
  log('etiqueta.pdf base64 payload', Boolean(base64Chunk))

  // -----------------------------
  // Paso 4: ConsEnvEstados
  // -----------------------------
  console.log('\n4) ConsEnvEstados')
  const estResp = await postSoap(
    WEBSERV_URL,
    estadosEnvelope(sessionId, albaran),
    'urn:DinaPaq-WebServService#ConsEnvEstados',
  )
  log('estados.http 200', estResp.status === 200)
  const noFault2 = !/<(?:\w+:)?Fault[>\s]/.test(estResp.text)
  log('estados.no soap fault', noFault2)
  const hasEnvEstados = /ENV_ESTADOS/.test(estResp.text)
  log('estados.CDATA con ENV_ESTADOS', hasEnvEstados)

  // -----------------------------
  // Resumen
  // -----------------------------
  const failed = results.filter((r) => !r.ok)
  console.log('\n== Resumen ==')
  console.log(`OK:    ${results.length - failed.length}`)
  console.log(`FAIL:  ${failed.length}`)
  if (failed.length > 0) {
    console.log('\nFallos:')
    for (const f of failed) console.log('  -', f.step, f.extra ? `(${f.extra})` : '')
    process.exit(1)
  }
  console.log('\nAlbaran generado:', albaran, '(wsval sandbox, no envio real)')
}

main().catch((err) => {
  console.error('E2E error:', err)
  process.exit(1)
})
