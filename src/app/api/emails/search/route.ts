import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateAccountInSession } from '@/lib/auth/session'
import { getAdapter, refreshTokenIfNeeded } from '@/lib/email-adapters/adapter-factory'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const accountId = searchParams.get('accountId')

  const accounts = accountId
    ? session.accounts.filter(a => a.id === accountId)
    : session.accounts

  const allThreads = await Promise.all(accounts.map(async account => {
    try {
      const refreshed = await refreshTokenIfNeeded(account)
      if (refreshed.accessToken !== account.accessToken) {
        await updateAccountInSession(account.id, { accessToken: refreshed.accessToken })
      }
      const result = await getAdapter(refreshed).search({ q })
      return result.ok ? result.value : []
    } catch { return [] }
  }))

  const threads = allThreads.flat().sort(
    (a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
  )

  return NextResponse.json({ threads })
}
