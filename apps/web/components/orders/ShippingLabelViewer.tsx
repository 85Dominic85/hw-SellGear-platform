'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

interface ShippingLabelViewerProps {
  url: string
}

export default function ShippingLabelViewer({ url }: ShippingLabelViewerProps) {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, close])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-blue-600 hover:underline"
      >
        Ver etiqueta
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <div className="relative mx-4 flex h-[80vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Etiqueta de envio</h3>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={url}
                className="h-full w-full border-0"
                title="Etiqueta de envio"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
