import { DemoAdapter } from '@/lib/email-adapters/demo-adapter'

describe('DemoAdapter', () => {
  let adapter: DemoAdapter

  beforeEach(() => {
    adapter = new DemoAdapter('demo-gmail')
  })

  describe('listThreads', () => {
    it('returns threads for the account', async () => {
      const result = await adapter.listThreads({ maxResults: 10 })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.threads.length).toBeGreaterThan(0)
    })

    it('filters archived threads', async () => {
      // Archive a thread first
      const list = await adapter.listThreads({})
      if (!list.ok || !list.value.threads[0]) return
      const threadId = list.value.threads[0].id
      await adapter.archiveThread(threadId)

      const after = await adapter.listThreads({})
      expect(after.ok).toBe(true)
      if (!after.ok) return
      expect(after.value.threads.find(t => t.id === threadId)).toBeUndefined()
    })

    it('filters by unread', async () => {
      // Mark all read first
      const list = await adapter.listThreads({})
      if (!list.ok) return
      await Promise.all(list.value.threads.map(t => adapter.markRead(t.id, true)))

      const unread = await adapter.listThreads({ query: { isUnread: true } })
      expect(unread.ok).toBe(true)
      if (!unread.ok) return
      expect(unread.value.threads.length).toBe(0)
    })

    it('paginates with maxResults', async () => {
      const page1 = await adapter.listThreads({ maxResults: 1 })
      expect(page1.ok).toBe(true)
      if (!page1.ok) return
      expect(page1.value.threads.length).toBe(1)
      expect(page1.value.nextPageToken).toBeDefined()
    })
  })

  describe('getThread', () => {
    it('returns thread with messages', async () => {
      const result = await adapter.getThread('t1')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.messages.length).toBeGreaterThan(0)
      expect(result.value.id).toBe('t1')
    })

    it('returns error for unknown thread', async () => {
      const result = await adapter.getThread('nonexistent')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  describe('markRead', () => {
    it('marks thread as read', async () => {
      await adapter.markRead('t1', true)
      const result = await adapter.getThread('t1')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.isRead).toBe(true)
    })

    it('marks thread as unread', async () => {
      await adapter.markRead('t1', true)
      await adapter.markRead('t1', false)
      const result = await adapter.getThread('t1')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.isRead).toBe(false)
    })
  })

  describe('starThread', () => {
    it('stars and unstars a thread', async () => {
      await adapter.starThread('t1', true)
      let result = await adapter.getThread('t1')
      expect(result.ok && result.value.isStarred).toBe(true)

      await adapter.starThread('t1', false)
      result = await adapter.getThread('t1')
      expect(result.ok && result.value.isStarred).toBe(false)
    })
  })

  describe('search', () => {
    it('finds threads by subject keyword', async () => {
      const result = await adapter.search({ q: 'roadmap' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.some(t => t.subject.toLowerCase().includes('roadmap'))).toBe(true)
    })

    it('returns empty array for no match', async () => {
      const result = await adapter.search({ q: 'xyznotfound12345' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.length).toBe(0)
    })
  })

  describe('sendEmail', () => {
    it('returns a sent message id', async () => {
      const result = await adapter.sendEmail({
        accountId: 'demo-gmail',
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Hello',
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.id).toBeDefined()
    })
  })

  describe('labels', () => {
    it('adds and removes labels', async () => {
      await adapter.addLabel('t1', 'important')
      let result = await adapter.getThread('t1')
      expect(result.ok && result.value.labels.includes('important')).toBe(true)

      await adapter.removeLabel('t1', 'important')
      result = await adapter.getThread('t1')
      expect(result.ok && result.value.labels.includes('important')).toBe(false)
    })

    it('returns available labels', async () => {
      const result = await adapter.getLabels()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(Array.isArray(result.value)).toBe(true)
    })
  })

  describe('deleteThread', () => {
    it('removes thread from list', async () => {
      await adapter.deleteThread('t1')
      const result = await adapter.listThreads({})
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.threads.find(t => t.id === 't1')).toBeUndefined()
    })
  })
})
