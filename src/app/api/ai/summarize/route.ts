import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { summarizeThread } from '@/lib/ai/email-ai'
import type { EmailThread } from '@/types/email'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { thread } = await request.json() as { thread: EmailThread }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ summary: 'AI features are not configured. To see AI summaries in action, try the Demo mode from the login page.' })
  }

  const summary = await summarizeThread(thread)
  return NextResponse.json({ summary })
}
