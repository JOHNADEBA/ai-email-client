import type { EmailThread, EmailAccount } from '@/types/email'

export const DEMO_ACCOUNTS: EmailAccount[] = [
  {
    id: 'demo-gmail',
    provider: 'gmail',
    email: 'alex.johnson@gmail.com',
    name: 'Alex Johnson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
  },
  {
    id: 'demo-office365',
    provider: 'office365',
    email: 'alex.johnson@contoso.com',
    name: 'Alex Johnson (Work)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=work',
  },
]

export const DEMO_THREADS: EmailThread[] = [
  {
    id: 't1',
    accountId: 'demo-gmail',
    subject: 'Q3 Product Roadmap Review',
    participants: [
      { name: 'Sarah Chen', email: 'sarah.chen@company.com' },
      { name: 'Mark Williams', email: 'mark@company.com' },
      { name: 'Alex Johnson', email: 'alex.johnson@gmail.com' },
    ],
    lastDate: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    snippet: 'I\'ve updated the roadmap doc with the feedback from yesterday\'s session. Key changes include pushing the analytics feature to Q4...',
    isRead: false,
    isStarred: true,
    isArchived: false,
    labels: ['work', 'important'],
    messageCount: 5,
    aiPriority: 9,
    aiCategory: 'action_required',
    aiSummary: 'Team is discussing Q3 roadmap changes. Analytics feature pushed to Q4. Your input needed on the mobile prioritization decision by EOD.',
    messages: [
      {
        id: 'm1-1',
        accountId: 'demo-gmail',
        threadId: 't1',
        subject: 'Q3 Product Roadmap Review',
        from: { name: 'Sarah Chen', email: 'sarah.chen@company.com' },
        to: [{ name: 'Alex Johnson', email: 'alex.johnson@gmail.com' }, { name: 'Mark Williams', email: 'mark@company.com' }],
        date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        snippet: 'Hi team, following our sync yesterday...',
        body: `Hi team,

Following our sync yesterday, I've compiled the key discussion points into the roadmap doc. Here's a summary of what we agreed:

1. Analytics Dashboard → moved to Q4 (resource constraints)
2. Mobile app v2 → remains Q3 priority
3. API v3 → awaiting legal review

I need everyone's sign-off by EOD Friday. Alex, can you confirm the mobile timeline is still achievable given the recent backend delays?

Best,
Sarah`,
        bodyHtml: '',
        isRead: true,
        isStarred: false,
        isArchived: false,
        labels: ['work'],
        attachments: [],
      },
      {
        id: 'm1-2',
        accountId: 'demo-gmail',
        threadId: 't1',
        subject: 'Re: Q3 Product Roadmap Review',
        from: { name: 'Mark Williams', email: 'mark@company.com' },
        to: [{ name: 'Sarah Chen', email: 'sarah.chen@company.com' }],
        cc: [{ name: 'Alex Johnson', email: 'alex.johnson@gmail.com' }],
        date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        snippet: 'Agreed on the analytics move. Mobile is going to be tight...',
        body: `Sarah,

Agreed on the analytics move. Mobile is going to be tight given the backend delays Alex mentioned last week. We might need to descope the offline mode for v2.

@Alex — what's your current estimate? I think we need to have an honest conversation with leadership before the all-hands.

Mark`,
        bodyHtml: '',
        isRead: true,
        isStarred: false,
        isArchived: false,
        labels: ['work'],
        attachments: [],
      },
      {
        id: 'm1-3',
        accountId: 'demo-gmail',
        threadId: 't1',
        subject: 'Re: Q3 Product Roadmap Review',
        from: { name: 'Sarah Chen', email: 'sarah.chen@company.com' },
        to: [{ name: 'Alex Johnson', email: 'alex.johnson@gmail.com' }, { name: 'Mark Williams', email: 'mark@company.com' }],
        date: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        snippet: 'I\'ve updated the roadmap doc with the feedback...',
        body: `Hi all,

I've updated the roadmap doc with the feedback from yesterday's session. Key changes include pushing the analytics feature to Q4 and descoping offline mode from mobile v2.

Alex — please confirm your timeline. Leadership needs an answer before the all-hands on Thursday.

Sarah`,
        bodyHtml: '',
        isRead: false,
        isStarred: false,
        isArchived: false,
        labels: ['work', 'important'],
        attachments: [],
      },
    ],
  },
  {
    id: 't2',
    accountId: 'demo-gmail',
    subject: 'Your order has shipped! 📦',
    participants: [
      { name: 'Amazon Orders', email: 'orders@amazon.com' },
      { name: 'Alex Johnson', email: 'alex.johnson@gmail.com' },
    ],
    lastDate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    snippet: 'Great news! Your order #113-4729382-8472934 has shipped and is on its way...',
    isRead: true,
    isStarred: false,
    isArchived: false,
    labels: ['shopping'],
    messageCount: 1,
    aiPriority: 2,
    aiCategory: 'personal',
    aiSummary: 'Amazon shipment confirmation. Order #113-4729382 shipped via UPS, estimated delivery Thursday.',
    messages: [
      {
        id: 'm2-1',
        accountId: 'demo-gmail',
        threadId: 't2',
        subject: 'Your order has shipped! 📦',
        from: { name: 'Amazon Orders', email: 'orders@amazon.com' },
        to: [{ name: 'Alex Johnson', email: 'alex.johnson@gmail.com' }],
        date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        snippet: 'Great news! Your order has shipped...',
        body: `Great news! Your order #113-4729382-8472934 has shipped and is on its way.

Delivery estimate: Thursday, May 16
Carrier: UPS
Tracking: 1Z999AA10123456784

Items shipped:
• Sony WH-1000XM5 Headphones (1)

Track your package at amazon.com/orders`,
        bodyHtml: '',
        isRead: true,
        isStarred: false,
        isArchived: false,
        labels: ['shopping'],
        attachments: [],
      },
    ],
  },
  {
    id: 't3',
    accountId: 'demo-office365',
    subject: 'Urgent: Production incident - API latency spike',
    participants: [
      { name: 'PagerDuty', email: 'alerts@pagerduty.com' },
      { name: 'Alex Johnson', email: 'alex.johnson@contoso.com' },
      { name: 'DevOps Team', email: 'devops@contoso.com' },
    ],
    lastDate: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    snippet: 'ALERT: P1 incident triggered. API gateway p99 latency exceeds 2000ms. Incident #INC-2847...',
    isRead: false,
    isStarred: false,
    isArchived: false,
    labels: ['work', 'urgent'],
    messageCount: 3,
    aiPriority: 10,
    aiCategory: 'action_required',
    aiSummary: 'P1 production incident: API gateway latency spiked to 2000ms+ 5 minutes ago. DevOps is investigating. Your acknowledgment may be required.',
    messages: [
      {
        id: 'm3-1',
        accountId: 'demo-office365',
        threadId: 't3',
        subject: 'Urgent: Production incident - API latency spike',
        from: { name: 'PagerDuty', email: 'alerts@pagerduty.com' },
        to: [{ name: 'Alex Johnson', email: 'alex.johnson@contoso.com' }],
        date: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        snippet: 'ALERT: P1 incident triggered...',
        body: `ALERT: P1 incident triggered.

Service: API Gateway
Metric: p99 latency
Threshold: 500ms
Current: 2847ms
Duration: 5 minutes

Incident: #INC-2847
Acknowledged by: DevOps On-call

Runbook: https://wiki.internal/runbooks/api-latency`,
        bodyHtml: '',
        isRead: false,
        isStarred: false,
        isArchived: false,
        labels: ['work', 'urgent'],
        attachments: [],
      },
    ],
  },
  {
    id: 't4',
    accountId: 'demo-gmail',
    subject: 'Weekly Newsletter: AI in 2026',
    participants: [
      { name: 'The Rundown AI', email: 'hello@therundown.ai' },
      { name: 'Alex Johnson', email: 'alex.johnson@gmail.com' },
    ],
    lastDate: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    snippet: 'This week in AI: Claude 4 benchmarks, GPT-5 rumors, and why every company is now an AI company...',
    isRead: false,
    isStarred: false,
    isArchived: false,
    labels: ['newsletter'],
    messageCount: 1,
    aiPriority: 3,
    aiCategory: 'newsletter',
    aiSummary: 'AI newsletter covering Claude 4 benchmarks, industry trends, and startup funding rounds. ~5 min read.',
    messages: [
      {
        id: 'm4-1',
        accountId: 'demo-gmail',
        threadId: 't4',
        subject: 'Weekly Newsletter: AI in 2026',
        from: { name: 'The Rundown AI', email: 'hello@therundown.ai' },
        to: [{ name: 'Alex Johnson', email: 'alex.johnson@gmail.com' }],
        date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
        snippet: 'This week in AI...',
        body: `# The Rundown — May 14, 2026

**This week in AI:**

1. **Claude 4 benchmarks** — Anthropic's newest model scores 94% on MMLU, setting new records across reasoning tasks.

2. **The enterprise AI wave** — 78% of Fortune 500 companies now have AI deployed in production (up from 34% in 2024).

3. **Funding roundup** — $2.1B raised across 47 AI startups this week alone.

4. **Regulation update** — EU AI Act enforcement begins July 1. Here's what you need to know.

Read the full issue →`,
        bodyHtml: '',
        isRead: false,
        isStarred: false,
        isArchived: false,
        labels: ['newsletter'],
        attachments: [],
      },
    ],
  },
  {
    id: 't5',
    accountId: 'demo-gmail',
    subject: 'Lunch tomorrow?',
    participants: [
      { name: 'Jamie Park', email: 'jamie.park@gmail.com' },
      { name: 'Alex Johnson', email: 'alex.johnson@gmail.com' },
    ],
    lastDate: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    snippet: 'Hey! Are you free for lunch tomorrow? That new ramen place on Market St finally opened...',
    isRead: true,
    isStarred: false,
    isArchived: false,
    labels: ['personal'],
    messageCount: 2,
    aiPriority: 4,
    aiCategory: 'personal',
    aiSummary: 'Friend Jamie asking about lunch tomorrow at new ramen place on Market St. Awaiting your reply.',
    messages: [
      {
        id: 'm5-1',
        accountId: 'demo-gmail',
        threadId: 't5',
        subject: 'Lunch tomorrow?',
        from: { name: 'Jamie Park', email: 'jamie.park@gmail.com' },
        to: [{ name: 'Alex Johnson', email: 'alex.johnson@gmail.com' }],
        date: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        snippet: 'Hey! Are you free for lunch tomorrow?',
        body: `Hey!

Are you free for lunch tomorrow? That new ramen place on Market St finally opened and I've been dying to try it. Around noon?

Let me know!
Jamie`,
        bodyHtml: '',
        isRead: true,
        isStarred: false,
        isArchived: false,
        labels: ['personal'],
        attachments: [],
      },
    ],
  },
  {
    id: 't6',
    accountId: 'demo-office365',
    subject: 'Invoice #INV-2847 - Due in 3 days',
    participants: [
      { name: 'Stripe', email: 'billing@stripe.com' },
      { name: 'Alex Johnson', email: 'alex.johnson@contoso.com' },
    ],
    lastDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    snippet: 'Your invoice for $4,250.00 is due on May 17, 2026. Click to pay now...',
    isRead: false,
    isStarred: false,
    isArchived: false,
    labels: ['finance'],
    messageCount: 1,
    aiPriority: 7,
    aiCategory: 'finance',
    aiSummary: 'Stripe invoice for $4,250 due May 17 (3 days). Payment action required.',
    messages: [
      {
        id: 'm6-1',
        accountId: 'demo-office365',
        threadId: 't6',
        subject: 'Invoice #INV-2847 - Due in 3 days',
        from: { name: 'Stripe', email: 'billing@stripe.com' },
        to: [{ name: 'Alex Johnson', email: 'alex.johnson@contoso.com' }],
        date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        snippet: 'Your invoice for $4,250.00 is due...',
        body: `Invoice #INV-2847

Amount due: $4,250.00
Due date: May 17, 2026

Services:
• Cloud infrastructure (Apr 2026): $3,200.00
• Support tier Pro (Apr 2026): $1,050.00

Pay now at dashboard.stripe.com/invoices/INV-2847`,
        bodyHtml: '',
        isRead: false,
        isStarred: false,
        isArchived: false,
        labels: ['finance'],
        attachments: [],
      },
    ],
  },
]
