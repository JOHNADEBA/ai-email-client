import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from '@/lib/auth/session'

const PUBLIC_PATHS = ['/login', '/api/auth']
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Demo mode: always allow
  if (DEMO_MODE) return NextResponse.next()

  // Check session
  const res = NextResponse.next()
  const session = await getIronSession<SessionData>(request, res, getSessionOptions())

  if (!session.userId) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
