import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateAccountInSession } from '@/lib/auth/session'
import { getAdapter, refreshTokenIfNeeded } from '@/lib/email-adapters/adapter-factory'
import type { SearchQuery, EmailAccount } from '@/types/email'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId') ?? session.accounts[0]?.id
  const maxResults = parseInt(searchParams.get('maxResults') ?? '20')
  const pageToken = searchParams.get('pageToken') ?? undefined
  const label = searchParams.get('label') ?? undefined
  const isUnread = searchParams.get('unread') === 'true'
  const isStarred = searchParams.get('starred') === 'true'
  const isArchived = searchParams.get('archived') === 'true'
  const unified = searchParams.get('unified') === 'true'

  // Unified inbox: fetch from all accounts and merge, with composite pagination token
  if (unified) {
    // pageToken is a base64-encoded JSON map of { accountId: token }
    let accountTokens: Record<string, string> = {}
    if (pageToken) {
      try { accountTokens = JSON.parse(Buffer.from(pageToken, 'base64').toString('utf-8')) } catch { /* ignore */ }
    }

    const results = await Promise.all(
      session.accounts.map(async (account) => {
        try {
          const refreshed = await refreshTokenIfNeeded(account)
          if (refreshed.accessToken !== account.accessToken) {
            await updateAccountInSession(account.id, { accessToken: refreshed.accessToken })
          }
          const query: SearchQuery = {}
          if (label) query.labels = [label]
          if (isUnread) query.isUnread = true
          if (isStarred) query.isStarred = true
          if (isArchived) query.isArchived = true
          const result = await getAdapter(refreshed).listThreads({
            maxResults,
            pageToken: accountTokens[account.id],
            query,
          })
          return result.ok
            ? { threads: result.value.threads, nextPageToken: result.value.nextPageToken, accountId: account.id }
            : { threads: [], nextPageToken: undefined, accountId: account.id }
        } catch { return { threads: [], nextPageToken: undefined, accountId: '' } }
      })
    )

    const merged = results
      .flatMap(r => r.threads)
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
      .slice(0, maxResults)

    // Build composite next token — only include accounts that have more pages
    const nextTokenMap: Record<string, string> = {}
    results.forEach(r => { if (r.nextPageToken && r.accountId) nextTokenMap[r.accountId] = r.nextPageToken })
    const nextPageToken = Object.keys(nextTokenMap).length > 0
      ? Buffer.from(JSON.stringify(nextTokenMap)).toString('base64')
      : undefined

    return NextResponse.json({ threads: merged, nextPageToken })
  }

  const account = session.accounts.find(a => a.id === accountId)
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  let activeAccount: EmailAccount = account
  try {
    activeAccount = await refreshTokenIfNeeded(account)
    if (activeAccount.accessToken !== account.accessToken) {
      await updateAccountInSession(account.id, { accessToken: activeAccount.accessToken })
    }
  } catch { /* use original */ }

  const query: SearchQuery = {}
  if (label) query.labels = [label]
  if (isUnread) query.isUnread = true
  if (isStarred) query.isStarred = true
  if (isArchived) query.isArchived = true

  try {
    const adapter = getAdapter(activeAccount)
    const result = await adapter.listThreads({ maxResults, pageToken, query })
    if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 500 })
    return NextResponse.json(result.value)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
