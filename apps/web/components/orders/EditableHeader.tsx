'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil, Loader2, Check } from 'lucide-react'

interface EditableHeaderProps {
  orderId: string
  customerName: string
  venueName: string | null
  canEdit: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function InlineHeaderField({
  orderId,
  fieldName,
  value,
  canEdit,
  as: Tag,
  className,
  placeholder,
}: {
  orderId: string
  fieldName: string
  value: string | null
  canEdit: boolean
  as: 'h1' | 'p'
  className: string
  placeholder: string
}) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value ?? '')
  const [displayValue, setDisplayValue] = useState(value)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const saveValue = useCallback(async (newVal: string) => {
    // customer_name cannot be empty
    if (fieldName === 'customer_name' && !newVal.trim()) {
      cancelEditing()
      return
    }

    setSaveState('saving')
    const previousValue = displayValue
    const finalValue = newVal.trim() || null
    setDisplayValue(finalValue)
    setEditing(false)

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: finalValue }),
      })
      if (!res.ok) throw new Error('Error')
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setDisplayValue(previousValue)
      setLocalValue(previousValue ?? '')
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    }
  }, [orderId, fieldName, displayValue, cancelEditing])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') cancelEditing()
    else if (e.key === 'Enter') {
      e.preventDefault()
      saveValue(String(localValue))
    }
  }, [cancelEditing, saveValue, localValue])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

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

  const isEmpty = !displayValue

  // Non-editable: hide if empty (for venue_name)
  if (!canEdit) {
    if (isEmpty) return null
    return <Tag className={className}>{displayValue}</Tag>
  }

  if (editing) {
    return (
      <div ref={containerRef}>
        <input
          ref={inputRef}
          type="text"
          value={String(localValue)}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${Tag === 'h1' ? 'text-2xl font-bold' : 'text-sm'} w-full rounded border border-gray-300 px-2 py-1 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
      </div>
    )
  }

  const feedbackIcon = () => {
    if (saveState === 'saving') return <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
    if (saveState === 'saved') return <Check className="h-3.5 w-3.5 text-green-500" />
    if (saveState === 'error') return <span className="text-xs text-red-500">Error</span>
    return null
  }

  return (
    <div ref={containerRef} className="group flex items-center gap-2">
      <Tag className={className}>
        {isEmpty ? <span className="text-gray-400 italic">{placeholder}</span> : displayValue}
      </Tag>
      <button
        type="button"
        onClick={startEditing}
        className="flex-shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100"
        title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </button>
      {feedbackIcon()}
    </div>
  )
}

export default function EditableHeader({
  orderId,
  customerName,
  venueName,
  canEdit,
}: EditableHeaderProps) {
  return (
    <div>
      <InlineHeaderField
        orderId={orderId}
        fieldName="customer_name"
        value={customerName}
        canEdit={canEdit}
        as="h1"
        className="text-2xl font-bold text-gray-900"
        placeholder="Sin nombre"
      />
      <InlineHeaderField
        orderId={orderId}
        fieldName="venue_name"
        value={venueName}
        canEdit={canEdit}
        as="p"
        className="mt-1 text-sm text-gray-500"
        placeholder="Sin venue"
      />
    </div>
  )
}
