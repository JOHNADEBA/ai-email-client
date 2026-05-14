import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateAccountInSession } from '@/lib/auth/session'
import { getAdapter, refreshTokenIfNeeded } from '@/lib/email-adapters/adapter-factory'
import type { ComposeData } from '@/types/email'

export async function POST(request: NextRequest) {
  let step = 'init'
  try {
    step = 'session'
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    step = 'parse-body'
    const text = await request.text()
    const data = JSON.parse(text) as ComposeData

    step = 'find-account'
    const account = session.accounts.find(a => a.id === data.accountId) ?? session.accounts[0]
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    step = 'refresh-token'
    const refreshed = await refreshTokenIfNeeded(account)

    step = 'update-session'
    if (refreshed.accessToken !== account.accessToken) {
      await updateAccountInSession(account.id, { accessToken: refreshed.accessToken })
    }

    step = 'check-token'
    if (!refreshed.accessToken) {
      return NextResponse.json({ error: 'Account token expired — please reconnect your Outlook account' }, { status: 401 })
    }

    step = 'get-adapter'
    const adapter = getAdapter(refreshed)

    step = 'send-email'
    const result = await adapter.sendEmail({ ...data, accountId: account.id })

    if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 500 })
    return NextResponse.json(result.value)
  } catch (e) {
    return NextResponse.json({ error: `[${step}] ${String(e)}` }, { status: 500 })
  }
}
