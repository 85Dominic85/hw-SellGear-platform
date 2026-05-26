'use client'

interface WizardStepsProps {
  current: 1 | 2 | 3
  /** Indica hasta que paso ya se valido (puede volver hacia atras). */
  furthestReached: 1 | 2 | 3
  onJump: (step: 1 | 2 | 3) => void
}

interface StepDef {
  num: 1 | 2 | 3
  label: string
  hint: string
}

const STEPS: StepDef[] = [
  { num: 1, label: 'Tipo de compra', hint: 'Selecciona el tipo' },
  { num: 2, label: 'Cliente y datos', hint: 'Solicitante + cliente' },
  { num: 3, label: 'Productos',       hint: 'Catálogo + resumen' },
]

/**
 * Stepper visual con 3 pasos. Permite saltar hacia atras a pasos
 * completados (clickable). Los pasos futuros estan deshabilitados.
 */
export default function WizardSteps({
  current,
  furthestReached,
  onJump,
}: WizardStepsProps) {
  return (
    <ol className="flex items-stretch">
      {STEPS.map((s, idx) => {
        const isActive = s.num === current
        const isReached = s.num <= furthestReached
        const canClick = isReached && !isActive
        return (
          <li key={s.num} className="flex flex-1 items-stretch">
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onJump(s.num)}
              className={`group flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : isReached
                    ? 'bg-white text-gray-900 hover:bg-gray-50 ring-1 ring-gray-200'
                    : 'bg-gray-50 text-gray-400 ring-1 ring-gray-100'
              } disabled:cursor-default`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-white text-gray-900'
                    : isReached
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s.num}
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold leading-tight">{s.label}</span>
                <span
                  className={`text-[10px] leading-tight ${
                    isActive ? 'text-gray-200' : 'text-gray-500'
                  }`}
                >
                  {s.hint}
                </span>
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="mx-1 flex items-center text-gray-300"
              >
                →
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
