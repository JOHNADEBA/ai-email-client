export type EmailProvider = 'gmail' | 'office365' | 'imap' | 'demo'

export interface EmailAccount {
  id: string
  provider: EmailProvider
  email: string
  name: string
  avatar?: string
  accessToken?: string
  refreshToken?: string
  imapConfig?: ImapConfig
}

export interface ImapConfig {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
}

export interface EmailAddress {
  name?: string
  email: string
}

export interface EmailAttachment {
  id: string
  filename: string
  mimeType: string
  size: number
  url?: string
}

export interface Email {
  id: string
  accountId: string
  threadId: string
  subject: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  date: string
  snippet: string
  body: string
  bodyHtml?: string
  isRead: boolean
  isStarred: boolean
  isArchived: boolean
  labels: string[]
  attachments: EmailAttachment[]
  aiSummary?: string
  aiPriority?: number
  aiCategory?: AiCategory
  replyDraft?: string
}

export interface EmailThread {
  id: string
  accountId: string
  subject: string
  participants: EmailAddress[]
  lastDate: string
  snippet: string
  isRead: boolean
  isStarred: boolean
  isArchived: boolean
  labels: string[]
  messageCount: number
  messages: Email[]
  aiSummary?: string
  aiPriority?: number
  aiCategory?: AiCategory
}

export type AiCategory = 'work' | 'personal' | 'newsletter' | 'action_required' | 'finance' | 'social'

export interface SearchQuery {
  q?: string
  labels?: string[]
  from?: string
  to?: string
  after?: string
  before?: string
  hasAttachment?: boolean
  isUnread?: boolean
  isStarred?: boolean
  isArchived?: boolean
  account?: string
}

export interface ComposeData {
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  subject: string
  body: string
  replyToId?: string
  forwardFromId?: string
  accountId: string
}

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export interface EmailError {
  code: 'AUTH_FAILED' | 'NETWORK_ERROR' | 'NOT_FOUND' | 'QUOTA_EXCEEDED' | 'UNKNOWN'
  message: string
}

export interface EmailAdapter {
  listThreads(params: {
    maxResults?: number
    pageToken?: string
    query?: SearchQuery
  }): Promise<Result<{ threads: EmailThread[]; nextPageToken?: string }, EmailError>>

  getThread(threadId: string): Promise<Result<EmailThread, EmailError>>

  sendEmail(data: ComposeData): Promise<Result<{ id: string }, EmailError>>

  archiveThread(threadId: string): Promise<Result<void, EmailError>>

  deleteThread(threadId: string): Promise<Result<void, EmailError>>

  markRead(threadId: string, read: boolean): Promise<Result<void, EmailError>>

  starThread(threadId: string, starred: boolean): Promise<Result<void, EmailError>>

  addLabel(threadId: string, label: string): Promise<Result<void, EmailError>>

  removeLabel(threadId: string, label: string): Promise<Result<void, EmailError>>

  search(query: SearchQuery): Promise<Result<EmailThread[], EmailError>>

  getLabels(): Promise<Result<string[], EmailError>>
}
