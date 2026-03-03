'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Paperclip, Loader2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ACCEPTED_TYPES = '.pdf,.png,.jpg,.jpeg'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface FileUploadFieldProps {
  orderId: string
  fieldName: string
  value: string | null
  canEdit: boolean
  label: string
  linkLabel: string
  viewerComponent?: React.ComponentType<{ url: string }>
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export default function FileUploadField({
  orderId,
  fieldName,
  value,
  canEdit,
  label,
  linkLabel,
  viewerComponent: ViewerComponent,
}: FileUploadFieldProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(value)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync with external value changes
  useEffect(() => {
    setDisplayUrl(value)
  }, [value])

  const saveFieldUrl = useCallback(
    async (url: string | null) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: url }),
      })
      if (!res.ok) throw new Error('Error al guardar')
    },
    [orderId, fieldName]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Reset input so same file can be re-selected
      e.target.value = ''

      if (file.size > MAX_FILE_SIZE) {
        setUploadState('error')
        setTimeout(() => setUploadState('idle'), 3000)
        return
      }

      setUploadState('uploading')

      try {
        const supabase = createClient()
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${orderId}/${fieldName}/${timestamp}_${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('order-attachments')
          .upload(path, file)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('order-attachments')
          .getPublicUrl(path)

        const publicUrl = urlData.publicUrl

        await saveFieldUrl(publicUrl)

        setDisplayUrl(publicUrl)
        setUploadState('done')
        setTimeout(() => setUploadState('idle'), 2000)
      } catch {
        setUploadState('error')
        setTimeout(() => setUploadState('idle'), 3000)
      }
    },
    [orderId, fieldName, saveFieldUrl]
  )

  const handleDelete = useCallback(async () => {
    if (!displayUrl) return

    const previousUrl = displayUrl
    setDisplayUrl(null)
    setUploadState('uploading')

    try {
      // Extract storage path from public URL
      const bucketSegment = '/storage/v1/object/public/order-attachments/'
      const idx = previousUrl.indexOf(bucketSegment)
      if (idx !== -1) {
        const storagePath = decodeURIComponent(
          previousUrl.slice(idx + bucketSegment.length)
        )
        const supabase = createClient()
        await supabase.storage.from('order-attachments').remove([storagePath])
      }

      await saveFieldUrl(null)

      setUploadState('done')
      setTimeout(() => setUploadState('idle'), 2000)
    } catch {
      setDisplayUrl(previousUrl)
      setUploadState('error')
      setTimeout(() => setUploadState('idle'), 3000)
    }
  }, [displayUrl, saveFieldUrl])

  const feedbackIcon = () => {
    if (uploadState === 'uploading') {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
    }
    if (uploadState === 'done') {
      return <Check className="h-3.5 w-3.5 text-green-500" />
    }
    if (uploadState === 'error') {
      return <span className="text-xs text-red-500">Error</span>
    }
    return null
  }

  // Read-only mode
  if (!canEdit) {
    if (!displayUrl) return null

    return (
      <div>
        <dt className="text-xs text-gray-500">{label}</dt>
        <dd className="mt-0.5 text-sm">
          {ViewerComponent ? (
            <ViewerComponent url={displayUrl} />
          ) : (
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {linkLabel}
            </a>
          )}
        </dd>
      </div>
    )
  }

  // Editable mode
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5">
        <div className="group flex items-center gap-1.5">
          {displayUrl ? (
            <>
              {ViewerComponent ? (
                <ViewerComponent url={displayUrl} />
              ) : (
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {linkLabel}
                </a>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={uploadState === 'uploading'}
                className="flex-shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                title="Eliminar archivo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <span className="text-sm italic text-gray-400">Sin archivo</span>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState === 'uploading'}
            className="flex-shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100"
            title="Adjuntar archivo"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>

          {feedbackIcon()}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </dd>
    </div>
  )
}
