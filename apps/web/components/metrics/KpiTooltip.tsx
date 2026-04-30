'use client'

interface KpiTooltipProps {
  text: string
}

export default function KpiTooltip({ text }: KpiTooltipProps) {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        className="text-gray-300 hover:text-gray-500 transition-colors"
        aria-label="Mas informacion"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-[11px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
