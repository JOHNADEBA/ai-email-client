import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < 604_800_000) {
    return d.toLocaleDateString([], { weekday: 'short' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '…'
}

export function priorityColor(score: number): string {
  if (score >= 9) return 'text-red-600 bg-red-50'
  if (score >= 7) return 'text-orange-600 bg-orange-50'
  if (score >= 4) return 'text-blue-600 bg-blue-50'
  return 'text-gray-500 bg-gray-50'
}

export function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    work: '💼',
    personal: '👤',
    newsletter: '📰',
    action_required: '⚡',
    finance: '💰',
    social: '💬',
  }
  return map[category] ?? '📧'
}

export function providerIcon(provider: string): string {
  const map: Record<string, string> = {
    gmail: 'G',
    office365: 'O',
    imap: 'I',
    demo: 'D',
  }
  return map[provider] ?? '?'
}

export function providerColor(provider: string): string {
  const map: Record<string, string> = {
    gmail: 'bg-red-500',
    office365: 'bg-blue-600',
    imap: 'bg-purple-500',
    demo: 'bg-green-500',
  }
  return map[provider] ?? 'bg-gray-500'
}
