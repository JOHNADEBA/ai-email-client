import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateAccountInSession } from '@/lib/auth/session'
import { getAdapter, refreshTokenIfNeeded } from '@/lib/email-adapters/adapter-factory'
import type { ComposeData } from '@/types/email'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const data = await request.json() as ComposeData
    const account = session.accounts.find(a => a.id === data.accountId) ?? session.accounts[0]
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    const refreshed = await refreshTokenIfNeeded(account)
    if (refreshed.accessToken !== account.accessToken) {
      await updateAccountInSession(account.id, { accessToken: refreshed.accessToken })
    }

    if (!refreshed.accessToken) {
      return NextResponse.json({ error: 'Account token expired — please reconnect your account' }, { status: 401 })
    }

    const adapter = getAdapter(refreshed)
    const result = await adapter.sendEmail({ ...data, accountId: account.id })

    if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 500 })
    return NextResponse.json(result.value)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
