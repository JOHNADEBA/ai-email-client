'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { useEmailStore } from '@/store/email-store'
import type { EmailAccount } from '@/types/email'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const setAccounts = useEmailStore(s => s.setAccounts)
  const setIsDemo = useEmailStore(s => s.setIsDemo)

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then((data: { accounts: EmailAccount[]; isDemo?: boolean }) => {
        if (data.accounts) setAccounts(data.accounts)
        if (data.isDemo !== undefined) setIsDemo(data.isDemo)
      })
      .catch(() => {})
  }, [setAccounts, setIsDemo])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
