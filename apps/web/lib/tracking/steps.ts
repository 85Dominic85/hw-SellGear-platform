// =============================================================================
// resolveTimelineSteps
// -----------------------------------------------------------------------------
// Mapea una lista de eventos TIPSA (shipping_events del envio) a los 5 pasos
// del timeline horizontal que se muestra en /tracking:
//   0: Documentado
//   1: En transito
//   2: HUB destino
//   3: En reparto
//   4: Entregado
//
// El "paso actual" es el paso al que corresponde el estado oficial del envio
// (ignorando codigo 3 = anotacion post-entrega si viene tras codigo 2).
//
// Si el estado oficial es codigo 3 (incidencia real, sin entrega posterior)
// mantenemos el paso donde estaba antes de la incidencia y marcamos tono
// "warn". Si es codigo 6 (devuelto) marcamos "crit" en el paso final.
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
  'HUB destino',
  'En reparto',
  'Entregado',
] as const

/**
 * Mapa codigo -> indice de paso (0-4).
 * Los codigos no mapeados o desconocidos caen a step 1 (tránsito) por defecto
 * salvo que se decida otra cosa.
 */
const CODE_TO_STEP: Record<string, number> = {
  '0': 0, // Documentado
  '1': 0, // Alta
  '4': 1, // En transito
  '7': 1, // Lectura en agencia (transito interno)
  '8': 3, // En reparto (alias)
  '15': 1, // Pendiente de llegada (aun en transito)
  '18': 1, // Transito interno
  '10': 2, // En delegacion destino
  '5': 3, // En reparto
  '11': 3, // En reparto (alias)
  '2': 4, // Entregado
  '6': 4, // Devuelto al origen (final)
}

/** Codigo "anotacion" — 3 post-entrega no cambia el paso. */
const NOTE_CODE = '3'

/**
 * Calcula los 5 pasos del timeline para un envio, dado su lista completa
 * de shipping_events (orden cronologico cualquiera; la funcion los ordena).
 * Devuelve siempre 5 elementos (uno por paso), etiquetados con estado.
 */
export function resolveTimelineSteps(events: TimelineInput[]): TimelineStep[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  )

  // Estado oficial: ultimo evento NO codigo 3.
  let officialCode: string | null = null
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].event_code !== NOTE_CODE) {
      officialCode = sorted[i].event_code
      break
    }
  }

  // Si TODOS son codigo 3 (raro), usar el ultimo.
  if (!officialCode && sorted.length > 0) {
    officialCode = sorted[sorted.length - 1].event_code
  }

  // Tono del paso actual:
  // - '3' (incidencia real, sin entrega) -> warn
  // - '6' (devuelto)                     -> crit
  // - '2' (entregado)                    -> ok
  // - resto                              -> info
  let currentTone: StepTone = 'info'
  if (officialCode === '2') currentTone = 'ok'
  else if (officialCode === '6') currentTone = 'crit'
  else if (officialCode === NOTE_CODE) currentTone = 'warn'

  // Paso actual: el que le corresponde al codigo oficial.
  // Si es codigo 3, usamos el paso del ultimo evento NO-3 antes de la incidencia.
  let currentStep: number | null = null
  if (officialCode !== null) {
    currentStep = CODE_TO_STEP[officialCode] ?? 1 // default: tránsito
    // Nota: si officialCode ES '3' (raro caso "todo son incidencias"), tratamos
    // como transito para no romper la barra.
    if (officialCode === NOTE_CODE) currentStep = 1
  }

  return TIMELINE_STEP_LABELS.map((label, i) => {
    if (currentStep === null) {
      return { label, status: 'pending' as const, tone: 'muted' as const }
    }
    if (i < currentStep) return { label, status: 'done' as const, tone: 'info' as const }
    if (i === currentStep) return { label, status: 'current' as const, tone: currentTone }
    return { label, status: 'pending' as const, tone: 'muted' as const }
  })
}

/**
 * Porcentaje de progreso 0-100 basado en el paso actual, util para pintar
 * la barra continua debajo de los puntos. Un envio en step 3 (reparto) tiene
 * 3/4 = 75% de progreso; en step 4 (entregado) tiene 100%.
 */
export function timelineProgressPct(steps: TimelineStep[]): number {
  const currentIdx = steps.findIndex((s) => s.status === 'current')
  if (currentIdx < 0) return 0
  if (currentIdx === 0) return 5 // pequena barra visible en step 0
  return Math.round((currentIdx / (steps.length - 1)) * 100)
}
