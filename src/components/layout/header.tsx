'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useEmailStore } from '@/store/email-store'
import { Search, Menu, X, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmailThread } from '@/types/email'

// Session-level search cache — avoids re-fetching the same query
const searchCache = new Map<string, EmailThread[]>()

export function Header() {
  const toggleSidebar = useEmailStore(s => s.toggleSidebar)
  const setSearchQuery = useEmailStore(s => s.setSearchQuery)
  const setSearching = useEmailStore(s => s.setSearching)
  const setThreads = useEmailStore(s => s.setThreads)

  const [inputValue, setInputValue] = useState('')
  const [focused, setFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestQuery = useRef('')

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchQuery('')
      return
    }

    setSearchQuery(q)

    // Serve from cache instantly
    const cached = searchCache.get(q)
    if (cached) {
      setThreads(cached)
      return
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/emails/search?q=${encodeURIComponent(q)}`)
      const data = await res.json() as { threads: EmailThread[] }
      // Only apply if this is still the latest query (avoid race conditions)
      if (latestQuery.current === q) {
        searchCache.set(q, data.threads)
        setThreads(data.threads)
      }
    } catch { /* silent */ } finally {
      if (latestQuery.current === q) setSearching(false)
    }
  }, [setSearchQuery, setSearching, setThreads])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!inputValue.trim()) {
      latestQuery.current = ''
      setSearchQuery('')
      return
    }

    latestQuery.current = inputValue
    debounceRef.current = setTimeout(() => runSearch(inputValue), 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [inputValue, runSearch, setSearchQuery])

  function clear() {
    setInputValue('')
    setSearchQuery('')
    searchRef.current?.focus()
  }

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 h-14">
      <button
        onClick={toggleSidebar}
        className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className={cn(
        'flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
        focused ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-gray-50'
      )}>
        <Search className={cn('w-4 h-4 flex-shrink-0', focused ? 'text-blue-500' : 'text-gray-400')} />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search emails, people, or keywords…"
          className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Search emails"
        />
        {inputValue && (
          <button onClick={clear} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Notifications">
        <Bell className="w-4 h-4" />
      </button>
    </header>
  )
}
