import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import type { EmailAccount } from '@/types/email'
import { DEMO_ACCOUNTS } from '@/lib/demo/mock-data'

export interface SessionData {
  userId: string
  accounts: EmailAccount[]
}

// Backwards-compat alias
export type Session = SessionData

function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET ?? 'fallback-secret-please-set-session-secret!!'
  return {
    password: password.length >= 32 ? password : password.padEnd(32, '!'),
    cookieName: 'ai-email-session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    },
  }
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()

  // demo_override cookie: user explicitly clicked "Continue with Demo"
  if (cookieStore.get('demo_override')?.value === 'true') {
    return { userId: 'demo-user', accounts: DEMO_ACCOUNTS }
  }

  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())

  // Real session (OAuth or IMAP) takes priority over demo mode
  if (session.userId) {
    return { userId: session.userId, accounts: session.accounts ?? [] }
  }

  // No real session — fall back to demo if demo mode is enabled
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return { userId: 'demo-user', accounts: DEMO_ACCOUNTS }
  }

  return null
}

export async function saveSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  session.userId = data.userId
  session.accounts = data.accounts
  await session.save()
}

/** Backwards-compat alias for saveSession */
export const setSession = saveSession

export async function addAccountToSession(account: EmailAccount): Promise<void> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  if (!session.userId) {
    session.userId = `user-${Date.now()}`
    session.accounts = []
  }
  const existing = session.accounts ?? []
  const idx = existing.findIndex(a => a.id === account.id)
  if (idx >= 0) existing[idx] = account
  else existing.push(account)
  session.accounts = existing
  await session.save()
}

export async function updateAccountInSession(accountId: string, patch: Partial<EmailAccount>): Promise<void> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  session.accounts = (session.accounts ?? []).map(a => a.id === accountId ? { ...a, ...patch } : a)
  await session.save()
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  session.destroy()
  cookieStore.delete('demo_override')
}
