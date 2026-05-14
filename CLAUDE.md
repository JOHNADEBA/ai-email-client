# AI Email Client — CLAUDE.md

> Read `node_modules/next/dist/docs/` for accurate Next.js 16 API docs before writing any code.

## Project Overview
AI-first universal email client PWA supporting Gmail, Office 365, and IMAP providers (Yahoo, AOL).
Built with Next.js 16, TypeScript, Tailwind CSS v4, and Claude AI for intelligent email management.

## Architecture
```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── (auth)/             # Auth pages (login, connect accounts)
│   ├── (app)/              # Protected app pages (inbox, compose, thread)
│   ├── api/
│   │   ├── auth/           # Session endpoints
│   │   ├── emails/         # Email CRUD + search
│   │   ├── ai/             # Claude AI endpoints (summarize, draft, prioritize)
│   │   └── accounts/       # Account management
├── components/             # React UI components
│   ├── email/              # Email-specific components
│   ├── ui/                 # Shared UI primitives
│   └── layout/             # Layout components
├── lib/
│   ├── email-adapters/     # Gmail / O365 / IMAP adapters
│   ├── ai/                 # Claude AI service layer
│   ├── auth/               # Session helpers
│   └── demo/               # Mock data for demo mode
├── types/                  # TypeScript type definitions
└── store/                  # Zustand global state
```

## Email Provider Adapters
All adapters implement the `EmailAdapter` interface (`src/types/email.ts`):
- `GmailAdapter` — uses Google Gmail API via OAuth2
- `Office365Adapter` — uses Microsoft Graph API via OAuth2
- `ImapAdapter` — uses imapflow for Yahoo/AOL/generic IMAP
- `DemoAdapter` — realistic mock data for demo/development

## AI Features (Claude claude-sonnet-4-6)
- **Email Summarizer** — condenses long threads into 2-3 sentence summaries
- **Reply Draft Generator** — context-aware reply drafts matching user's tone
- **Priority Scorer** — scores 1-10 with reasoning for inbox prioritization
- **Smart Categorizer** — auto-labels: Work, Personal, Newsletter, Action Required

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **AI**: Anthropic Claude claude-sonnet-4-6 via @anthropic-ai/sdk
- **Email (IMAP)**: imapflow
- **State**: Zustand for client state
- **Testing**: Jest (unit)

## Environment Variables
```env
# AI
ANTHROPIC_API_KEY=

# Gmail OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Microsoft OAuth
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Demo Mode (set to "true" to use mock data without real credentials)
NEXT_PUBLIC_DEMO_MODE=true

# Session secret
SESSION_SECRET=your-secret-here
```

## Development Commands
```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run test         # Run Jest unit tests
npm run lint         # ESLint check
npm run typecheck    # TypeScript type check
```

## Agent Workflow (Multi-Agent)
This project uses a multi-agent Claude Code workflow:

1. **Orchestrator Agent** — reads specs, assigns work, reviews PRs
2. **Email Adapter Agent** — implements and tests provider integrations
3. **AI Features Agent** — builds and tunes Claude prompts for email intelligence
4. **UI Agent** — implements React components following design system
5. **Test Agent** — writes and maintains unit + integration test suites

## Hooks (.claude/settings.json)
- **PostToolUse[Edit]** — runs ESLint on modified TypeScript files
- **PostToolUse[Write]** — type-checks new files
- **PreToolUse[Bash]** — guards against destructive commands

## Specs-Driven Development
All features are spec'd in `/specs/` before implementation:
- `product-spec.md` — user stories, acceptance criteria
- `api-spec.md` — API contract (request/response shapes)
- `ai-spec.md` — AI prompt design and evaluation criteria

## Code Conventions
- Strict TypeScript — no `any`, all types explicit
- Server Components by default, `"use client"` only when needed
- Email adapter errors wrapped in typed `Result<T, EmailError>` union
- All AI calls include timeout (30s) + graceful fallback
- Mobile-first responsive design (320px baseline)
- All tests must pass before deploy
