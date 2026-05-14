'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, Minimize2, Maximize2, Send, Sparkles } from 'lucide-react'
import type { EmailAccount, EmailThread } from '@/types/email'
import { cn } from '@/lib/utils'

interface ComposeProps {
  account: EmailAccount
  allAccounts: EmailAccount[]
  replyTo?: EmailThread
  forwardFrom?: EmailThread
  onClose: () => void
  onSent: () => void
}

function buildForwardBody(thread: EmailThread): { text: string; html: string | undefined } {
  const last = thread.messages[thread.messages.length - 1]
  if (!last) return { text: '', html: undefined }

  const header = [
    '---------- Forwarded message ----------',
    `From: ${last.from.name ? `${last.from.name} <${last.from.email}>` : last.from.email}`,
    `Date: ${new Date(last.date).toLocaleString()}`,
    `Subject: ${last.subject}`,
    `To: ${last.to.map(a => a.name ? `${a.name} <${a.email}>` : a.email).join(', ')}`,
  ].join('\n')

  const text = `\n${header}\n\n${last.body}`

  const html = last.bodyHtml
    ? `<br><div style="border-left:2px solid #ccc;padding-left:12px;margin-top:12px;color:#555">
        <p style="font-size:12px;color:#888">${header.replace(/\n/g, '<br>')}</p>
        ${last.bodyHtml}
      </div>`
    : undefined

  return { text, html }
}

export function Compose({ account, allAccounts, replyTo, forwardFrom, onClose, onSent }: ComposeProps) {
  const thread = replyTo ?? forwardFrom

  const [from, setFrom] = useState(account.id)
  const [to, setTo] = useState(
    replyTo ? (replyTo.messages[replyTo.messages.length - 1]?.from.email ?? '') : ''
  )
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(() => {
    if (replyTo) return `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}`
    if (forwardFrom) return `Fwd: ${forwardFrom.subject.replace(/^Fwd?:\s*/i, '')}`
    return ''
  })
  const forwardContent = forwardFrom ? buildForwardBody(forwardFrom) : null
  const [body, setBody] = useState(() => forwardContent?.text ?? '')
  const [forwardBodyHtml] = useState(() => forwardContent?.html)
  const [showCc, setShowCc] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [sending, setSending] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [error, setError] = useState('')

  const title = forwardFrom ? 'Forward' : replyTo ? 'Reply' : 'New Message'

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('Please fill in To, Subject, and Message fields.')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: from,
          to: to.split(',').map(e => ({ email: e.trim() })),
          cc: cc ? cc.split(',').map(e => ({ email: e.trim() })) : [],
          subject,
          body,
          ...(forwardBodyHtml ? { bodyHtml: `<p>${body.split('\n')[0] || ''}</p>${forwardBodyHtml}` } : {}),
          replyToId: replyTo?.id,
          forwardFromId: forwardFrom?.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error || 'Send failed')
      }
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  async function generateDraft() {
    if (!replyTo) return
    setLoadingDraft(true)
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread: replyTo }),
      })
      const data = await res.json() as { draft: string }
      setBody(data.draft)
    } catch {
      // ignore
    } finally {
      setLoadingDraft(false)
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (minimized) {
    return (
      <div className="fixed bottom-0 right-4 w-72 bg-blue-700 text-white rounded-t-xl overflow-hidden shadow-2xl z-50">
        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-800 transition-colors"
          onClick={() => setMinimized(false)}
        >
          <span className="font-medium text-sm truncate">{subject || 'New Message'}</span>
          <div className="flex gap-1">
            <Maximize2 className="w-4 h-4" />
            <button onClick={e => { e.stopPropagation(); onClose() }}><X className="w-4 h-4" /></button>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 right-4 w-[560px] max-w-[calc(100vw-2rem)] bg-white rounded-t-xl shadow-2xl z-50 flex flex-col border border-gray-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white rounded-t-xl">
        <span className="font-medium text-sm">{title}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setMinimized(true)} title="Minimize">
            <Minimize2 className="w-4 h-4 hover:opacity-70" />
          </button>
          <button onClick={onClose} title="Close">
            <X className="w-4 h-4 hover:opacity-70" />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="border-b border-gray-200">
        {/* From */}
        <div className="flex items-center px-4 py-2 border-b border-gray-100">
          <span className="text-xs text-gray-400 w-12">From</span>
          <select
            className="flex-1 text-sm text-gray-800 bg-transparent outline-none"
            value={from}
            onChange={e => setFrom(e.target.value)}
          >
            {allAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} &lt;{a.email}&gt;</option>
            ))}
          </select>
        </div>

        {/* To */}
        <div className="flex items-center px-4 py-2 border-b border-gray-100">
          <span className="text-xs text-gray-400 w-12">To</span>
          <input
            className="flex-1 text-sm text-gray-800 outline-none placeholder:text-gray-400"
            placeholder="Recipients"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
          <button
            className="text-xs text-blue-600 hover:text-blue-800 ml-2"
            onClick={() => setShowCc(!showCc)}
          >
            {showCc ? 'Hide Cc' : 'Cc'}
          </button>
        </div>

        {/* Cc */}
        {showCc && (
          <div className="flex items-center px-4 py-2 border-b border-gray-100">
            <span className="text-xs text-gray-400 w-12">Cc</span>
            <input
              className="flex-1 text-sm text-gray-800 outline-none placeholder:text-gray-400"
              placeholder="Cc recipients"
              value={cc}
              onChange={e => setCc(e.target.value)}
            />
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center px-4 py-2">
          <span className="text-xs text-gray-400 w-12">Subject</span>
          <input
            className="flex-1 text-sm text-gray-800 outline-none placeholder:text-gray-400"
            placeholder="Subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>
      </div>

      {/* Body */}
      <div className="relative">
        {replyTo && (
          <button
            onClick={generateDraft}
            disabled={loadingDraft}
            className="absolute top-2 right-3 flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg transition-colors z-10"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {loadingDraft ? 'Generating…' : 'AI Draft'}
          </button>
        )}
        <textarea
          className="w-full px-4 py-3 text-sm text-gray-800 outline-none resize-none min-h-[200px] placeholder:text-gray-400"
          placeholder="Write your message…"
          value={body}
          onChange={e => setBody(e.target.value)}
        />
      </div>

      {/* Error */}
      {error && <p className="px-4 pb-2 text-xs text-red-500">{error}</p>}

      {/* Send bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <Button onClick={handleSend} disabled={sending} className="gap-2">
          <Send className="w-4 h-4" />
          {sending ? 'Sending…' : 'Send'}
        </Button>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <span>Ctrl+Enter to send</span>
        </div>
      </div>
    </div>
  )
}
