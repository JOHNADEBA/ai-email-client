import { NextRequest, NextResponse } from 'next/server'
import { addAccountToSession } from '@/lib/auth/session'
import type { EmailAccount } from '@/types/email'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = request.cookies.get('oauth_state')?.value
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent(err)}`)
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
  }

  // Fetch user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const user = await userRes.json() as { email: string; name: string; picture?: string; id: string }

  const account: EmailAccount = {
    id: `gmail-${user.id}`,
    provider: 'gmail',
    email: user.email,
    name: user.name,
    avatar: user.picture,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  }

  await addAccountToSession(account)

  const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/inbox`)
  response.cookies.delete('oauth_state')
  return response
}
