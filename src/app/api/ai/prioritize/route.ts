import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { scoreThreadPriority } from '@/lib/ai/email-ai'
import type { EmailThread } from '@/types/email'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { threads } = await request.json() as { threads: EmailThread[] }
  const account = session.accounts[0]

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ threads })
  }

  const scored = await Promise.all(threads.map(async t => {
    const result = await scoreThreadPriority(t, account?.email ?? '')
    return { ...t, aiPriority: result.score }
  }))

  return NextResponse.json({ threads: scored })
}
