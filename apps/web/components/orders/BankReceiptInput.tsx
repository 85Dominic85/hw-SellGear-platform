'use client'

import { useRef, useState } from 'react'
import { Paperclip, Loader2, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ACCEPTED = '.pdf,.png,.jpg,.jpeg'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
  required?: boolean
}

export default function BankReceiptInput({ value, onChange, className, required }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_SIZE) {
      setErrorMsg('Archivo demasiado grande (máx. 10 MB).')
      setState('error')
      return
    }

    setState('uploading')
    setErrorMsg(null)

    try {
      const supabase = createClient()
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const id = crypto.randomUUID()
      const path = `_pending/${id}/${Date.now()}_${safe}`

      const { error: uploadErr } = await supabase.storage
        .from('order-attachments')
        .upload(path, file)
      if (uploadErr) throw uploadErr

      const { data } = supabase.storage
        .from('order-attachments')
        .getPublicUrl(path)

      onChange(data.publicUrl)
      setFileName(file.name)
      setState('idle')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al subir el archivo.')
      setState('error')
    }
  }

  function clear() {
    onChange('')
    setFileName(null)
    setState('idle')
    setErrorMsg(null)
  }

  const hasUpload = !!fileName && !!value

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (fileName) setFileName(null)
          }}
          placeholder="https://drive.google.com/..."
          className={className}
          disabled={state === 'uploading'}
          required={required}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={state === 'uploading'}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          title="Adjuntar PDF o imagen"
        >
          {state === 'uploading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Adjuntar</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {hasUpload && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-1.5 text-xs text-green-800 ring-1 ring-green-200">
          <Check className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate font-medium">{fileName}</span>
          <button
            type="button"
            onClick={clear}
            className="ml-auto flex-shrink-0 rounded p-0.5 text-green-700 hover:bg-green-100"
            title="Quitar archivo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}

      <p className="text-xs text-gray-500">
        Pega un enlace o adjunta un PDF/imagen (máx. 10 MB).
      </p>
    </div>
  )
}
