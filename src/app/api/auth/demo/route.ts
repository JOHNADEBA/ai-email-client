import { NextResponse } from 'next/server'

export async function GET() {
  const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/inbox`)
  response.cookies.set('demo_override', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })
  return response
}
