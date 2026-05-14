import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { addAccountToSession } from '@/lib/auth/session'
import type { EmailAccount, ImapConfig } from '@/types/email'

export const maxDuration = 30 // seconds — override Vercel's 10s default

const KNOWN_HOSTS: Record<string, Omit<ImapConfig, 'username' | 'password'>> = {
  'yahoo.com': { host: 'imap.mail.yahoo.com', port: 993, secure: true },
  'ymail.com': { host: 'imap.mail.yahoo.com', port: 993, secure: true },
  'aol.com': { host: 'imap.aol.com', port: 993, secure: true },
  'outlook.com': { host: 'imap-mail.outlook.com', port: 993, secure: true },
  'hotmail.com': { host: 'imap-mail.outlook.com', port: 993, secure: true },
  'icloud.com': { host: 'imap.mail.me.com', port: 993, secure: true },
  'me.com': { host: 'imap.mail.me.com', port: 993, secure: true },
  'gmx.com': { host: 'imap.gmx.com', port: 993, secure: true },
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    email: string
    password: string
    host?: string
    port?: number
    secure?: boolean
  }

  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const domain = email.split('@')[1]?.toLowerCase()
  const knownHost = domain ? KNOWN_HOSTS[domain] : undefined

  const imapConfig: ImapConfig = {
    host: body.host ?? knownHost?.host ?? `imap.${domain}`,
    port: body.port ?? knownHost?.port ?? 993,
    secure: body.secure ?? knownHost?.secure ?? true,
    username: email,
    password,
  }

  // Test the connection
  try {
    const client = new ImapFlow({
      host: imapConfig.host,
      port: imapConfig.port,
      secure: imapConfig.secure,
      auth: { user: imapConfig.username, pass: imapConfig.password },
      logger: false,
      connectionTimeout: 20000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    })
    await client.connect()
    const mailboxes = await client.list()
    await client.logout()
    void mailboxes
  } catch (e) {
    const msg = String(e)
    const isYahoo = ['yahoo.com', 'ymail.com'].includes(domain ?? '')
    const isAol = domain === 'aol.com'
    if (isYahoo) {
      return NextResponse.json({
        error: 'Yahoo requires an App Password, not your regular password. Go to Yahoo Account Security → Generate app password → select "Other app" → use that password here.',
      }, { status: 400 })
    }
    if (isAol) {
      return NextResponse.json({
        error: 'AOL requires an App Password. Go to AOL Account Security → Generate app password → use that password here.',
      }, { status: 400 })
    }
    return NextResponse.json({ error: `Connection failed: ${msg}` }, { status: 400 })
  }

  const account: EmailAccount = {
    id: `imap-${email.replace('@', '-at-')}`,
    provider: 'imap',
    email,
    name: email.split('@')[0],
    imapConfig,
  }

  await addAccountToSession(account)
  return NextResponse.json({ ok: true })
}
