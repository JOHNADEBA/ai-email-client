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

  private findBodyParts(struct: Record<string, unknown>): {
    textPart?: { id: string; encoding: string }
    htmlPart?: { id: string; encoding: string }
  } {
    const type = String(struct.type ?? '').toLowerCase()
    if (type === 'multipart') {
      const children = (struct.childNodes as Record<string, unknown>[]) ?? []
      let textPart: { id: string; encoding: string } | undefined
      let htmlPart: { id: string; encoding: string } | undefined
      for (const child of children) {
        const found = this.findBodyParts(child as Record<string, unknown>)
        if (!textPart && found.textPart) textPart = found.textPart
        if (!htmlPart && found.htmlPart) htmlPart = found.htmlPart
      }
      return { textPart, htmlPart }
    }
    const subtype = String(struct.subtype ?? '').toLowerCase()
    const id = String(struct.part ?? '')
    const encoding = String(struct.encoding ?? '').toLowerCase()
    if (type === 'text' && subtype === 'plain') return { textPart: { id, encoding } }
    if (type === 'text' && subtype === 'html') return { htmlPart: { id, encoding } }
    return {}
  }

  private decodeBody(raw: string, encoding: string): string {
    if (encoding === 'base64') {
      try { return Buffer.from(raw.replace(/\s/g, ''), 'base64').toString('utf-8') } catch { return raw }
    }
    if (encoding === 'quoted-printable') return decodeQuotedPrintable(raw)
    return raw
  }

  private buildEmail(
    uid: number,
    envelope: Record<string, unknown>,
    flags: Set<string>,
    text: string,
    html: string,
  ): Email {
    const from = (envelope.from as Array<{ name?: string; address?: string }>) ?? []
    const to = (envelope.to as Array<{ name?: string; address?: string }>) ?? []
    const cc = (envelope.cc as Array<{ name?: string; address?: string }>) ?? []
    const mapAddr = (a: { name?: string; address?: string }): EmailAddress => ({
      name: a.name || undefined, email: a.address ?? '',
    })
    const bodyText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '')
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
      bodyHtml: html || undefined,
      isRead: flags.has('\\Seen'),
      isStarred: flags.has('\\Flagged'),
      isArchived: false,
      labels: [],
      attachments: [],
    }
  }

  private async fetchMessages(client: ImapFlow, uidRange: string): Promise<Email[]> {
    if (!uidRange) return []

    // Pass 1: envelope + flags + bodyStructure (no body content yet)
    type MsgMeta = {
      uid: number; envelope: Record<string, unknown>; flags: Set<string>
      textPartId?: string; textEncoding?: string
      htmlPartId?: string; htmlEncoding?: string
    }
    const metas: MsgMeta[] = []
    for await (const msg of client.fetch(uidRange, { envelope: true, flags: true, bodyStructure: true, uid: true }, { uid: true })) {
      const struct = msg.bodyStructure as Record<string, unknown> | undefined
      const parts = struct ? this.findBodyParts(struct) : { textPart: { id: '1', encoding: '7bit' } }
      metas.push({
        uid: msg.uid,
        envelope: msg.envelope as Record<string, unknown>,
        flags: msg.flags as Set<string>,
        textPartId: parts.textPart?.id,
        textEncoding: parts.textPart?.encoding,
        htmlPartId: parts.htmlPart?.id,
        htmlEncoding: parts.htmlPart?.encoding,
      })
    }

    if (!metas.length) return []

    // Pass 2: group by required parts, batch-fetch body content per group
    const partGroups = new Map<string, number[]>()
    for (const m of metas) {
      const key = [m.textPartId, m.htmlPartId].filter(Boolean).sort().join(',') || '1'
      const arr = partGroups.get(key) ?? []
      arr.push(m.uid)
      partGroups.set(key, arr)
    }

    const bodyByUid = new Map<number, { text: string; html: string }>()
    for (const [partsKey, groupUids] of partGroups) {
      const parts = partsKey.split(',').filter(Boolean)
      try {
        for await (const msg of client.fetch(groupUids.join(','), { bodyParts: parts, uid: true }, { uid: true })) {
          const bp = msg.bodyParts as Map<string, Buffer> | undefined
          const meta = metas.find(m => m.uid === msg.uid)!
          const getRaw = (id?: string) => id ? (bp?.get(id)?.toString('latin1') ?? '') : ''
          bodyByUid.set(msg.uid, {
            text: this.decodeBody(getRaw(meta.textPartId), meta.textEncoding ?? ''),
            html: this.decodeBody(getRaw(meta.htmlPartId), meta.htmlEncoding ?? ''),
          })
        }
      } catch { /* body unavailable for this group */ }
    }

    return metas.map(m => {
      const body = bodyByUid.get(m.uid) ?? { text: '', html: '' }
      return this.buildEmail(m.uid, m.envelope, m.flags, body.text, body.html)
    })
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

        const messages = await this.fetchMessages(client, recentUids.join(','))

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
        const messages = await this.fetchMessages(client, uids.join(','))
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
        const messages = uids.length ? await this.fetchMessages(client, uids.slice(-50).join(',')) : []
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
