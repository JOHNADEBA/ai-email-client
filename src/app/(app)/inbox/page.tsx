'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useEmailStore } from '@/store/email-store'
import { ThreadList } from '@/components/email/thread-list'
import { ThreadView } from '@/components/email/thread-view'
import { Compose } from '@/components/email/compose'
import { cn } from '@/lib/utils'
import type { EmailThread } from '@/types/email'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'

export default function InboxPage() {
  const accounts = useEmailStore(s => s.accounts)
  const isDemo = useEmailStore(s => s.isDemo)
  const activeAccountId = useEmailStore(s => s.activeAccountId)
  const threads = useEmailStore(s => s.threads)
  const selectedThreadId = useEmailStore(s => s.selectedThreadId)
  const activeLabel = useEmailStore(s => s.activeLabel)
  const isLoading = useEmailStore(s => s.isLoading)
  const showCompose = useEmailStore(s => s.showCompose)
  const composeReplyTo = useEmailStore(s => s.composeReplyTo)
  const composeForwardFrom = useEmailStore(s => s.composeForwardFrom)
  const setThreads = useEmailStore(s => s.setThreads)
  const setLoading = useEmailStore(s => s.setLoading)
  const setSelectedThread = useEmailStore(s => s.setSelectedThread)
  const updateThread = useEmailStore(s => s.updateThread)
  const removeThread = useEmailStore(s => s.removeThread)
  const openCompose = useEmailStore(s => s.openCompose)
  const closeCompose = useEmailStore(s => s.closeCompose)

  const searchQuery = useEmailStore(s => s.searchQuery)

  // In unified mode activeAccountId is null — fall back to first account for compose
  const account = accounts.find(a => a.id === activeAccountId) ?? accounts[0]
  const selectedThread = threads.find(t => t.id === selectedThreadId) ?? null
  const replyThread = composeReplyTo ? threads.find(t => t.id === composeReplyTo) : undefined
  const forwardThread = composeForwardFrom ? threads.find(t => t.id === composeForwardFrom) : undefined

  const [sortByPriority, setSortByPriority] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const prevSearchRef = useRef(searchQuery)

  // When search is cleared, reload the inbox
  useEffect(() => {
    if (prevSearchRef.current !== '' && searchQuery === '') {
      setRefreshKey(k => k + 1)
    }
    prevSearchRef.current = searchQuery
  }, [searchQuery])

  // Unified mode: activeAccountId === null means show all accounts
  const isUnified = activeAccountId === null || activeAccountId === 'all'

  const loadThreads = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({ maxResults: '30' })

      if (isUnified) {
        params.set('unified', 'true')
      } else {
        if (!activeAccountId) return
        params.set('accountId', activeAccountId)
      }

      if (activeLabel === 'starred') params.set('starred', 'true')
      else if (activeLabel === 'archive') params.set('archived', 'true')
      else if (activeLabel && activeLabel !== 'inbox') params.set('label', activeLabel)

      const res = await fetch(`/api/emails?${params}`)
      const data = await res.json() as { threads?: EmailThread[]; error?: string }
      if (!res.ok || data.error) {
        setLoadError(data.error ?? `Server error ${res.status}`)
        setThreads([])
        return
      }
      setThreads(data.threads ?? [])
    } catch (e) {
      setLoadError(String(e))
    } finally {
      setLoading(false)
    }
  }, [activeAccountId, activeLabel, isUnified, setLoading, setThreads])

  useEffect(() => { loadThreads() }, [loadThreads, refreshKey])

  // Auto-fetch summaries for the first 5 threads that don't have one yet
  useEffect(() => {
    if (threads.length === 0) return
    const toSummarize = threads.filter(t => !t.aiSummary).slice(0, 5)
    if (toSummarize.length === 0) return
    toSummarize.forEach(thread => {
      fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread }),
      })
        .then(r => r.json())
        .then((data: { summary?: string }) => {
          if (data.summary) updateThread({ ...thread, aiSummary: data.summary })
        })
        .catch(() => {})
    })
  }, [threads, updateThread])

  async function handleSelectThread(thread: EmailThread) {
    setSelectedThread(thread.id)
    if (!thread.isRead) {
      await fetch(`/api/emails/${thread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', accountId: thread.accountId, value: true }),
      })
      updateThread({ ...thread, isRead: true })
    }
  }

  async function handleArchive() {
    if (!selectedThread) return
    await fetch(`/api/emails/${selectedThread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive', accountId: selectedThread.accountId }),
    })
    removeThread(selectedThread.id)
  }

  async function handleDelete() {
    if (!selectedThread) return
    await fetch(`/api/emails/${selectedThread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', accountId: selectedThread.accountId }),
    })
    removeThread(selectedThread.id)
  }

  async function handleStar(thread?: EmailThread) {
    const t = thread ?? selectedThread
    if (!t) return
    const starred = !t.isStarred
    await fetch(`/api/emails/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'star', accountId: t.accountId, value: starred }),
    })
    updateThread({ ...t, isStarred: starred })
  }

  const displayedThreads = sortByPriority
    ? [...threads].sort((a, b) => (b.aiPriority ?? 5) - (a.aiPriority ?? 5))
    : threads

  if (!isDemo && accounts.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✉️</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">No accounts connected</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in with Gmail, Outlook, or IMAP to start reading your emails.</p>
          <a
            href="/login"
            className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign in to get started
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Thread list pane */}
      <div className={cn(
        'flex flex-col border-r border-gray-200 bg-white transition-all min-w-0',
        selectedThread ? 'hidden md:flex md:w-80 lg:w-96' : 'flex-1 w-full'
      )}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 capitalize">
              {isUnified ? 'All Inboxes' : (activeLabel ?? 'Inbox')}
            </h2>
            <p className="text-xs text-gray-400">{threads.length} threads</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSortByPriority(!sortByPriority)}
              className={cn(
                'p-1.5 rounded-lg text-xs transition-colors',
                sortByPriority ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'
              )}
              title="Sort by AI priority"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <span className="text-red-500 text-lg">!</span>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Could not load emails</p>
            <p className="text-xs text-red-500 max-w-xs break-words">{loadError}</p>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="mt-4 text-xs text-blue-600 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <ThreadList
            threads={displayedThreads}
            selectedId={selectedThreadId}
            onSelect={handleSelectThread}
            onStar={handleStar}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Thread view pane */}
      {selectedThread ? (
        <div className="flex-1 min-w-0 overflow-hidden">
          <ThreadView
            thread={selectedThread}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onStar={() => handleStar()}
            onReply={() => openCompose(selectedThread.id)}
            onForward={() => openCompose(undefined, selectedThread.id)}
            onClose={() => setSelectedThread(null)}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400">
            <div className="text-5xl mb-3">✉️</div>
            <p className="text-sm font-medium">Select an email to read</p>
            <p className="text-xs mt-1">Or press C to compose</p>
          </div>
        </div>
      )}

      {/* Compose */}
      {showCompose && account && (
        <Compose
          account={account}
          allAccounts={accounts}
          replyTo={replyThread}
          forwardFrom={forwardThread}
          onClose={closeCompose}
          onSent={() => { closeCompose(); setRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}
