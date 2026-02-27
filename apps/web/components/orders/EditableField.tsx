'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil, Loader2, Check } from 'lucide-react'

type FieldType = 'text' | 'email' | 'url' | 'number' | 'select' | 'textarea'

interface EditableFieldProps {
  orderId: string
  fieldName: string
  value: string | number | null
  fieldType?: FieldType
  canEdit: boolean
  label: string
  options?: { value: string; label: string }[]
  formatDisplay?: (value: string | number | null) => React.ReactNode
  placeholder?: string
  monospace?: boolean
  fullWidth?: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function EditableField({
  orderId,
  fieldName,
  value,
  fieldType = 'text',
  canEdit,
  label,
  options,
  formatDisplay,
  placeholder = '—',
  monospace = false,
  fullWidth = false,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value ?? '')
  const [displayValue, setDisplayValue] = useState(value)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync with external value changes
  useEffect(() => {
    if (!editing) {
      setDisplayValue(value)
      setLocalValue(value ?? '')
    }
  }, [value, editing])

  const startEditing = useCallback(() => {
    if (!canEdit) return
    setEditing(true)
    setLocalValue(displayValue ?? '')
    setSaveState('idle')
  }, [canEdit, displayValue])

  const cancelEditing = useCallback(() => {
    setEditing(false)
    setLocalValue(displayValue ?? '')
    setSaveState('idle')
  }, [displayValue])

  const saveValue = useCallback(async (newValue: string | number | null) => {
    setSaveState('saving')

    // Optimistic update
    const previousValue = displayValue
    setDisplayValue(newValue === '' ? null : newValue)
    setEditing(false)

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: newValue === '' ? null : newValue }),
      })

      if (!res.ok) {
        throw new Error('Error al guardar')
      }

      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      // Revert optimistic update
      setDisplayValue(previousValue)
      setLocalValue(previousValue ?? '')
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    }
  }, [orderId, fieldName, displayValue])

  const parseLocalValue = useCallback((): string | number | null => {
    if (fieldType === 'number') return parseFloat(String(localValue)) || null
    return localValue as string
  }, [fieldType, localValue])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancelEditing()
    } else if (fieldType === 'textarea') {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        saveValue(parseLocalValue())
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      saveValue(parseLocalValue())
    }
  }, [cancelEditing, saveValue, fieldType, parseLocalValue])

  // Focus input on edit start
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select()
      }
    }
  }, [editing])

  // Click outside to cancel
  useEffect(() => {
    if (!editing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        cancelEditing()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editing, cancelEditing])

  // Handle select auto-save
  const handleSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value
    setLocalValue(newVal)
    saveValue(newVal)
  }, [saveValue])

  const renderDisplay = () => {
    const val = displayValue
    const isEmpty = val === null || val === undefined || val === ''

    if (formatDisplay && !isEmpty) {
      return formatDisplay(val)
    }

    if (isEmpty) {
      return <span className="text-gray-400 italic">{canEdit ? 'Sin valor' : placeholder}</span>
    }

    return String(val)
  }

  const feedbackIcon = () => {
    if (saveState === 'saving') {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
    }
    if (saveState === 'saved') {
      return <Check className="h-3.5 w-3.5 text-green-500" />
    }
    if (saveState === 'error') {
      return <span className="text-xs text-red-500">Error</span>
    }
    return null
  }

  // Read-only mode
  if (!canEdit) {
    const isEmpty = displayValue === null || displayValue === undefined || displayValue === ''
    if (isEmpty) return null

    return (
      <div className={fullWidth ? 'col-span-2 sm:col-span-3' : ''}>
        <dt className="text-xs text-gray-500">{label}</dt>
        <dd className={`mt-0.5 text-sm text-gray-900 ${monospace ? 'font-mono' : ''} ${fieldType === 'textarea' ? 'whitespace-pre-wrap' : ''}`}>
          {formatDisplay ? formatDisplay(displayValue) : String(displayValue)}
        </dd>
      </div>
    )
  }

  // Editable mode
  return (
    <div ref={containerRef} className={fullWidth ? 'col-span-2 sm:col-span-3' : ''}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5">
        {editing ? (
          <div className="space-y-1">
            {fieldType === 'textarea' ? (
              <>
                <textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  value={String(localValue)}
                  onChange={(e) => setLocalValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveValue(localValue as string)}
                    className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <span className="text-xs text-gray-400">Ctrl+Enter guardar</span>
                </div>
              </>
            ) : fieldType === 'select' && options ? (
              <select
                ref={inputRef as React.RefObject<HTMLSelectElement>}
                value={String(localValue)}
                onChange={handleSelectChange}
                onKeyDown={handleKeyDown}
                className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Sin valor —</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={fieldType === 'number' ? 'number' : fieldType === 'email' ? 'email' : fieldType === 'url' ? 'url' : 'text'}
                step={fieldType === 'number' ? '0.01' : undefined}
                value={String(localValue)}
                onChange={(e) => setLocalValue(fieldType === 'number' ? e.target.value : e.target.value)}
                onKeyDown={handleKeyDown}
                className={`rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${monospace ? 'font-mono' : ''}`}
              />
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className={`group flex items-center gap-1.5 text-left text-sm text-gray-900 ${monospace ? 'font-mono' : ''} ${fieldType === 'textarea' ? 'whitespace-pre-wrap' : ''}`}
          >
            <span>{renderDisplay()}</span>
            <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
            {feedbackIcon()}
          </button>
        )}
      </dd>
    </div>
  )
}
