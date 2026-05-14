'use client'

import { useEffect, useRef } from 'react'
import { formatDate, cn, priorityColor, categoryEmoji } from '@/lib/utils'
import type { EmailThread } from '@/types/email'
import { Star, Paperclip, Loader2 } from 'lucide-react'

interface ThreadListProps {
  threads: EmailThread[]
  selectedId: string | null
  onSelect: (thread: EmailThread) => void
  onStar: (thread: EmailThread) => void
  isLoading?: boolean
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
}

export function ThreadList({
  threads, selectedId, onSelect, onStar,
  isLoading, hasMore, isLoadingMore, onLoadMore,
}: ThreadListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Intersection observer — triggers onLoadMore when sentinel scrolls into view
  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) onLoadMore() },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-gray-100 animate-pulse">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-16 ml-auto" />
            </div>
            <div className="h-3 bg-gray-200 rounded w-48 mb-1" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No emails found
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto" role="list" aria-label="Email threads">
      {threads.map(thread => (
        <ThreadItem
          key={thread.id}
          thread={thread}
          isSelected={thread.id === selectedId}
          onSelect={onSelect}
          onStar={onStar}
        />
      ))}

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          {isLoadingMore
            ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            : <div className="h-4" />
          }
        </div>
      )}
    </div>
  )
}

function ThreadItem({
  thread, isSelected, onSelect, onStar,
}: {
  thread: EmailThread
  isSelected: boolean
  onSelect: (t: EmailThread) => void
  onStar: (t: EmailThread) => void
}) {
  const senderNames = thread.participants
    .slice(0, 2)
    .map(p => p.name?.split(' ')[0] ?? p.email.split('@')[0])
    .join(', ')

  return (
    <button
      className={cn(
        'w-full text-left px-4 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 focus:outline-none focus:bg-blue-50',
        isSelected && 'bg-blue-50 border-l-2 border-l-blue-600',
        !thread.isRead && 'bg-white'
      )}
      onClick={() => onSelect(thread)}
      role="listitem"
      aria-label={`Email from ${senderNames}: ${thread.subject}`}
      aria-selected={isSelected}
    >
      <div className="flex items-start gap-2">
        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', thread.isRead ? 'bg-transparent' : 'bg-blue-600')} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className={cn('text-sm truncate max-w-[60%]', !thread.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
              {senderNames}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {thread.messageCount > 1 && <span className="text-xs text-gray-400">{thread.messageCount}</span>}
              <span className="text-xs text-gray-400">{formatDate(thread.lastDate)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 mb-0.5">
            <span className={cn('text-sm truncate', !thread.isRead ? 'font-medium text-gray-900' : 'text-gray-700')}>
              {thread.subject}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 truncate flex-1">{thread.snippet}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {thread.messages?.some(m => m.attachments.length > 0) && <Paperclip className="w-3 h-3 text-gray-400" />}
              {thread.aiPriority && thread.aiPriority >= 7 && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', priorityColor(thread.aiPriority))}>
                  P{thread.aiPriority}
                </span>
              )}
              {thread.aiCategory && <span className="text-xs">{categoryEmoji(thread.aiCategory)}</span>}
              <button
                className="p-0.5 hover:text-yellow-500 transition-colors"
                onClick={e => { e.stopPropagation(); onStar(thread) }}
                aria-label={thread.isStarred ? 'Unstar' : 'Star'}
              >
                <Star className={cn('w-3.5 h-3.5', thread.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300')} />
              </button>
            </div>
          </div>

          {thread.aiSummary && (
            <div className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 truncate">
              ✨ {thread.aiSummary}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
