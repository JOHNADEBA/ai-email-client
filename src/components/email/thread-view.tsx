'use client'

import { useState } from 'react'
import { formatDate, cn, categoryEmoji, priorityColor } from '@/lib/utils'
import type { EmailThread } from '@/types/email'
import { Button } from '@/components/ui/button'
import {
  Archive, Trash2, Star, Reply, Forward, MoreHorizontal,
  Sparkles, ChevronDown, ChevronUp, ExternalLink, X
} from 'lucide-react'

interface ThreadViewProps {
  thread: EmailThread
  onArchive: () => void
  onDelete: () => void
  onStar: () => void
  onReply: () => void
  onForward: () => void
  onClose?: () => void
}

export function ThreadView({ thread, onArchive, onDelete, onStar, onReply, onForward, onClose }: ThreadViewProps) {
  const [aiSummary, setAiSummary] = useState(thread.aiSummary ?? '')
  const [replyDraft, setReplyDraft] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [showDraft, setShowDraft] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set([thread.messages[thread.messages.length - 1]?.id])
  )

  async function fetchSummary() {
    if (aiSummary) return
    setLoadingSummary(true)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread }),
      })
      const data = await res.json() as { summary: string }
      setAiSummary(data.summary)
    } catch {
      setAiSummary('Could not generate summary.')
    } finally {
      setLoadingSummary(false)
    }
  }

  async function fetchDraft() {
    if (replyDraft) { setShowDraft(true); return }
    setLoadingDraft(true)
    setShowDraft(true)
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread }),
      })
      const data = await res.json() as { draft: string }
      setReplyDraft(data.draft)
    } catch {
      setReplyDraft('Could not generate draft.')
    } finally {
      setLoadingDraft(false)
    }
  }

  function toggleMessage(id: string) {
    setExpandedMessages(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 border-b border-gray-200">
        {/* Row 1: close + subject + actions */}
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} className="md:hidden flex-shrink-0">
              <X className="w-4 h-4" />
            </Button>
          )}
          <h1 className="flex-1 text-base md:text-lg font-semibold text-gray-900 truncate min-w-0">
            {thread.subject}
          </h1>
          {/* Actions — always visible */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button variant="ghost" size="icon-sm" onClick={onArchive} title="Archive">
              <Archive className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Delete">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onStar} title={thread.isStarred ? 'Unstar' : 'Star'}>
              <Star className={cn('w-4 h-4', thread.isStarred && 'fill-yellow-400 text-yellow-400')} />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onReply} title="Reply">
              <Reply className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onForward} title="Forward">
              <Forward className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {/* Row 2: meta */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
          <span>{thread.messageCount} message{thread.messageCount !== 1 ? 's' : ''}</span>
          {thread.aiCategory && (
            <span className="flex items-center gap-1">
              {categoryEmoji(thread.aiCategory)}
              <span className="capitalize">{thread.aiCategory.replace('_', ' ')}</span>
            </span>
          )}
          {thread.aiPriority && (
            <span className={cn('px-2 py-0.5 rounded-full font-medium', priorityColor(thread.aiPriority))}>
              Priority {thread.aiPriority}/10
            </span>
          )}
        </div>
      </div>

      {/* AI Panel */}
      <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">AI Assistant</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSummary}
            disabled={loadingSummary}
            className="text-blue-600 hover:bg-blue-100 text-xs h-7"
          >
            {loadingSummary ? 'Summarizing…' : aiSummary ? 'Summarized ✓' : 'Summarize'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchDraft}
            disabled={loadingDraft}
            className="text-purple-600 hover:bg-purple-100 text-xs h-7"
          >
            {loadingDraft ? 'Drafting…' : 'Draft Reply'}
          </Button>
        </div>

        {aiSummary && !loadingSummary && (
          <p className="mt-2 text-sm text-blue-800 bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
            ✨ {aiSummary}
          </p>
        )}

        {showDraft && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-purple-700">Suggested Reply Draft</span>
              <button onClick={() => setShowDraft(false)} className="text-purple-400 hover:text-purple-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {loadingDraft ? (
              <div className="animate-pulse h-16 bg-purple-50 rounded-lg" />
            ) : (
              <div className="bg-white border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{replyDraft}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      onReply()
                    }}
                    className="text-xs h-7"
                  >
                    Use Draft
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setReplyDraft('')} className="text-xs h-7">
                    Regenerate
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {thread.messages.map((message, index) => {
          const isExpanded = expandedMessages.has(message.id)
          const isLast = index === thread.messages.length - 1

          return (
            <div key={message.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Message header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                onClick={() => !isLast && toggleMessage(message.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {(message.from.name ?? message.from.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {message.from.name ?? message.from.email}
                      </span>
                      <span className="text-xs text-gray-500">&lt;{message.from.email}&gt;</span>
                    </div>
                    {!isExpanded && (
                      <p className="text-xs text-gray-500 truncate max-w-md">{message.snippet}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">{formatDate(message.date)}</span>
                  {!isLast && (
                    isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Message body */}
              {(isExpanded || isLast) && (
                <div className="px-4 pb-4 pt-3">
                  <div className="text-sm text-gray-500 mb-3">
                    To: {message.to.map(a => a.name ?? a.email).join(', ')}
                    {message.cc?.length ? ` | Cc: ${message.cc.map(a => a.name ?? a.email).join(', ')}` : ''}
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {message.body}
                  </div>
                  {message.attachments.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {message.attachments.map(att => (
                        <div key={att.id} className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm">
                          <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-gray-700">{att.filename}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick Reply Bar */}
      <div className="px-6 py-4 border-t border-gray-200">
        <button
          onClick={onReply}
          className="w-full flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-xl text-gray-400 text-sm hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Reply className="w-4 h-4" />
          Reply to {thread.participants[0]?.name ?? thread.participants[0]?.email}…
        </button>
      </div>
    </div>
  )
}
