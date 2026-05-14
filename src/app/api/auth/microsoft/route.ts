import { NextResponse } from 'next/server'

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
].join(' ')

export async function GET() {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Microsoft OAuth not configured' }, { status: 501 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`
  const state = crypto.randomUUID()

  const url = new URL('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('response_mode', 'query')
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'select_account')

  const response = NextResponse.redirect(url.toString())
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
