// =============================================================================
// resolveTimelineSteps
// -----------------------------------------------------------------------------
// Mapea una lista de eventos TIPSA (shipping_events del envio) a los 4 pasos
// del timeline horizontal que se muestra en /tracking:
//   0: Documentado
//   1: En transito
//   2: En reparto
//   3: Entregado
//
// Cuatro pasos y no cinco porque son los unicos que la API sabe contar. El
// antiguo "HUB destino" no existe como estado: las lecturas de HUB salen en la
// web publica de TIPSA pero ConsEnvEstados no las devuelve, asi que ese punto
// no se encendia nunca.
//
// Codigos que no son un punto del recorrido — 4 INCIDENCIA, 14 DISPONIBLE —
// no mueven la barra: dejan el paso donde estaba y tinen el punto actual
// (ambar para la incidencia). El estado exacto lo dice el badge de al lado.
//
// El catalogo de codigos vive en TIPSA_EVENT_LABELS (lib/tipsa/services.ts).
// =============================================================================

export type StepTone = 'muted' | 'info' | 'ok' | 'warn' | 'crit'

export interface TimelineStep {
  label: string
  status: 'pending' | 'current' | 'done'
  tone: StepTone
}

export interface TimelineInput {
  event_code: string
  event_date: string // ISO
}

export const TIMELINE_STEP_LABELS = [
  'Documentado',
  'En tránsito',
  'En reparto',
  'Entregado',
] as const

/**
 * Mapa codigo -> indice de paso (0-3). Solo los codigos que SON un punto del
 * recorrido. Un codigo ausente de este mapa no mueve la barra.
 */
const CODE_TO_STEP: Record<string, number> = {
  '0': 0, // Documentado
  '1': 1, // En transito
  '7': 1, // Recanalizado (sigue viajando, por otra ruta)
  '2': 2, // En reparto
  '15': 2, // Entrega parcial (parte del envio se entrego; el resto sigue)
  '3': 3, // Entregado
  '5': 3, // Devuelto (final)
  '10': 3, // Destruido (final)
}

/** 4 INCIDENCIA — un contratiempo, no un punto del viaje. */
const INCIDENCE_CODE = '4'

/**
 * Estados finales del recorrido. Espejo de TIPSA_TERMINAL_CODES en
 * lib/tipsa/services.ts — se duplica a proposito: este modulo viaja al bundle
 * de cliente (TrackingBoard es 'use client') y services.ts lee process.env.
 */
const TERMINAL_CODES = new Set(['3', '5'])

/**
 * Calcula los 5 pasos del timeline para un envio, dado su lista completa
 * de shipping_events (orden cronologico cualquiera; la funcion los ordena).
 * Devuelve siempre 5 elementos (uno por paso), etiquetados con estado.
 */
export function resolveTimelineSteps(events: TimelineInput[]): TimelineStep[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  )

  if (sorted.length === 0) {
    return TIMELINE_STEP_LABELS.map((label) => ({
      label,
      status: 'pending' as const,
      tone: 'muted' as const,
    }))
  }

  // Estado oficial. Un terminal (3 Entregado / 5 Devuelto) manda siempre: un
  // envio no se des-entrega y TIPSA sigue emitiendo lecturas despues (vimos un
  // 14 posterior a un 3). Si no lo hay, el ultimo evento tal cual.
  let officialCode = sorted[sorted.length - 1].event_code
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (TERMINAL_CODES.has(sorted[i].event_code)) {
      officialCode = sorted[i].event_code
      break
    }
  }

  // Tono del paso actual segun el estado oficial.
  let currentTone: StepTone = 'info'
  if (officialCode === '3') currentTone = 'ok'
  else if (officialCode === '5' || officialCode === '10') currentTone = 'crit'
  else if (officialCode === INCIDENCE_CODE) currentTone = 'warn'

  // Paso actual. Si el estado oficial no es un punto del recorrido (una
  // incidencia, un 14 Disponible, o un codigo que TIPSA aun no nos ha
  // documentado) la barra se queda en el ultimo punto por el que SI paso, en
  // vez de inventarse uno. El badge de al lado dice el estado exacto.
  let currentStep = CODE_TO_STEP[officialCode] ?? null
  if (currentStep === null) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const step = CODE_TO_STEP[sorted[i].event_code]
      if (step !== undefined) {
        currentStep = step
        break
      }
    }
  }
  // Ningun evento conocido: dejamos la barra en "Documentado", que es lo unico
  // que sabemos seguro de un envio que existe.
  if (currentStep === null) currentStep = 0

  return TIMELINE_STEP_LABELS.map((label, i) => {
    if (i < currentStep) return { label, status: 'done' as const, tone: 'info' as const }
    if (i === currentStep) return { label, status: 'current' as const, tone: currentTone }
    return { label, status: 'pending' as const, tone: 'muted' as const }
  })
}

/**
 * Porcentaje de progreso 0-100 basado en el paso actual, util para pintar
 * la barra continua debajo de los puntos. Con 4 pasos, un envio en step 2
 * (reparto) tiene 2/3 = 67%; en step 3 (entregado) tiene 100%.
 *
 * El rail que pinta este porcentaje va de centro a centro de los puntos
 * extremos, asi que step 0 es 0% (el propio punto marca el arranque) y el
 * ultimo paso es 100% (la linea muere justo en "Entregado").
 */
export function timelineProgressPct(steps: TimelineStep[]): number {
  const currentIdx = steps.findIndex((s) => s.status === 'current')
  if (currentIdx < 0) return 0
  return Math.round((currentIdx / (steps.length - 1)) * 100)
}
