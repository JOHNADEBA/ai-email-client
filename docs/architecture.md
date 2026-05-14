# MailAI — Architecture Document

## Overview

MailAI is an AI-first universal email client built as a mobile-ready PWA. It connects Gmail, Office 365, and IMAP providers (Yahoo, AOL) into a single unified inbox, augmented by Claude AI for intelligent email management.

---

## Technology Choices

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) | SSR + API routes in one project; Turbopack for fast builds |
| Language | TypeScript (strict) | Type safety across adapter contracts and AI responses |
| Styling | Tailwind CSS v4 | Utility-first, no JS-in-CSS, tiny bundle |
| AI | Anthropic Claude claude-sonnet-4-6 | Best reasoning-to-cost ratio for email tasks |
| State | Zustand | Minimal boilerplate, SSR-safe, great with React |
| IMAP | imapflow | Modern async IMAP client, supports OAuth SASL |
| Testing | Jest + next/jest | Native Next.js test integration |
| Deploy | Vercel | Zero-config Next.js hosting, edge functions |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser / PWA                        │
│  ┌──────────┐  ┌───────────────┐  ┌────────────────────┐   │
│  │ Sidebar  │  │  Thread List  │  │   Thread View +    │   │
│  │ (Zustand)│  │  (server data)│  │   AI Panel         │   │
│  └──────────┘  └───────────────┘  └────────────────────┘   │
│                    Compose Modal                             │
└─────────────────────────────────────────────────────────────┘
                           │ HTTP / fetch
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                        │
│  /api/emails          /api/ai/summarize                     │
│  /api/emails/[id]     /api/ai/draft                         │
│  /api/emails/send     /api/ai/prioritize                    │
│  /api/emails/search   /api/accounts                         │
└───────────────────────────┬─────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────────┐   ┌────────────────┐   ┌───────────────┐
│  Gmail      │   │  Office 365    │   │  IMAP         │
│  Adapter    │   │  Adapter       │   │  Adapter      │
│  (Google    │   │  (Microsoft    │   │  (imapflow)   │
│  Gmail API) │   │  Graph API)    │   │               │
└─────────────┘   └────────────────┘   └───────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                                 │
┌─────────────────┐              ┌─────────────────────┐
│  Demo Adapter   │              │  Claude AI Engine    │
│  (mock data,    │              │  - summarizeThread() │
│  no credentials)│              │  - generateDraft()   │
└─────────────────┘              │  - scorePriority()   │
                                 │  - categorize()      │
                                 └─────────────────────┘
```

---

## Email Adapter Pattern

All providers implement a common interface (`EmailAdapter`):

```typescript
interface EmailAdapter {
  listThreads(params): Promise<Result<{threads, nextPageToken}, EmailError>>
  getThread(threadId): Promise<Result<EmailThread, EmailError>>
  sendEmail(data): Promise<Result<{id}, EmailError>>
  archiveThread(threadId): Promise<Result<void, EmailError>>
  deleteThread(threadId): Promise<Result<void, EmailError>>
  markRead(threadId, read): Promise<Result<void, EmailError>>
  starThread(threadId, starred): Promise<Result<void, EmailError>>
  addLabel(threadId, label): Promise<Result<void, EmailError>>
  removeLabel(threadId, label): Promise<Result<void, EmailError>>
  search(query): Promise<Result<EmailThread[], EmailError>>
  getLabels(): Promise<Result<string[], EmailError>>
}
```

Error handling uses typed `Result<T, E>` union (no exceptions bubble up to UI).

---

## AI Feature Design

### Prompt Architecture
Each AI feature uses a dedicated system prompt optimized for that task:

1. **Summarizer** — `max_tokens: 150`, instructs model to return 2-3 sentence summaries focused on decisions and action items
2. **Draft Generator** — `max_tokens: 400`, instructs model to match tone, write complete ready-to-send reply
3. **Priority Scorer** — `max_tokens: 200`, JSON response with score (1-10) + reasoning
4. **Categorizer** — `max_tokens: 100`, JSON response with category + confidence

### Graceful Degradation
All AI calls:
- Return empty string / default values on failure (no UI crashes)
- Timeout after 30 seconds
- Cache results on the thread object to avoid duplicate API calls

---

## Data Flow

### Reading Email
1. Client → `GET /api/emails?accountId=X` → API route
2. API route selects adapter for account → calls `adapter.listThreads()`
3. DemoAdapter returns mock data; real adapters call Gmail/Graph APIs
4. Response includes `aiPriority`, `aiCategory`, `aiSummary` if pre-enriched

### Composing Email
1. User opens Compose modal → writes email
2. AI Draft button → `POST /api/ai/draft` → Claude API → draft appears in textarea
3. User edits → clicks Send → `POST /api/emails/send` → adapter sends via API/SMTP

### AI Enrichment
1. User clicks "Summarize" on thread → `POST /api/ai/summarize` with full thread
2. Claude returns summary → displayed in blue AI panel
3. Results cached in React state (not persisted across sessions in demo mode)

---

## PWA Configuration

- `manifest.json` with `display: "standalone"` for native-app feel
- `theme_color: "#2563eb"` matches brand blue
- `start_url: "/inbox"` opens directly to inbox
- Icons at 192×512 sizes for Android/iOS
- Mobile viewport meta prevents zoom on input focus
- Safe area insets via CSS env() for iPhone notches

---

## Security Considerations

- `httpOnly` session cookie (not readable by JavaScript)
- `SameSite: lax` prevents CSRF
- `X-Frame-Options: DENY` header prevents clickjacking
- `X-Content-Type-Options: nosniff` prevents MIME sniffing
- OAuth tokens stored server-side only (never in client state)
- `.env.local` not committed (in `.gitignore`)

---

## Scaling Path

| Scale | Change |
|---|---|
| Production auth | Add NextAuth.js v5 with Google + Microsoft providers |
| Real IMAP | `ImapFlowAdapter` with credential encryption at rest |
| Persistence | Postgres via Prisma for email cache, read state, labels |
| Background sync | Vercel Cron or background workers for push-like latency |
| AI caching | Redis cache for AI responses (summaries change rarely) |
