import type { EmailAdapter, EmailThread, ComposeData, SearchQuery, Result, EmailError } from '@/types/email'
import { DEMO_THREADS } from '@/lib/demo/mock-data'

function ok<T>(value: T): Result<T, EmailError> {
  return { ok: true, value }
}

function err(code: EmailError['code'], message: string): Result<never, EmailError> {
  return { ok: false, error: { code, message } }
}

function delay(ms = 200) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class DemoAdapter implements EmailAdapter {
  private threads: EmailThread[]
  private accountId: string

  constructor(accountId: string) {
    this.accountId = accountId
    this.threads = DEMO_THREADS.filter(t => t.accountId === accountId).map(t => ({ ...t }))
  }

  async listThreads(params: { maxResults?: number; pageToken?: string; query?: SearchQuery }) {
    await delay()
    let threads = [...this.threads].filter(t => !t.isArchived)

    if (params.query?.isUnread) threads = threads.filter(t => !t.isRead)
    if (params.query?.isStarred) threads = threads.filter(t => t.isStarred)
    if (params.query?.labels?.length) {
      threads = threads.filter(t => params.query!.labels!.some(l => t.labels.includes(l)))
    }

    threads.sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())

    const max = params.maxResults ?? 20
    const start = params.pageToken ? parseInt(params.pageToken) : 0
    const page = threads.slice(start, start + max)
    const nextPageToken = start + max < threads.length ? String(start + max) : undefined

    return ok({ threads: page, nextPageToken })
  }

  async getThread(threadId: string) {
    await delay()
    const thread = this.threads.find(t => t.id === threadId)
    if (!thread) return err('NOT_FOUND', `Thread ${threadId} not found`)
    return ok(thread)
  }

  async sendEmail(data: ComposeData) {
    await delay(300)
    const id = `sent-${Date.now()}`
    return ok({ id })
  }

  async archiveThread(threadId: string) {
    await delay()
    const thread = this.threads.find(t => t.id === threadId)
    if (thread) thread.isArchived = true
    return ok(undefined)
  }

  async deleteThread(threadId: string) {
    await delay()
    this.threads = this.threads.filter(t => t.id !== threadId)
    return ok(undefined)
  }

  async markRead(threadId: string, read: boolean) {
    await delay()
    const thread = this.threads.find(t => t.id === threadId)
    if (thread) {
      thread.isRead = read
      thread.messages.forEach(m => { m.isRead = read })
    }
    return ok(undefined)
  }

  async starThread(threadId: string, starred: boolean) {
    await delay()
    const thread = this.threads.find(t => t.id === threadId)
    if (thread) thread.isStarred = starred
    return ok(undefined)
  }

  async addLabel(threadId: string, label: string) {
    await delay()
    const thread = this.threads.find(t => t.id === threadId)
    if (thread && !thread.labels.includes(label)) thread.labels.push(label)
    return ok(undefined)
  }

  async removeLabel(threadId: string, label: string) {
    await delay()
    const thread = this.threads.find(t => t.id === threadId)
    if (thread) thread.labels = thread.labels.filter(l => l !== label)
    return ok(undefined)
  }

  async search(query: SearchQuery) {
    await delay()
    let threads = [...this.threads]
    const q = query.q?.toLowerCase()

    if (q) {
      threads = threads.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        t.snippet.toLowerCase().includes(q) ||
        t.participants.some(p => p.email.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q))
      )
    }

    if (query.isUnread) threads = threads.filter(t => !t.isRead)
    if (query.isStarred) threads = threads.filter(t => t.isStarred)

    return ok(threads)
  }

  async getLabels() {
    const labels = new Set<string>()
    this.threads.forEach(t => t.labels.forEach(l => labels.add(l)))
    return ok(Array.from(labels))
  }
}
