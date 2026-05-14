'use client'

import { cn, providerColor, providerIcon } from '@/lib/utils'
import { useEmailStore } from '@/store/email-store'
import { Button } from '@/components/ui/button'
import {
  Inbox, Star, Archive, Briefcase, User, Newspaper,
  Zap, DollarSign, MessageSquare, Edit, X, ChevronDown,
  Layers, Plus, LogOut, Trash2,
} from 'lucide-react'
import { useState } from 'react'

const SYSTEM_LABELS = [
  { id: null, label: 'All Inboxes', icon: Layers },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'archive', label: 'Archive', icon: Archive },
]

const AI_LABELS = [
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'newsletter', label: 'Newsletter', icon: Newspaper },
  { id: 'action_required', label: 'Action Required', icon: Zap },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'social', label: 'Social', icon: MessageSquare },
]

export function Sidebar() {
  const accounts = useEmailStore(s => s.accounts)
  const activeAccountId = useEmailStore(s => s.activeAccountId)
  const activeLabel = useEmailStore(s => s.activeLabel)
  const sidebarOpen = useEmailStore(s => s.sidebarOpen)
  const threads = useEmailStore(s => s.threads)
  const isDemo = useEmailStore(s => s.isDemo)
  const setIsDemo = useEmailStore(s => s.setIsDemo)
  const setActiveAccount = useEmailStore(s => s.setActiveAccount)
  const setActiveLabel = useEmailStore(s => s.setActiveLabel)
  const openCompose = useEmailStore(s => s.openCompose)
  const toggleSidebar = useEmailStore(s => s.toggleSidebar)

  const unreadCount = threads.filter(t => !t.isRead && !t.isArchived).length
  const [showAccounts, setShowAccounts] = useState(true)

  async function handleRemoveAccount(e: React.MouseEvent, accountId: string) {
    e.stopPropagation()
    await fetch('/api/auth/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    })
    window.location.reload()
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  async function handleToggleDemo() {
    if (isDemo) {
      // Switching to live — check if real accounts exist first
      await fetch('/api/auth/demo/exit', { method: 'POST' })
      const res = await fetch('/api/accounts?real=1')
      const data = await res.json() as { hasRealAccounts: boolean }
      if (data.hasRealAccounts) {
        window.location.reload()
      } else {
        window.location.href = '/login'
      }
    } else {
      // Switching to demo
      window.location.href = '/api/auth/demo'
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside className={cn(
        'fixed md:static inset-y-0 left-0 z-40 flex flex-col w-64 bg-gray-900 text-white transition-transform duration-200',
        'md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold">AI</span>
            </div>
            <span className="font-semibold text-sm">MailAI</span>
          </div>
          <button onClick={toggleSidebar} className="md:hidden text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compose */}
        <div className="px-3 py-3">
          <Button
            onClick={() => openCompose()}
            className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700"
            size="default"
          >
            <Edit className="w-4 h-4" />
            Compose
          </Button>
        </div>

        {/* Accounts */}
        <div className="px-3 mb-2">
          <button
            className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 px-2 py-1"
            onClick={() => setShowAccounts(!showAccounts)}
          >
            <span className="font-medium uppercase tracking-wider">Accounts</span>
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !showAccounts && '-rotate-90')} />
          </button>

          {showAccounts && (
            <>
              {accounts.map(account => (
                <button
                  key={account.id}
                  className={cn(
                    'group w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors mt-0.5',
                    activeAccountId === account.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'
                  )}
                  onClick={() => setActiveAccount(account.id)}
                >
                  <div className={cn('w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0', providerColor(account.provider))}>
                    {providerIcon(account.provider)}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{account.name}</div>
                    <div className="truncate text-xs text-gray-400">{account.email}</div>
                  </div>
                  <button
                    onClick={(e) => handleRemoveAccount(e, account.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all flex-shrink-0"
                    title="Remove account"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))}
              {!isDemo && (
                <a
                  href="/login"
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors mt-0.5"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs">Add account</span>
                </a>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
          <div className="text-xs text-gray-400 px-2 py-1 font-medium uppercase tracking-wider">Folders</div>
          {SYSTEM_LABELS.map(({ id, label, icon: Icon }) => (
            <SidebarItem
              key={label}
              label={label}
              icon={Icon}
              active={id === null ? activeAccountId === null : activeLabel === id}
              badge={id === 'inbox' || id === null ? unreadCount : 0}
              onClick={() => {
                if (id === null) {
                  setActiveAccount(null)
                } else {
                  setActiveLabel(id)
                }
                if (sidebarOpen) toggleSidebar()
              }}
            />
          ))}

          <div className="text-xs text-gray-400 px-2 py-1 font-medium uppercase tracking-wider mt-3">AI Categories</div>
          {AI_LABELS.map(({ id, label, icon: Icon }) => (
            <SidebarItem
              key={id}
              label={label}
              icon={Icon}
              active={activeLabel === id}
              onClick={() => {
                setActiveLabel(id)
                if (sidebarOpen) toggleSidebar()
              }}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 space-y-2">
          {/* Demo / Live toggle */}
          <button
            onClick={handleToggleDemo}
            className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <span className="text-xs text-gray-400">
              {isDemo ? 'Demo mode' : 'Live mode'}
            </span>
            <div className={cn(
              'relative w-8 h-4 rounded-full transition-colors',
              isDemo ? 'bg-blue-500' : 'bg-gray-600'
            )}>
              <div className={cn(
                'absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform',
                isDemo ? 'translate-x-4' : 'translate-x-0.5'
              )} />
            </div>
          </button>

          {!isDemo && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          )}
          <p className="text-xs text-gray-500 text-center">Powered by Claude AI ✨</p>
          <p className="text-xs text-gray-600 text-center">Built by John Adeba</p>
        </div>
      </aside>
    </>
  )
}

function SidebarItem({
  label, icon: Icon, active, badge, onClick,
}: {
  label: string
  icon: React.ElementType
  active: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
        active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
      )}
      onClick={onClick}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className={cn('text-xs rounded-full px-1.5 min-w-[1.25rem] text-center', active ? 'bg-blue-500' : 'bg-blue-600 text-white')}>
          {badge}
        </span>
      ) : null}
    </button>
  )
}
