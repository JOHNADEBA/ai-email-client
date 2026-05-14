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

  const clientId = process.env.MICROSOFT_CLIENT_ID!
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
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

    const tokenBody = await tokenRes.text()
    if (!tokenRes.ok) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent(tokenBody)}`)
    }

    const tokens = JSON.parse(tokenBody) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }

    // Fetch user profile
    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userRes.ok) {
      const graphErr = await userRes.text()
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent('Graph API error: ' + graphErr)}`)
    }

    const user = await userRes.json() as { id: string; displayName: string; mail?: string; userPrincipalName: string }
    const email = user.mail ?? user.userPrincipalName

    const account: EmailAccount = {
      id: `office365-${user.id}`,
      provider: 'office365',
      email,
      name: user.displayName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    }

    await addAccountToSession(account)

    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/inbox`)
    response.cookies.delete('oauth_state')
    return response
  } catch (e) {
    console.error('[microsoft/callback] error:', e)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent(String(e))}`)
  }
}
