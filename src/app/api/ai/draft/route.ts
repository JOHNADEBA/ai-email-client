import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { generateReplyDraft } from '@/lib/ai/email-ai'
import type { EmailThread } from '@/types/email'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { thread } = await request.json() as { thread: EmailThread }
  const account = session.accounts.find(a => a.id === thread.accountId)

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ draft: 'Add an ANTHROPIC_API_KEY to unlock AI reply drafts, or try Demo mode to see it in action.' })
  }

  const draft = await generateReplyDraft(thread, account?.email ?? '')
  return NextResponse.json({ draft })
}
