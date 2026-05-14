'use client'

import { create } from 'zustand'
import type { EmailThread, EmailAccount, SearchQuery } from '@/types/email'

interface EmailState {
  accounts: EmailAccount[]
  activeAccountId: string | null  // null = "all accounts" (unified inbox)
  threads: EmailThread[]
  selectedThreadId: string | null
  searchQuery: string
  activeLabel: string | null
  isLoading: boolean
  isSearching: boolean
  showCompose: boolean
  composeReplyTo: string | null
  composeForwardFrom: string | null
  sidebarOpen: boolean
  isDemo: boolean

  setAccounts: (accounts: EmailAccount[]) => void
  setIsDemo: (isDemo: boolean) => void
  setActiveAccount: (id: string | null) => void
  setThreads: (threads: EmailThread[]) => void
  updateThread: (thread: EmailThread) => void
  removeThread: (id: string) => void
  setSelectedThread: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setActiveLabel: (label: string | null) => void
  setLoading: (loading: boolean) => void
  setSearching: (searching: boolean) => void
  openCompose: (replyTo?: string, forwardFrom?: string) => void
  closeCompose: () => void
  toggleSidebar: () => void

  getActiveAccount: () => EmailAccount | undefined
  getSelectedThread: () => EmailThread | undefined
  getUnreadCount: () => number
}

export const useEmailStore = create<EmailState>((set, get) => ({
  accounts: [],
  activeAccountId: null,
  threads: [],
  selectedThreadId: null,
  searchQuery: '',
  activeLabel: null,
  isLoading: false,
  isSearching: false,
  showCompose: false,
  composeReplyTo: null,
  composeForwardFrom: null,
  sidebarOpen: false,
  isDemo: false,

  setAccounts: (accounts) => set({ accounts, activeAccountId: accounts.length > 1 ? null : (accounts[0]?.id ?? null) }),
  setIsDemo: (isDemo) => set({ isDemo }),
  setActiveAccount: (id) => set({ activeAccountId: id, selectedThreadId: null, threads: [] }),
  setThreads: (threads) => set({ threads }),
  updateThread: (thread) => set(s => ({
    threads: s.threads.map(t => t.id === thread.id ? thread : t),
  })),
  removeThread: (id) => set(s => ({
    threads: s.threads.filter(t => t.id !== id),
    selectedThreadId: s.selectedThreadId === id ? null : s.selectedThreadId,
  })),
  setSelectedThread: (id) => set({ selectedThreadId: id }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveLabel: (activeLabel) => set({ activeLabel, selectedThreadId: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setSearching: (isSearching) => set({ isSearching }),
  openCompose: (replyTo, forwardFrom) => set({
    showCompose: true,
    composeReplyTo: replyTo ?? null,
    composeForwardFrom: forwardFrom ?? null,
  }),
  closeCompose: () => set({ showCompose: false, composeReplyTo: null, composeForwardFrom: null }),
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

  getActiveAccount: () => {
    const s = get()
    return s.accounts.find(a => a.id === s.activeAccountId)
  },
  getSelectedThread: () => {
    const s = get()
    return s.threads.find(t => t.id === s.selectedThreadId)
  },
  getUnreadCount: () => get().threads.filter(t => !t.isRead && !t.isArchived).length,
}))
