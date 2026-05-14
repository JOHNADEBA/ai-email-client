import type { EmailAdapter, EmailThread, Email, ComposeData, SearchQuery, Result, EmailError, EmailAddress } from '@/types/email'

function ok<T>(value: T): Result<T, EmailError> {
  return { ok: true, value }
}

function err(code: EmailError['code'], message: string): Result<never, EmailError> {
  return { ok: false, error: { code, message } }
}

function parseAddress(raw: string): EmailAddress {
  const match = raw.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/)
  if (match) return { name: match[1].trim() || undefined, email: match[2].trim() || raw }
  return { email: raw.trim() }
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

async function gmailFetch(path: string, accessToken: string, options?: RequestInit) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gmail API ${res.status}: ${body}`)
  }
  return res.json()
}

export class GmailAdapter implements EmailAdapter {
  private accessToken: string
  private accountId: string

  constructor(accountId: string, accessToken: string) {
    this.accountId = accountId
    this.accessToken = accessToken
  }

  private extractBody(payload: Record<string, unknown>): { text: string; html: string } {
    let text = ''
    let html = ''

    const decode = (data: string) => Buffer.from(data, 'base64').toString('utf-8')

    const walk = (part: Record<string, unknown>) => {
      const mime = part.mimeType as string ?? ''
      const bodyData = (part.body as Record<string, string>)?.data ?? ''

      if (mime === 'text/plain' && bodyData && !text) {
        text = decode(bodyData)
      } else if (mime === 'text/html' && bodyData && !html) {
        html = decode(bodyData)
      } else if (mime.startsWith('multipart/')) {
        for (const sub of (part.parts as Array<Record<string, unknown>>) ?? []) {
          walk(sub)
        }
      }
    }

    walk(payload)
    return { text, html }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private gmailCategoryToAiCategory(labelIds: string[]): import('@/types/email').AiCategory | undefined {
    if (labelIds.includes('CATEGORY_PROMOTIONS')) return 'newsletter'
    if (labelIds.includes('CATEGORY_SOCIAL')) return 'social'
    if (labelIds.includes('CATEGORY_UPDATES')) return 'work'
    if (labelIds.includes('CATEGORY_FORUMS')) return 'newsletter'
    if (labelIds.includes('IMPORTANT')) return 'action_required'
    return undefined
  }

  private parseMessage(msg: Record<string, unknown>): Email {
    const payload = msg.payload as Record<string, unknown>
    const headers = (payload?.headers as Array<{ name: string; value: string }>) ?? []
    const subject = getHeader(headers, 'Subject')
    const fromRaw = getHeader(headers, 'From')
    const toRaw = getHeader(headers, 'To')
    const date = getHeader(headers, 'Date')

    const { text, html } = this.extractBody(payload)
    const body = text || (html ? this.htmlToText(html) : '')

    return {
      id: msg.id as string,
      accountId: this.accountId,
      threadId: msg.threadId as string,
      subject,
      from: parseAddress(fromRaw),
      to: toRaw.split(',').map(parseAddress),
      date: new Date(date).toISOString(),
      snippet: (msg.snippet as string) ?? '',
      body,
      isRead: !((msg.labelIds as string[]) ?? []).includes('UNREAD'),
      isStarred: ((msg.labelIds as string[]) ?? []).includes('STARRED'),
      isArchived: !((msg.labelIds as string[]) ?? []).includes('INBOX'),
      labels: ((msg.labelIds as string[]) ?? []).map(l => l.toLowerCase()),
      attachments: [],
    }
  }

  // Lightweight parse — headers + labels only, no body (used for thread list)
  private parseMessageMeta(msg: Record<string, unknown>): Email {
    const payload = msg.payload as Record<string, unknown>
    const headers = (payload?.headers as Array<{ name: string; value: string }>) ?? []
    const toRaw = getHeader(headers, 'To')
    return {
      id: msg.id as string,
      accountId: this.accountId,
      threadId: msg.threadId as string,
      subject: getHeader(headers, 'Subject'),
      from: parseAddress(getHeader(headers, 'From')),
      to: toRaw ? toRaw.split(',').map(parseAddress) : [],
      date: (() => { try { return new Date(getHeader(headers, 'Date')).toISOString() } catch { return new Date().toISOString() } })(),
      snippet: (msg.snippet as string) ?? '',
      body: '',
      isRead: !((msg.labelIds as string[]) ?? []).includes('UNREAD'),
      isStarred: ((msg.labelIds as string[]) ?? []).includes('STARRED'),
      isArchived: !((msg.labelIds as string[]) ?? []).includes('INBOX'),
      labels: ((msg.labelIds as string[]) ?? []).map((l: string) => l.toLowerCase()),
      attachments: [],
    }
  }

  async listThreads(params: { maxResults?: number; pageToken?: string; query?: SearchQuery }) {
    try {
      const q = this.buildQuery(params.query)
      const qs = new URLSearchParams({
        maxResults: String(params.maxResults ?? 20),
        ...(params.pageToken && { pageToken: params.pageToken }),
        ...(q && { q }),
      })
      const data = await gmailFetch(`/users/me/threads?${qs}`, this.accessToken)
      const threadIds: string[] = (data.threads ?? []).map((t: { id: string }) => t.id)

      // Use metadata format — headers+labels only, no body. 5-10x faster than format=full.
      const metaHeaders = 'metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date'
      const rawThreads = await Promise.all(
        threadIds.map(id =>
          gmailFetch(`/users/me/threads/${id}?format=metadata&${metaHeaders}`, this.accessToken).catch(() => null)
        )
      )

      const threads: EmailThread[] = rawThreads
        .filter((d): d is Record<string, unknown> => d !== null)
        .map(d => {
          const msgs = ((d.messages ?? []) as Array<Record<string, unknown>>).map(m => this.parseMessageMeta(m))
          const last = msgs[msgs.length - 1]
          const allLabelIds = (d.messages as Array<Record<string, unknown>> ?? []).flatMap(m => (m.labelIds as string[]) ?? [])
          return {
            id: d.id as string,
            accountId: this.accountId,
            subject: last?.subject ?? '',
            participants: [...new Map(msgs.flatMap(m => [m.from, ...m.to]).map(a => [a.email, a])).values()],
            lastDate: last?.date ?? new Date().toISOString(),
            snippet: (last?.snippet || (d.snippet as string)) ?? '',
            isRead: msgs.every(m => m.isRead),
            isStarred: msgs.some(m => m.isStarred),
            isArchived: msgs.every(m => m.isArchived),
            labels: [...new Set(msgs.flatMap(m => m.labels))],
            messageCount: msgs.length,
            messages: msgs,
            aiCategory: this.gmailCategoryToAiCategory(allLabelIds),
          }
        })

      return ok({
        threads,
        nextPageToken: data.nextPageToken,
      })
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async getThread(threadId: string) {
    try {
      const data = await gmailFetch(`/users/me/threads/${threadId}?format=full`, this.accessToken)
      const rawMessages = (data.messages ?? []) as Array<Record<string, unknown>>
      const messages: Email[] = rawMessages.map(m => this.parseMessage(m))
      const last = messages[messages.length - 1]
      const allLabelIds = rawMessages.flatMap(m => (m.labelIds as string[]) ?? [])

      const thread: EmailThread = {
        id: threadId,
        accountId: this.accountId,
        subject: last.subject,
        participants: [...new Map(messages.flatMap(m => [m.from, ...m.to]).map(a => [a.email, a])).values()],
        lastDate: last.date,
        snippet: last.snippet,
        isRead: messages.every(m => m.isRead),
        isStarred: messages.some(m => m.isStarred),
        isArchived: messages.every(m => m.isArchived),
        labels: [...new Set(messages.flatMap(m => m.labels))],
        messageCount: messages.length,
        messages,
        aiCategory: this.gmailCategoryToAiCategory(allLabelIds),
      }

      return ok(thread)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async sendEmail(data: ComposeData) {
    try {
      const to = data.to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ')
      const raw = [
        `To: ${to}`,
        `Subject: ${data.subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        data.body,
      ].join('\r\n')

      const encoded = Buffer.from(raw).toString('base64url')
      const res = await gmailFetch('/users/me/messages/send', this.accessToken, {
        method: 'POST',
        body: JSON.stringify({ raw: encoded }),
      })
      return ok({ id: res.id as string })
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async archiveThread(threadId: string) {
    try {
      await gmailFetch(`/users/me/threads/${threadId}/modify`, this.accessToken, {
        method: 'POST',
        body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
      })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async deleteThread(threadId: string) {
    try {
      await gmailFetch(`/users/me/threads/${threadId}/trash`, this.accessToken, { method: 'POST' })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async markRead(threadId: string, read: boolean) {
    try {
      await gmailFetch(`/users/me/threads/${threadId}/modify`, this.accessToken, {
        method: 'POST',
        body: JSON.stringify(read ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] }),
      })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async starThread(threadId: string, starred: boolean) {
    try {
      await gmailFetch(`/users/me/threads/${threadId}/modify`, this.accessToken, {
        method: 'POST',
        body: JSON.stringify(starred ? { addLabelIds: ['STARRED'] } : { removeLabelIds: ['STARRED'] }),
      })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async addLabel(threadId: string, label: string) {
    try {
      await gmailFetch(`/users/me/threads/${threadId}/modify`, this.accessToken, {
        method: 'POST',
        body: JSON.stringify({ addLabelIds: [label.toUpperCase()] }),
      })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async removeLabel(threadId: string, label: string) {
    try {
      await gmailFetch(`/users/me/threads/${threadId}/modify`, this.accessToken, {
        method: 'POST',
        body: JSON.stringify({ removeLabelIds: [label.toUpperCase()] }),
      })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async search(query: SearchQuery) {
    const result = await this.listThreads({ query, maxResults: 50 })
    if (!result.ok) return result
    return ok(result.value.threads)
  }

  async getLabels() {
    try {
      const data = await gmailFetch('/users/me/labels', this.accessToken)
      return ok((data.labels as Array<{ name: string }>).map(l => l.name.toLowerCase()))
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  private buildQuery(query?: SearchQuery): string {
    const parts: string[] = []
    if (query?.q) parts.push(query.q)
    if (query?.from) parts.push(`from:${query.from}`)
    if (query?.to) parts.push(`to:${query.to}`)
    if (query?.isUnread) parts.push('is:unread')
    if (query?.isStarred) parts.push('is:starred')
    if (query?.isArchived) parts.push('-in:inbox -in:trash -in:spam')
    if (query?.hasAttachment) parts.push('has:attachment')
    if (query?.after) parts.push(`after:${query.after}`)
    if (query?.before) parts.push(`before:${query.before}`)
    if (query?.labels?.length) {
      for (const label of query.labels) {
        parts.push(this.labelToGmailQuery(label))
      }
    }
    return parts.join(' ')
  }

  private labelToGmailQuery(label: string): string {
    switch (label) {
      case 'work': return 'category:updates'
      case 'personal': return 'category:primary'
      case 'newsletter': return 'category:promotions'
      case 'action_required': return 'is:important'
      case 'finance': return '(invoice OR receipt OR payment OR statement OR billing OR bank)'
      case 'social': return 'category:social'
      default: return `label:${label}`
    }
  }
}
