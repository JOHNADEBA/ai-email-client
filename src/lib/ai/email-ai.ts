import Anthropic from '@anthropic-ai/sdk'
import type { EmailThread, AiCategory } from '@/types/email'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-sonnet-4-6'

function threadContext(thread: EmailThread): string {
  return thread.messages.map(m => `
From: ${m.from.name ?? m.from.email} <${m.from.email}>
Date: ${new Date(m.date).toLocaleString()}
---
${m.body.slice(0, 1500)}
`).join('\n\n===\n\n')
}

export async function summarizeThread(thread: EmailThread): Promise<string> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 150,
      system: 'You are an expert email assistant. Summarize email threads concisely in 2-3 sentences. Focus on key decisions, action items, and what the user needs to know. Be direct and informative.',
      messages: [
        {
          role: 'user',
          content: `Summarize this email thread:\n\nSubject: ${thread.subject}\n\n${threadContext(thread)}`,
        },
      ],
    })

    return response.content[0].type === 'text' ? response.content[0].text : ''
  } catch {
    return ''
  }
}

export async function generateReplyDraft(thread: EmailThread, userEmail: string): Promise<string> {
  try {
    const lastMessage = thread.messages[thread.messages.length - 1]
    const isFromMe = lastMessage.from.email.toLowerCase() === userEmail.toLowerCase()

    if (isFromMe) return ''

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: `You are an expert email assistant helping draft professional replies.
Match the tone and style of the conversation.
Write a complete, ready-to-send reply.
Start with a greeting if appropriate.
Do not include subject line or headers.
Be concise but thorough.`,
      messages: [
        {
          role: 'user',
          content: `Draft a reply to this email thread. The user's email is ${userEmail}.

Subject: ${thread.subject}

${threadContext(thread)}

Write a professional, context-aware reply:`,
        },
      ],
    })

    return response.content[0].type === 'text' ? response.content[0].text : ''
  } catch {
    return ''
  }
}

export interface PriorityResult {
  score: number
  reasoning: string
}

export async function scoreThreadPriority(thread: EmailThread, userEmail: string): Promise<PriorityResult> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: `You are an expert email prioritization assistant.
Score email priority 1-10 where:
- 10: Urgent action required immediately (P1 incidents, critical deadlines today)
- 7-9: Important, needs attention today (key decisions, time-sensitive requests)
- 4-6: Normal priority, respond within 24-48h
- 1-3: Low priority (newsletters, notifications, FYI)

Respond in JSON format: {"score": number, "reasoning": "one sentence"}`,
      messages: [
        {
          role: 'user',
          content: `Score priority for this email (user: ${userEmail}):

Subject: ${thread.subject}
From: ${thread.messages[0]?.from.name ?? thread.messages[0]?.from.email}
Snippet: ${thread.snippet}

Latest message:
${thread.messages[thread.messages.length - 1]?.body.slice(0, 500) ?? ''}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    return {
      score: Math.min(10, Math.max(1, parseInt(parsed.score) || 5)),
      reasoning: parsed.reasoning ?? '',
    }
  } catch {
    return { score: 5, reasoning: '' }
  }
}

export interface CategoryResult {
  category: AiCategory
  confidence: number
}

export async function categorizeThread(thread: EmailThread): Promise<CategoryResult> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 100,
      system: `Categorize emails into exactly one of: work, personal, newsletter, action_required, finance, social.
Respond in JSON: {"category": string, "confidence": 0.0-1.0}`,
      messages: [
        {
          role: 'user',
          content: `Categorize: Subject: "${thread.subject}" | From: ${thread.messages[0]?.from.email} | Preview: ${thread.snippet.slice(0, 200)}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    return {
      category: parsed.category ?? 'work',
      confidence: parsed.confidence ?? 0.5,
    }
  } catch {
    return { category: 'work', confidence: 0.5 }
  }
}

export async function batchEnrichThreads(threads: EmailThread[], userEmail: string): Promise<EmailThread[]> {
  return Promise.all(threads.map(async thread => {
    const [summary, priority, category] = await Promise.all([
      thread.aiSummary ? Promise.resolve(thread.aiSummary) : summarizeThread(thread),
      thread.aiPriority ? Promise.resolve({ score: thread.aiPriority, reasoning: '' }) : scoreThreadPriority(thread, userEmail),
      thread.aiCategory ? Promise.resolve({ category: thread.aiCategory, confidence: 1 }) : categorizeThread(thread),
    ])

    return {
      ...thread,
      aiSummary: summary,
      aiPriority: priority.score,
      aiCategory: category.category,
    }
  }))
}
