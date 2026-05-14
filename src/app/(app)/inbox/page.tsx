'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useEmailStore } from '@/store/email-store'
import { ThreadList } from '@/components/email/thread-list'
import { ThreadView } from '@/components/email/thread-view'
import { Compose } from '@/components/email/compose'
import { cn } from '@/lib/utils'
import type { EmailThread } from '@/types/email'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'

// Module-level caches — survive tab switches within the session
const threadCache = new Map<string, { threads: EmailThread[]; nextPageToken?: string; ts: number }>()
const summaryCache = new Map<string, string>() // threadId → summary
const CACHE_TTL = 60_000
// Client-side exclusions — prevent a just-mutated thread from re-appearing even if the
// API hasn't propagated yet. Keyed by threadId, value = which views to hide it from.
const pendingRemove = new Map<string, 'all' | 'non-archive' | 'archive'>()

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

  const account = accounts.find(a => a.id === activeAccountId) ?? accounts[0]
  const selectedThread = threads.find(t => t.id === selectedThreadId) ?? null
  const replyThread = composeReplyTo ? threads.find(t => t.id === composeReplyTo) : undefined
  const forwardThread = composeForwardFrom ? threads.find(t => t.id === composeForwardFrom) : undefined

  const [sortByPriority, setSortByPriority] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const nextPageTokenRef = useRef<string | undefined>(undefined)
  const prevSearchRef = useRef(searchQuery)
  // Only tracks IDs queued this load batch — prevents redundant fetches
  const pendingSummaryIds = useRef(new Set<string>())

  useEffect(() => {
    if (prevSearchRef.current !== '' && searchQuery === '') setRefreshKey(k => k + 1)
    prevSearchRef.current = searchQuery
  }, [searchQuery])

  const isUnified = activeAccountId === null || activeAccountId === 'all'
  const cacheKey = `${activeAccountId ?? 'all'}::${activeLabel ?? 'inbox'}`

  // ─── Load threads ──────────────────────────────────────────────────────────
  const loadThreads = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = threadCache.get(cacheKey)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setThreads(cached.threads)
        nextPageTokenRef.current = cached.nextPageToken
        setHasMore(!!cached.nextPageToken)
        return
      }
    }

    setLoading(true)
    setLoadError(null)
    pendingSummaryIds.current.clear()

    try {
      const params = buildParams(50, undefined, isUnified, activeAccountId, activeLabel)
      const res = await fetch(`/api/emails?${params}`)
      const data = await res.json() as { threads?: EmailThread[]; nextPageToken?: string; error?: string }
      if (!res.ok || data.error) { setLoadError(data.error ?? `Error ${res.status}`); setThreads([]); return }

      const fresh = filterPending(data.threads ?? [], activeLabel)
      nextPageTokenRef.current = data.nextPageToken
      setHasMore(!!data.nextPageToken)
      threadCache.set(cacheKey, { threads: fresh, nextPageToken: data.nextPageToken, ts: Date.now() })
      setThreads(fresh)
    } catch (e) {
      setLoadError(String(e))
    } finally {
      setLoading(false)
    }
  }, [activeAccountId, activeLabel, isUnified, cacheKey, setLoading, setThreads])

  useEffect(() => {
    if (refreshKey > 0) pendingRemove.clear() // hard refresh clears client-side exclusions
    loadThreads(refreshKey > 0)
  }, [loadThreads, refreshKey])

  // ─── Load more (infinite scroll) ──────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !nextPageTokenRef.current) return
    setIsLoadingMore(true)
    try {
      const params = buildParams(50, nextPageTokenRef.current, isUnified, activeAccountId, activeLabel)
      const res = await fetch(`/api/emails?${params}`)
      const data = await res.json() as { threads?: EmailThread[]; nextPageToken?: string; error?: string }
      if (!res.ok || data.error) return

      const more = filterPending(data.threads ?? [], activeLabel)
      nextPageTokenRef.current = data.nextPageToken
      setHasMore(!!data.nextPageToken)

      const merged = [...threads, ...more.filter(t => !threads.some(e => e.id === t.id))]
      threadCache.set(cacheKey, { threads: merged, nextPageToken: data.nextPageToken, ts: Date.now() })
      setThreads(merged)
    } catch { /* silent */ } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, isUnified, activeAccountId, activeLabel, cacheKey, threads, setThreads])

  // ─── Auto-summarize (cached, no infinite loop) ─────────────────────────────
  useEffect(() => {
    // First, apply any already-cached summaries immediately (no fetch needed)
    threads.forEach(t => {
      const cached = summaryCache.get(t.id)
      if (cached && !t.aiSummary) updateThread({ ...t, aiSummary: cached })
    })

    // Fetch summaries for all unsummarized threads, in batches of 10
    const toFetch = threads
      .filter(t => !t.aiSummary && !summaryCache.has(t.id) && !pendingSummaryIds.current.has(t.id))

    if (toFetch.length === 0) return

    const summarize = (thread: EmailThread) => {
      pendingSummaryIds.current.add(thread.id)
      return fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread }),
      })
        .then(r => r.json())
        .then((data: { summary?: string }) => {
          if (data.summary) {
            summaryCache.set(thread.id, data.summary)
            updateThread({ ...thread, aiSummary: data.summary })
          }
        })
        .catch(() => { pendingSummaryIds.current.delete(thread.id) })
    }

    // Fire in batches of 10 with 200ms stagger so we don't flood the server
    const BATCH = 10
    for (let i = 0; i < toFetch.length; i += BATCH) {
      const batch = toFetch.slice(i, i + BATCH)
      setTimeout(() => Promise.all(batch.map(summarize)), i * 20)
    }
  // Only re-run when the set of thread IDs changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads.map(t => t.id).join(',')])

  // ─── Actions ───────────────────────────────────────────────────────────────
  function handleSelectThread(thread: EmailThread) {
    setSelectedThread(thread.id)

    // Fetch full body (list view only has metadata headers, no body content)
    const needsBody = thread.messages.every(m => !m.body)
    if (needsBody) {
      fetch(`/api/emails/${thread.id}?accountId=${thread.accountId}`)
        .then(r => r.json())
        .then((full: EmailThread) => { if (full?.id) updateThread({ ...thread, ...full }) })
        .catch(() => {})
    }

    if (!thread.isRead) {
      updateThread({ ...thread, isRead: true })
      fetch(`/api/emails/${thread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', accountId: thread.accountId, value: true }),
      }).catch(() => {})
    }
  }

  function invalidateAllCaches() {
    threadCache.clear() // force fresh fetch on every tab after a mutation
  }

  function handleArchive() {
    if (!selectedThread) return
    const isArchived = selectedThread.isArchived
    removeThread(selectedThread.id)
    // Exclude from opposite view until API propagates
    pendingRemove.set(selectedThread.id, isArchived ? 'archive' : 'non-archive')
    invalidateAllCaches()
    fetch(`/api/emails/${selectedThread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: isArchived ? 'unarchive' : 'archive',
        accountId: selectedThread.accountId,
      }),
    }).catch(() => {})
  }

  function handleDelete() {
    if (!selectedThread) return
    removeThread(selectedThread.id)
    pendingRemove.set(selectedThread.id, 'all')
    invalidateAllCaches()
    fetch(`/api/emails/${selectedThread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', accountId: selectedThread.accountId }),
    }).catch(() => {})
  }

  function handleStar(thread?: EmailThread) {
    const t = thread ?? selectedThread
    if (!t) return
    const starred = !t.isStarred
    if (activeLabel === 'starred' && !starred) {
      removeThread(t.id)
      pendingRemove.set(t.id, 'archive') // hide from starred (reuse 'archive' slot for starred tab)
      invalidateAllCaches()
    } else {
      updateThread({ ...t, isStarred: starred })
    }
    fetch(`/api/emails/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'star', accountId: t.accountId, value: starred }),
    }).catch(() => {
      pendingRemove.delete(t.id)
      if (activeLabel === 'starred' && !starred) updateThread({ ...t, isStarred: true })
      else updateThread({ ...t, isStarred: !starred })
    })
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
          <a href="/login" className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
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
              {activeLabel ? activeLabel.replace(/_/g, ' ') : isUnified ? 'All Inboxes' : 'Inbox'}
            </h2>
            <p className="text-xs text-gray-400">{threads.length} threads</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSortByPriority(!sortByPriority)}
              className={cn('p-1.5 rounded-lg text-xs transition-colors', sortByPriority ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100')}
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
            <button onClick={() => setRefreshKey(k => k + 1)} className="mt-4 text-xs text-blue-600 hover:underline">Try again</button>
          </div>
        ) : (
          <ThreadList
            threads={displayedThreads}
            selectedId={selectedThreadId}
            onSelect={handleSelectThread}
            onStar={handleStar}
            isLoading={isLoading}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
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

function filterPending(threads: EmailThread[], activeLabel: string | null): EmailThread[] {
  if (pendingRemove.size === 0) return threads
  return threads.filter(t => {
    const rule = pendingRemove.get(t.id)
    if (!rule) return true
    if (rule === 'all') return false
    if (rule === 'non-archive') return activeLabel === 'archive' // hide from non-archive views
    if (rule === 'archive') return activeLabel !== 'archive' && activeLabel !== 'starred' // hide from archive/starred
    return true
  })
}

function buildParams(
  maxResults: number,
  pageToken: string | undefined,
  isUnified: boolean,
  activeAccountId: string | null,
  activeLabel: string | null,
): URLSearchParams {
  const params = new URLSearchParams({ maxResults: String(maxResults) })
  if (isUnified) { params.set('unified', 'true') }
  else if (activeAccountId) { params.set('accountId', activeAccountId) }
  if (pageToken) params.set('pageToken', pageToken)
  if (activeLabel === 'starred') params.set('starred', 'true')
  else if (activeLabel === 'archive') params.set('archived', 'true')
  else if (activeLabel && activeLabel !== 'inbox') params.set('label', activeLabel)
  return params
}
