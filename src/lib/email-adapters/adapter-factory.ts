import type { EmailAccount } from '@/types/email'
import type { EmailAdapter } from '@/types/email'
import { DemoAdapter } from './demo-adapter'
import { GmailAdapter } from './gmail-adapter'
import { Office365Adapter } from './office365-adapter'
import { ImapAdapter } from './imap-adapter'

export function getAdapter(account: EmailAccount): EmailAdapter {
  if (account.provider === 'demo') {
    return new DemoAdapter(account.id)
  }

  switch (account.provider) {
    case 'gmail': {
      if (!account.accessToken) throw new Error('Gmail account missing access token')
      return new GmailAdapter(account.id, account.accessToken)
    }
    case 'office365': {
      if (!account.accessToken) throw new Error('Office 365 account missing access token')
      return new Office365Adapter(account.id, account.accessToken)
    }
    case 'imap': {
      if (!account.imapConfig) throw new Error('IMAP account missing configuration')
      return new ImapAdapter(account.id, account.imapConfig)
    }
    default:
      throw new Error(`Unknown provider: ${account.provider}`)
  }
}

export async function refreshTokenIfNeeded(account: EmailAccount): Promise<EmailAccount> {
  if (!account.refreshToken) return account

  // Refresh Google tokens
  if (account.provider === 'gmail') {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: account.refreshToken,
          grant_type: 'refresh_token',
        }),
      })
      if (res.ok) {
        const data = await res.json() as { access_token: string }
        return { ...account, accessToken: data.access_token }
      }
    } catch {
      // Return original, let the adapter fail with proper error
    }
  }

  // Refresh Microsoft tokens
  if (account.provider === 'office365') {
    try {
      const res = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          refresh_token: account.refreshToken,
          grant_type: 'refresh_token',
        }),
      })
      if (res.ok) {
        const data = await res.json() as { access_token: string; refresh_token?: string }
        return { ...account, accessToken: data.access_token, refreshToken: data.refresh_token ?? account.refreshToken }
      }
    } catch {
      // Return original
    }
  }

  return account
}
