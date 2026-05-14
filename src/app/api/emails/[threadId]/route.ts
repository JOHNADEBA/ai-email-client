import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateAccountInSession } from '@/lib/auth/session'
import { getAdapter, refreshTokenIfNeeded } from '@/lib/email-adapters/adapter-factory'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { threadId } = await params
  const accountId = new URL(request.url).searchParams.get('accountId') ?? session.accounts[0]?.id
  const account = session.accounts.find(a => a.id === accountId)
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const refreshed = await refreshTokenIfNeeded(account)
  if (refreshed.accessToken !== account.accessToken) {
    await updateAccountInSession(account.id, { accessToken: refreshed.accessToken })
  }

  const adapter = getAdapter(refreshed)
  const result = await adapter.getThread(threadId)
  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 404 })
  return NextResponse.json(result.value)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { threadId } = await params
  const body = await request.json() as { action: string; accountId?: string; value?: boolean; label?: string }
  const accountId = body.accountId ?? session.accounts[0]?.id
  const account = session.accounts.find(a => a.id === accountId)
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const refreshed = await refreshTokenIfNeeded(account)
  if (refreshed.accessToken !== account.accessToken) {
    await updateAccountInSession(account.id, { accessToken: refreshed.accessToken })
  }

  const adapter = getAdapter(refreshed)

  let result
  switch (body.action) {
    case 'archive': result = await adapter.archiveThread(threadId); break
    case 'unarchive': result = await adapter.addLabel(threadId, 'INBOX'); break
    case 'delete': result = await adapter.deleteThread(threadId); break
    case 'markRead': result = await adapter.markRead(threadId, body.value ?? true); break
    case 'star': result = await adapter.starThread(threadId, body.value ?? true); break
    case 'addLabel': result = await adapter.addLabel(threadId, body.label!); break
    case 'removeLabel': result = await adapter.removeLabel(threadId, body.label!); break
    default: return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
