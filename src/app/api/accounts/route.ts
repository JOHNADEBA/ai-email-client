import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSession, type SessionData } from '@/lib/auth/session'

function getSessionOptions() {
  const password = process.env.SESSION_SECRET ?? 'fallback-secret-please-set-session-secret!!'
  return {
    password: password.length >= 32 ? password : password.padEnd(32, '!'),
    cookieName: 'ai-email-session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    },
  }
}

export async function GET(request: NextRequest) {
  const checkReal = new URL(request.url).searchParams.get('real') === '1'

  if (checkReal) {
    // Bypass demo fallback — check iron-session directly
    const cookieStore = await cookies()
    const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
    return NextResponse.json({ hasRealAccounts: !!(session.userId && session.accounts?.length) })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // isDemo is true whenever the session is backed by demo data — either via
  // the demo_override cookie or the NEXT_PUBLIC_DEMO_MODE env-var fallback.
  const isDemo = session.userId === 'demo-user'
  return NextResponse.json({ accounts: session.accounts, isDemo })
}
