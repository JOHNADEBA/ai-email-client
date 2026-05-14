import { formatDate, truncate, priorityColor, categoryEmoji, providerColor } from '@/lib/utils'

describe('formatDate', () => {
  it('shows "just now" for recent timestamps', () => {
    const result = formatDate(new Date(Date.now() - 5000).toISOString())
    expect(result).toBe('just now')
  })

  it('shows minutes for < 1 hour ago', () => {
    const result = formatDate(new Date(Date.now() - 1000 * 60 * 30).toISOString())
    expect(result).toBe('30m ago')
  })

  it('shows time for today', () => {
    const d = new Date()
    d.setHours(d.getHours() - 3)
    const result = formatDate(d.toISOString())
    expect(result).toMatch(/^\d{1,2}:\d{2}/)
  })
})

describe('truncate', () => {
  it('truncates long strings', () => {
    const result = truncate('Hello World', 5)
    expect(result).toBe('Hello…')
  })

  it('does not truncate short strings', () => {
    const result = truncate('Hi', 10)
    expect(result).toBe('Hi')
  })
})

describe('priorityColor', () => {
  it('returns red for high priority', () => {
    expect(priorityColor(10)).toContain('red')
  })

  it('returns orange for medium-high priority', () => {
    expect(priorityColor(8)).toContain('orange')
  })

  it('returns blue for medium priority', () => {
    expect(priorityColor(5)).toContain('blue')
  })

  it('returns gray for low priority', () => {
    expect(priorityColor(2)).toContain('gray')
  })
})

describe('categoryEmoji', () => {
  it('returns work emoji', () => expect(categoryEmoji('work')).toBe('💼'))
  it('returns personal emoji', () => expect(categoryEmoji('personal')).toBe('👤'))
  it('returns newsletter emoji', () => expect(categoryEmoji('newsletter')).toBe('📰'))
  it('returns fallback for unknown', () => expect(categoryEmoji('unknown')).toBe('📧'))
})

describe('providerColor', () => {
  it('returns red for gmail', () => expect(providerColor('gmail')).toContain('red'))
  it('returns blue for office365', () => expect(providerColor('office365')).toContain('blue'))
  it('returns fallback for unknown', () => expect(providerColor('unknown')).toContain('gray'))
})
