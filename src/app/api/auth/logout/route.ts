import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth/session'

export async function POST() {
  await clearSession()
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)
}
