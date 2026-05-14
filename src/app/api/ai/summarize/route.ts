import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { summarizeThread } from '@/lib/ai/email-ai'
import type { EmailThread } from '@/types/email'

function basicSummary(thread: EmailThread): string {
  const latest = thread.messages[thread.messages.length - 1]
  const raw = latest?.body ?? thread.snippet ?? ''

  // Strip HTML tags and collapse whitespace
  const text = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

  // Drop quoted reply lines (lines starting with "> " or "On ... wrote:")
  const lines = text.split(/(?<=[.!?])\s+/)
  const meaningful = lines
    .filter(s => s.length > 30 && !/^(>|On .+ wrote:|From:|To:|Subject:|Date:)/i.test(s.trim()))
    .slice(0, 3)

  const excerpt = meaningful.length > 0
    ? meaningful.join(' ')
    : text.slice(0, 200)

  const fromName = latest?.from?.name ?? latest?.from?.email ?? 'Someone'
  const count = thread.messageCount > 1 ? ` (${thread.messageCount} messages)` : ''

  return `${fromName} says: "${excerpt.slice(0, 220)}${excerpt.length > 220 ? '…' : ''}"${count}`
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { thread } = await request.json() as { thread: EmailThread }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      summary: basicSummary(thread),
      hint: 'Add an ANTHROPIC_API_KEY for a proper AI summary, or switch to Demo mode to see it in action.',
    })
  }

  const summary = await summarizeThread(thread)
  return NextResponse.json({ summary })
}
