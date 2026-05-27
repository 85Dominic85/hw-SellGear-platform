'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Comment } from '@/types/database'
import { formatDate } from '@/lib/utils'

interface CommentsListProps {
  orderId: string
  comments: Comment[]
  readOnly?: boolean
}

export default function CommentsList({ orderId, comments, readOnly }: CommentsListProps) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Debes estar autenticado para comentar.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('comments').insert({
      order_id: orderId,
      author_id: user.id,
      body: body.trim(),
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setBody('')
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">
        Comentarios ({comments.length})
      </h3>

      {/* Comments thread */}
      {comments.length === 0 ? (
        <p className="mb-4 text-sm text-gray-400 italic">Sin comentarios aún.</p>
      ) : (
        <div className="mb-4 space-y-3 max-h-80 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg bg-gray-50 px-4 py-3 ring-1 ring-gray-100"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">
                  {comment.author?.full_name ?? comment.author?.email ?? 'Usuario'}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(comment.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{comment.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add comment (oculto para viewers) */}
      {!readOnly && (
        <form onSubmit={handleAddComment} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Escribe un comentario..."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Añadir comentario'}
          </button>
        </form>
      )}
    </div>
  )
}
