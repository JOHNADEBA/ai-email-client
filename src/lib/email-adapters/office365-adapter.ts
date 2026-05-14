import type { EmailAdapter, EmailThread, Email, ComposeData, SearchQuery, Result, EmailError, EmailAddress } from '@/types/email'

function ok<T>(value: T): Result<T, EmailError> {
  return { ok: true, value }
}

function err(code: EmailError['code'], message: string): Result<never, EmailError> {
  return { ok: false, error: { code, message } }
}

async function graphFetch(path: string, accessToken: string, options?: RequestInit) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Graph API ${res.status}: ${body}`)
  }
  if (res.status === 204) return {}
  return res.json()
}

interface GraphMessage {
  id: string
  conversationId: string
  subject: string
  from: { emailAddress: { name: string; address: string } }
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>
  ccRecipients?: Array<{ emailAddress: { name: string; address: string } }>
  receivedDateTime: string
  bodyPreview: string
  body: { content: string; contentType: string }
  isRead: boolean
  flag?: { flagStatus: string }
  categories?: string[]
  hasAttachments: boolean
}

function mapAddress(a: { emailAddress: { name: string; address: string } }): EmailAddress {
  return { name: a.emailAddress.name || undefined, email: a.emailAddress.address }
}

function mapMessage(msg: GraphMessage, accountId: string): Email {
  return {
    id: msg.id,
    accountId,
    threadId: msg.conversationId,
    subject: msg.subject ?? '(no subject)',
    from: mapAddress(msg.from),
    to: msg.toRecipients.map(mapAddress),
    cc: msg.ccRecipients?.map(mapAddress),
    date: new Date(msg.receivedDateTime).toISOString(),
    snippet: msg.bodyPreview,
    body: msg.body?.content ?? msg.bodyPreview ?? '',
    bodyHtml: msg.body?.contentType === 'html' ? msg.body.content : undefined,
    isRead: msg.isRead,
    isStarred: msg.flag?.flagStatus === 'flagged',
    isArchived: false,
    labels: msg.categories ?? [],
    attachments: [],
  }
}

export class Office365Adapter implements EmailAdapter {
  private accessToken: string
  private accountId: string

  constructor(accountId: string, accessToken: string) {
    this.accountId = accountId
    this.accessToken = accessToken
  }

  async listThreads(params: { maxResults?: number; pageToken?: string; query?: SearchQuery }) {
    try {
      const top = params.maxResults ?? 20
      const q = params.query

      const filters: string[] = []
      if (q?.isStarred) filters.push("flag/flagStatus eq 'flagged'")
      if (q?.isUnread) filters.push('isRead eq false')
      if (q?.from) filters.push(`from/emailAddress/address eq '${q.from}'`)
      if (q?.labels?.length) filters.push(`categories/any(c:c eq '${q.labels[0]}')`)

      const qs = new URLSearchParams({
        $top: String(top),
        $select: 'id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,flag,categories,hasAttachments,conversationId',
      })
      if (params.pageToken) qs.set('$skip', params.pageToken)
      if (filters.length) qs.set('$filter', filters.join(' and '))
      // $orderby conflicts with $filter on some folders — only add when not filtering
      if (!filters.length) qs.set('$orderby', 'lastModifiedDateTime desc')
      if (q?.q) qs.set('$search', `"${q.q}"`)

      // Starred: use /me/messages (searches all folders, supports $filter without $orderby)
      // Archived: use archive folder; default: inbox
      let endpoint: string
      if (q?.isStarred) endpoint = `/me/messages?${qs}`
      else if (q?.isArchived) endpoint = `/me/mailFolders/archive/messages?${qs}`
      else endpoint = `/me/mailFolders/inbox/messages?${qs}`

      const data = await graphFetch(endpoint, this.accessToken)
      const messages: GraphMessage[] = data.value ?? []

      const byConversation = new Map<string, GraphMessage[]>()
      for (const m of messages) {
        const arr = byConversation.get(m.conversationId) ?? []
        arr.push(m)
        byConversation.set(m.conversationId, arr)
      }

      const threads: EmailThread[] = Array.from(byConversation.values()).map(msgs => {
        const last = msgs[msgs.length - 1]
        const mapped = msgs.map(m => mapMessage(m, this.accountId))
        return {
          id: last.conversationId,
          accountId: this.accountId,
          subject: last.subject ?? '(no subject)',
          participants: [...new Map(mapped.flatMap(m => [m.from, ...m.to]).map(a => [a.email, a])).values()],
          lastDate: new Date(last.receivedDateTime).toISOString(),
          snippet: last.bodyPreview,
          isRead: msgs.every(m => m.isRead),
          isStarred: msgs.some(m => m.flag?.flagStatus === 'flagged'),
          isArchived: false,
          labels: [...new Set(msgs.flatMap(m => m.categories ?? []))],
          messageCount: msgs.length,
          messages: mapped,
        }
      })

      return ok({ threads, nextPageToken: data['@odata.nextLink'] ? String(parseInt(params.pageToken ?? '0') + top) : undefined })
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async getThread(threadId: string) {
    try {
      // $orderby conflicts with $filter on /me/messages — sort client-side instead
      const data = await graphFetch(
        `/me/messages?$filter=conversationId eq '${threadId}'&$top=50`,
        this.accessToken
      )
      const messages: GraphMessage[] = (data.value ?? []).sort(
        (a: GraphMessage, b: GraphMessage) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime()
      )
      if (!messages.length) return err('NOT_FOUND', `Thread ${threadId} not found`)

      const mapped = messages.map(m => mapMessage(m, this.accountId))
      const last = mapped[mapped.length - 1]

      return ok({
        id: threadId,
        accountId: this.accountId,
        subject: last.subject,
        participants: [...new Map(mapped.flatMap(m => [m.from, ...m.to]).map(a => [a.email, a])).values()],
        lastDate: last.date,
        snippet: last.snippet,
        isRead: mapped.every(m => m.isRead),
        isStarred: mapped.some(m => m.isStarred),
        isArchived: false,
        labels: [...new Set(mapped.flatMap(m => m.labels))],
        messageCount: mapped.length,
        messages: mapped,
      } satisfies EmailThread)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async sendEmail(data: ComposeData) {
    try {
      const message = {
        subject: data.subject,
        body: { contentType: data.bodyHtml ? 'html' : 'text', content: data.bodyHtml ?? data.body },
        toRecipients: data.to.map(a => ({ emailAddress: { name: a.name ?? '', address: a.email } })),
      }
      const res = await graphFetch('/me/sendMail', this.accessToken, {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      return ok({ id: res?.id ?? 'sent' })
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async archiveThread(threadId: string) {
    try {
      const data = await graphFetch(`/me/messages?$filter=conversationId eq '${threadId}'`, this.accessToken)
      await Promise.all((data.value ?? []).map((m: GraphMessage) =>
        graphFetch(`/me/messages/${m.id}/move`, this.accessToken, {
          method: 'POST',
          body: JSON.stringify({ destinationId: 'archive' }),
        })
      ))
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async deleteThread(threadId: string) {
    try {
      const data = await graphFetch(`/me/messages?$filter=conversationId eq '${threadId}'`, this.accessToken)
      await Promise.all((data.value ?? []).map((m: GraphMessage) =>
        graphFetch(`/me/messages/${m.id}`, this.accessToken, { method: 'DELETE' })
      ))
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async markRead(threadId: string, read: boolean) {
    try {
      const data = await graphFetch(`/me/messages?$filter=conversationId eq '${threadId}'`, this.accessToken)
      await Promise.all((data.value ?? []).map((m: GraphMessage) =>
        graphFetch(`/me/messages/${m.id}`, this.accessToken, {
          method: 'PATCH',
          body: JSON.stringify({ isRead: read }),
        })
      ))
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async starThread(threadId: string, starred: boolean) {
    try {
      const data = await graphFetch(`/me/messages?$filter=conversationId eq '${threadId}'`, this.accessToken)
      await Promise.all((data.value ?? []).map((m: GraphMessage) =>
        graphFetch(`/me/messages/${m.id}`, this.accessToken, {
          method: 'PATCH',
          body: JSON.stringify({ flag: { flagStatus: starred ? 'flagged' : 'notFlagged' } }),
        })
      ))
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async addLabel(threadId: string, label: string) {
    try {
      const data = await graphFetch(`/me/messages?$filter=conversationId eq '${threadId}'`, this.accessToken)
      await Promise.all((data.value ?? []).map((m: GraphMessage) =>
        graphFetch(`/me/messages/${m.id}`, this.accessToken, {
          method: 'PATCH',
          body: JSON.stringify({ categories: [...(m.categories ?? []), label] }),
        })
      ))
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async removeLabel(threadId: string, label: string) {
    try {
      const data = await graphFetch(`/me/messages?$filter=conversationId eq '${threadId}'`, this.accessToken)
      await Promise.all((data.value ?? []).map((m: GraphMessage) =>
        graphFetch(`/me/messages/${m.id}`, this.accessToken, {
          method: 'PATCH',
          body: JSON.stringify({ categories: (m.categories ?? []).filter((c: string) => c !== label) }),
        })
      ))
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async search(query: SearchQuery) {
    try {
      const q = query.q ? `$search="${query.q}"` : ''
      const data = await graphFetch(`/me/messages?${q}&$top=50`, this.accessToken)
      const messages: GraphMessage[] = data.value ?? []
      const byConversation = new Map<string, GraphMessage[]>()
      for (const m of messages) {
        const arr = byConversation.get(m.conversationId) ?? []
        arr.push(m)
        byConversation.set(m.conversationId, arr)
      }
      const threads: EmailThread[] = Array.from(byConversation.values()).map(msgs => {
        const last = msgs[msgs.length - 1]
        const mapped = msgs.map(m => mapMessage(m, this.accountId))
        return {
          id: last.conversationId,
          accountId: this.accountId,
          subject: last.subject,
          participants: [...new Map(mapped.flatMap(m => [m.from, ...m.to]).map(a => [a.email, a])).values()],
          lastDate: new Date(last.receivedDateTime).toISOString(),
          snippet: last.bodyPreview,
          isRead: msgs.every(m => m.isRead),
          isStarred: msgs.some(m => m.flag?.flagStatus === 'flagged'),
          isArchived: false,
          labels: [],
          messageCount: msgs.length,
          messages: mapped,
        }
      })
      return ok(threads)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async getLabels() {
    return ok(['inbox', 'sent', 'drafts', 'deleted', 'archive'])
  }
}
