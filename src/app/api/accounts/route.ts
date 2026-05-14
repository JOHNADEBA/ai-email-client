import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cookieStore = await cookies()
  const isDemo = cookieStore.get('demo_override')?.value === 'true'
  return NextResponse.json({ accounts: session.accounts, isDemo })
}
