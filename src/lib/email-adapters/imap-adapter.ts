import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import type {
  EmailAdapter, EmailThread, Email, ComposeData,
  SearchQuery, Result, EmailError, EmailAddress, ImapConfig,
} from '@/types/email'

function ok<T>(value: T): Result<T, EmailError> { return { ok: true, value } }
function err(code: EmailError['code'], message: string): Result<never, EmailError> {
  return { ok: false, error: { code, message } }
}

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function parseAddress(raw: string): EmailAddress {
  const m = raw.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/)
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim() || raw }
  return { email: raw.trim() }
}

function parseAddressList(raw: string): EmailAddress[] {
  if (!raw) return []
  return raw.split(',').map(s => parseAddress(s.trim()))
}

function smtpConfig(imapConfig: ImapConfig) {
  // Derive SMTP host from IMAP host
  const host = imapConfig.host.replace(/^imap\./, 'smtp.')
  return {
    host,
    port: 587,
    secure: false,
    auth: { user: imapConfig.username, pass: imapConfig.password },
    requireTLS: true,
  }
}

async function withImap<T>(
  config: ImapConfig,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: config.password },
    logger: false,
  })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.logout().catch(() => {})
  }
}

export class ImapAdapter implements EmailAdapter {
  private config: ImapConfig
  private accountId: string

  constructor(accountId: string, config: ImapConfig) {
    this.accountId = accountId
    this.config = config
  }

  private parseImapMessage(msg: Record<string, unknown>, uid: number): Email {
    const envelope = msg.envelope as Record<string, unknown> ?? {}
    const flags = (msg.flags as Set<string>) ?? new Set()
    const bodyParts = msg.bodyParts as Map<string, Buffer> | undefined
    const getRaw = (key: string) => bodyParts?.get(key)?.toString('latin1') ?? ''
    const candidates = ['1', '2', '1.1', '1.2'].map(k => decodeQuotedPrintable(getRaw(k)))
    const htmlPart = candidates.find(p => /<html|<div|<table|<!DOCTYPE/i.test(p)) ?? ''
    const textPart = candidates.find(p => p.length > 0 && !/<html|<div|<table|<!DOCTYPE/i.test(p)) ?? ''
    const bodyText = textPart || (htmlPart ? htmlPart.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '')

    const from = envelope.from as Array<{ name?: string; address?: string }> ?? []
    const to = envelope.to as Array<{ name?: string; address?: string }> ?? []
    const cc = envelope.cc as Array<{ name?: string; address?: string }> ?? []

    const mapAddr = (a: { name?: string; address?: string }): EmailAddress => ({
      name: a.name || undefined,
      email: a.address ?? '',
    })

    return {
      id: String(uid),
      accountId: this.accountId,
      threadId: String(envelope.inReplyTo ?? uid),
      subject: String(envelope.subject ?? ''),
      from: from[0] ? mapAddr(from[0]) : { email: '' },
      to: to.map(mapAddr),
      cc: cc.length ? cc.map(mapAddr) : undefined,
      date: envelope.date ? new Date(envelope.date as string).toISOString() : new Date().toISOString(),
      snippet: bodyText.slice(0, 200).replace(/\s+/g, ' '),
      body: bodyText,
      bodyHtml: htmlPart || undefined,
      isRead: !flags.has('\\Seen') === false || flags.has('\\Seen'),
      isStarred: flags.has('\\Flagged'),
      isArchived: false,
      labels: [],
      attachments: [],
    }
  }

  async listThreads(params: { maxResults?: number; pageToken?: string; query?: SearchQuery }) {
    try {
      const max = params.maxResults ?? 20
      const threads = await withImap(this.config, async (client) => {
        await client.mailboxOpen('INBOX')
        const criteria = this.buildSearchCriteria(params.query)
        const rawUids = await client.search(criteria, { uid: true })
        const uids: number[] = Array.isArray(rawUids) ? rawUids : []
        const recentUids = uids.slice(-max * 2).reverse()

        const messages: Email[] = []
        for await (const msg of client.fetch(recentUids.join(','), {
          envelope: true,
          flags: true,
          bodyParts: ['1', '2', '1.1', '1.2'],
          uid: true,
        }, { uid: true })) {
          messages.push(this.parseImapMessage(msg as unknown as Record<string, unknown>, msg.uid))
        }

        // Group by subject for basic threading
        const bySubject = new Map<string, Email[]>()
        for (const m of messages) {
          const key = m.subject.replace(/^(Re|Fwd?):\s*/i, '').trim().toLowerCase()
          const arr = bySubject.get(key) ?? []
          arr.push(m)
          bySubject.set(key, arr)
        }

        let result = Array.from(bySubject.values()).map(msgs => this.buildThread(msgs))

        // Client-side AI category filtering (IMAP has no native category search)
        if (params.query?.labels?.length) {
          result = result.filter(t =>
            params.query!.labels!.some(label => this.matchesCategory(t, label))
          )
        }

        return result.slice(0, max)
      })

      return ok({ threads })
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async getThread(threadId: string) {
    try {
      const thread = await withImap(this.config, async (client) => {
        await client.mailboxOpen('INBOX')
        const rawUids = await client.search({ uid: threadId }, { uid: true })
        const uids: number[] = Array.isArray(rawUids) ? rawUids : []
        if (!uids.length) return null
        const messages: Email[] = []
        for await (const msg of client.fetch(uids.join(','), {
          envelope: true,
          flags: true,
          bodyParts: ['1', '2', '1.1', '1.2'],
          uid: true,
        }, { uid: true })) {
          messages.push(this.parseImapMessage(msg as unknown as Record<string, unknown>, msg.uid))
        }
        return messages.length ? this.buildThread(messages) : null
      })

      if (!thread) return err('NOT_FOUND', `Thread ${threadId} not found`)
      return ok(thread)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  private buildThread(messages: Email[]): EmailThread {
    const last = messages[messages.length - 1]
    const allParticipants = new Map<string, EmailAddress>()
    for (const m of messages) {
      allParticipants.set(m.from.email, m.from)
      for (const a of m.to) allParticipants.set(a.email, a)
    }
    return {
      id: last.id,
      accountId: this.accountId,
      subject: last.subject,
      participants: Array.from(allParticipants.values()),
      lastDate: last.date,
      snippet: last.snippet,
      isRead: messages.every(m => m.isRead),
      isStarred: messages.some(m => m.isStarred),
      isArchived: false,
      labels: [],
      messageCount: messages.length,
      messages,
    }
  }

  async sendEmail(data: ComposeData) {
    try {
      const transporter = nodemailer.createTransport(smtpConfig(this.config))
      const info = await transporter.sendMail({
        from: this.config.username,
        to: data.to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', '),
        cc: data.cc?.map(a => a.email).join(', '),
        subject: data.subject,
        text: data.body,
        ...(data.bodyHtml ? { html: data.bodyHtml } : {}),
      })
      return ok({ id: info.messageId })
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async archiveThread(threadId: string) {
    try {
      await withImap(this.config, async (client) => {
        await client.mailboxOpen('INBOX')
        const mailboxes = await client.list()
        const archiveBox = mailboxes.find(m =>
          /archive|all mail/i.test(m.name) || m.specialUse === '\\Archive'
        )
        if (archiveBox) {
          await client.messageMove(threadId, archiveBox.path, { uid: true })
        } else {
          // If no archive folder, just remove from INBOX by adding \\Deleted
          await client.messageFlagsAdd(threadId, ['\\Seen'], { uid: true })
        }
      })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async deleteThread(threadId: string) {
    try {
      await withImap(this.config, async (client) => {
        await client.mailboxOpen('INBOX')
        await client.messageDelete(threadId, { uid: true })
      })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async markRead(threadId: string, read: boolean) {
    try {
      await withImap(this.config, async (client) => {
        await client.mailboxOpen('INBOX')
        if (read) {
          await client.messageFlagsAdd(threadId, ['\\Seen'], { uid: true })
        } else {
          await client.messageFlagsRemove(threadId, ['\\Seen'], { uid: true })
        }
      })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async starThread(threadId: string, starred: boolean) {
    try {
      await withImap(this.config, async (client) => {
        await client.mailboxOpen('INBOX')
        if (starred) {
          await client.messageFlagsAdd(threadId, ['\\Flagged'], { uid: true })
        } else {
          await client.messageFlagsRemove(threadId, ['\\Flagged'], { uid: true })
        }
      })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async addLabel(threadId: string, label: string) {
    // IMAP uses folders, not labels — move to folder named after label
    try {
      await withImap(this.config, async (client) => {
        await client.mailboxOpen('INBOX')
        await client.messageCopy(threadId, label, { uid: true })
      })
      return ok(undefined)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async removeLabel(_threadId: string, _label: string) {
    return ok(undefined)
  }

  async search(query: SearchQuery) {
    try {
      const threads = await withImap(this.config, async (client) => {
        await client.mailboxOpen('INBOX')
        const criteria = this.buildSearchCriteria(query)
        const rawSearch = await client.search(criteria, { uid: true })
        const uids: number[] = Array.isArray(rawSearch) ? rawSearch : []
        const messages: Email[] = []
        if (uids.length) {
          for await (const msg of client.fetch(uids.slice(-50).join(','), {
            envelope: true,
            flags: true,
            bodyParts: ['1', '2', '1.1', '1.2'],
            uid: true,
          }, { uid: true })) {
            messages.push(this.parseImapMessage(msg as unknown as Record<string, unknown>, msg.uid))
          }
        }
        const bySubject = new Map<string, Email[]>()
        for (const m of messages) {
          const key = m.subject.replace(/^(Re|Fwd?):\s*/i, '').trim().toLowerCase()
          const arr = bySubject.get(key) ?? []
          arr.push(m)
          bySubject.set(key, arr)
        }
        return Array.from(bySubject.values()).map(msgs => this.buildThread(msgs))
      })
      return ok(threads)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  async getLabels() {
    try {
      const labels = await withImap(this.config, async (client) => {
        const boxes = await client.list()
        return boxes.map(b => b.name.toLowerCase())
      })
      return ok(labels)
    } catch (e) {
      return err('NETWORK_ERROR', String(e))
    }
  }

  private buildSearchCriteria(query?: SearchQuery): Record<string, unknown> {
    const criteria: Record<string, unknown> = {}
    if (!query) return { all: true }
    if (query.q) criteria.body = query.q
    if (query.isUnread) criteria.unseen = true
    if (query.isStarred) criteria.flagged = true
    return Object.keys(criteria).length ? criteria : { all: true }
  }

  private matchesCategory(thread: EmailThread, label: string): boolean {
    const text = (thread.subject + ' ' + thread.snippet).toLowerCase()
    switch (label) {
      case 'newsletter':
        return /unsubscribe|newsletter|digest|weekly|monthly|subscription/.test(text)
      case 'finance':
        return /invoice|receipt|payment|statement|billing|bank|order|transaction/.test(text)
      case 'social':
        return /twitter|facebook|instagram|linkedin|notification|friend request|follow/.test(text)
      case 'action_required':
        return /urgent|action required|deadline|please respond|response needed|asap|due/.test(text)
      case 'work':
        return /meeting|project|deadline|report|team|client|proposal|contract/.test(text)
      case 'personal':
        return !/unsubscribe|invoice|meeting|project|urgent|newsletter/.test(text)
      default:
        return false
    }
  }
}
