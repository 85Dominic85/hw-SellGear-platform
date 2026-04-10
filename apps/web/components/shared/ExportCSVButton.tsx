'use client'

interface ExportCSVButtonProps {
  /** For server-side export: API endpoint URL */
  exportUrl?: string
  /** Query params to append to the export URL */
  params?: Record<string, string | undefined>
  /** For client-side export: callback that triggers download */
  onExport?: () => void
  /** Button label (default: "CSV") */
  label?: string
}

export default function ExportCSVButton({
  exportUrl,
  params,
  onExport,
  label = 'CSV',
}: ExportCSVButtonProps) {
  const handleClick = () => {
    if (onExport) {
      onExport()
      return
    }

    if (exportUrl) {
      const sp = new URLSearchParams()
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value) sp.set(key, value)
        }
      }
      const qs = sp.toString()
      window.open(`${exportUrl}${qs ? `?${qs}` : ''}`, '_blank')
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      {label}
    </button>
  )
}
