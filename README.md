# MailAI — AI-First Email Client

An AI-powered universal email client PWA that unifies Gmail, Office 365, and IMAP accounts (Yahoo, AOL) into a single intelligent inbox — built with Claude AI for smart summaries, priority scoring, and reply drafting.

**Live demo:** [https://ai-email-client-three.vercel.app](https://ai-email-client-three.vercel.app)

> No account required — click **Try Demo** on the login page to explore with realistic mock data.

---

## Features

- **Unified inbox** — merge all your email accounts into one view, with per-account or per-label filtering
- **AI summaries** — every thread gets a 2–3 sentence summary powered by Claude AI
- **AI priority scoring** — threads scored 1–10; sort inbox by priority with one click
- **AI reply drafts** — context-aware reply drafts matching your tone
- **Smart auto-labeling** — Work, Personal, Newsletter, Finance, Action Required, Social
- **Compose / Reply / Forward** — full compose experience with account switching
- **Archive, Delete, Star** — optimistic UI (instant feedback, background sync)
- **Search** — full-text search with debounce + client-side result cache
- **Infinite scroll** — loads 50 threads at a time across all tabs including unified inbox
- **PWA** — installable on desktop and mobile, works offline for cached content
- **Demo mode** — pre-loaded realistic mock emails, no account sign-in required

---

## Quick Start

### Run locally

```bash
git clone <repo>
cd ai-email-client
npm install
cp .env.example .env.local   # fill in your secrets (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo mode (no credentials needed)

Set in `.env.local`:

```env
NEXT_PUBLIC_DEMO_MODE=true
SESSION_SECRET=any-random-string
```

Then `npm run dev` and click **Try Demo** on the login page, or visit `/api/auth/demo` directly.

---

## OAuth Setup

### Gmail

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:3000/api/auth/google/callback` (dev) and your production URL to Authorized redirect URIs
4. Enable the **Gmail API**

### Microsoft (Office 365 / Outlook)

1. Go to [Azure Portal](https://portal.azure.com) → App registrations → New registration
2. Add `http://localhost:3000/api/auth/microsoft/callback` as a redirect URI
3. Under **Certificates & secrets**, create a client secret
4. Under **API permissions**, add `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access`

### Environment variables

```env
# AI (optional — demo mode works without it)
ANTHROPIC_API_KEY=sk-ant-...

# Gmail
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Microsoft
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=a-long-random-secret-string

# Demo mode toggle
NEXT_PUBLIC_DEMO_MODE=false
```

---

## Architecture

```
src/
├── app/
│   ├── (auth)/             # Login / connect-account pages
│   ├── (app)/inbox/        # Main inbox page (thread list + thread view)
│   └── api/
│       ├── auth/           # OAuth callbacks, session, demo
│       ├── emails/         # Thread list, get, patch (archive/star/delete), search
│       ├── ai/             # Summarize, draft, prioritize endpoints
│       └── accounts/       # Account list
├── components/
│   ├── email/              # ThreadList, ThreadView, Compose
│   ├── layout/             # Sidebar, Header
│   └── ui/                 # Button, Badge, shared primitives
├── lib/
│   ├── email-adapters/     # GmailAdapter, Office365Adapter, ImapAdapter, DemoAdapter
│   ├── ai/                 # Claude prompt wrappers
│   └── auth/               # iron-session helpers
├── store/                  # Zustand global state
└── types/                  # Shared TypeScript types
```

All email providers implement the same `EmailAdapter` interface — the UI is completely provider-agnostic.

---

## Submission Deliverables

| Deliverable | Location |
|---|---|
| Live URL | https://ai-email-client-three.vercel.app |
| CLAUDE.md | [CLAUDE.md](./CLAUDE.md) |
| Architecture doc | [docs/architecture.md](./docs/architecture.md) |
| Agents, skills & hooks | [docs/agents-skills-hooks.md](./docs/agents-skills-hooks.md) |
| Workflow writeup | [docs/workflow.md](./docs/workflow.md) |
| Unit tests | `src/__tests__/` (31 passing) |

---

## Development

```bash
npm run dev          # Dev server on :3000
npm run build        # Production build
npm run test         # Jest unit tests
npm run lint         # ESLint
npm run typecheck    # TypeScript check
```

Built with [Claude Code](https://claude.ai/code) using a multi-agent workflow.
