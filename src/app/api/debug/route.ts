import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: 'No session found' }, { status: 401 })
  }

  const results = await Promise.all(
    session.accounts.map(async (account) => {
      const base = {
        id: account.id,
        provider: account.provider,
        email: account.email,
        hasAccessToken: !!account.accessToken,
        hasRefreshToken: !!account.refreshToken,
      }

      if (account.provider === 'gmail' && account.accessToken) {
        try {
          const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
            headers: { Authorization: `Bearer ${account.accessToken}` },
          })
          const body = await res.text()
          if (res.ok) {
            const data = JSON.parse(body) as { emailAddress: string; messagesTotal: number }
            return { ...base, gmailTest: 'OK', gmailEmail: data.emailAddress, messagesTotal: data.messagesTotal }
          } else {
            return { ...base, gmailTest: 'FAIL', gmailError: body }
          }
        } catch (e) {
          return { ...base, gmailTest: 'ERROR', gmailError: String(e) }
        }
      }

      return base
    })
  )

  return NextResponse.json({
    userId: session.userId,
    accountCount: session.accounts.length,
    accounts: results,
  })
}
