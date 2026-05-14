import { NextRequest, NextResponse } from 'next/server'
import { getSession, saveSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { accountId } = await request.json() as { accountId: string }
  const accounts = session.accounts.filter(a => a.id !== accountId)
  await saveSession({ ...session, accounts })

  return NextResponse.json({ ok: true })
}
