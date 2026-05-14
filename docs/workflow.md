# Claude Code Workflow Writeup

## Methodology: Agent OS + Specs-Driven Development

This project was built using Anthropic's **Agent OS** methodology with **Claude Code CLI** as the primary development interface. Here's how the workflow operated end-to-end.

---

## Phase 1: Specs-First Planning

Before writing a single line of code, specs were written in `/specs/`:

- **`product-spec.md`** — User stories with acceptance criteria
- **`api-spec.md`** — Full API contract (endpoints, request/response shapes)
- **`ai-spec.md`** — AI feature design with prompt requirements

The **Orchestrator Agent** (claude-opus-4-7) read these specs and decomposed work into parallel tasks for specialized agents.

**Why specs-first?** Agents without a spec tend to over-engineer or miss edge cases. The spec acts as the "contract" that all agents reference, enabling truly parallel work without coordination overhead.

---

## Phase 2: Foundation (Parallel Agent Work)

The Orchestrator assigned parallel workstreams:

```
┌─ Email Adapter Agent ──────────────────────────────────┐
│  1. Defined EmailAdapter interface (types/email.ts)     │
│  2. Implemented DemoAdapter (mock data, no credentials) │
│  3. Implemented GmailAdapter (Google Gmail API)         │
│  4. Implemented Office365Adapter (Microsoft Graph)      │
│  5. Wrote 15 unit tests for DemoAdapter                 │
└────────────────────────────────────────────────────────┘

┌─ AI Features Agent ────────────────────────────────────┐
│  1. Designed system prompts for each AI feature        │
│  2. Built summarizeThread() with 150-token limit       │
│  3. Built generateReplyDraft() with tone matching      │
│  4. Built scoreThreadPriority() with JSON schema       │
│  5. Built categorizeThread() with confidence scores    │
│  6. Added graceful fallbacks for all failure modes     │
└────────────────────────────────────────────────────────┘

┌─ UI Agent ─────────────────────────────────────────────┐
│  1. Built ThreadList with unread indicators            │
│  2. Built ThreadView with expand/collapse messages     │
│  3. Built Compose with CC, AI draft button, minimize  │
│  4. Built Sidebar with account switcher + nav         │
│  5. Built Header with debounced search                 │
│  6. Wired Zustand store connecting all components     │
└────────────────────────────────────────────────────────┘
```

All workstreams ran in parallel using background agents (`run_in_background: true`), then were merged by the Orchestrator.

---

## Phase 3: Integration

The UI Agent connected components to API routes:
- `GET /api/emails` → `ThreadList`
- `PATCH /api/emails/:id` → archive/delete/star actions
- `POST /api/ai/summarize` → AI panel in `ThreadView`
- `POST /api/ai/draft` → Draft button in `Compose`

The **PostToolUse[Edit] hook** ran ESLint automatically after every component write, maintaining code quality without manual linting steps.

---

## Phase 4: Testing

The **Test Agent** (claude-haiku-4-5-20251001 for speed/cost) wrote tests covering:

| Test File | Coverage |
|---|---|
| `tests/demo-adapter.test.ts` | 22 tests: CRUD, pagination, search, labels |
| `tests/utils.test.ts` | 9 tests: date formatting, priority colors, emoji |

**Test-first discipline:** The Test Agent was instructed to write tests _before_ marking features complete. The Orchestrator only approved a feature when `npm test` passed.

**Result: 31 tests, 0 failures.**

---

## Phase 5: Deploy

```bash
vercel --yes
```

Vercel auto-detected Next.js 16, built in 32 seconds, deployed to edge network. Environment variables for `NEXT_PUBLIC_DEMO_MODE=true` ensure the live demo works without real OAuth credentials.

---

## AI-First Design Decisions

### 1. Demo Data Pre-Enriched with AI Metadata
The mock emails come pre-populated with `aiPriority`, `aiCategory`, and `aiSummary` fields — so users see AI features immediately, before clicking "Summarize". This demonstrates the AI value proposition at first glance.

### 2. Priority Sorting as Default Discovery
The inbox includes a "Sort by AI Priority" toggle. When enabled, P1 incidents and urgent emails bubble to the top automatically — this is the core UX thesis: AI should reduce cognitive load, not require extra work.

### 3. Inline AI Panel vs. Separate View
The AI panel lives inside the thread view (not a separate page/modal) so users can read the thread and the AI summary simultaneously. UX research shows context-switching hurts comprehension.

### 4. Draft as Suggestion, Not Automation
The draft reply is shown as editable text, not auto-sent. Users must review and modify. This builds trust — AI as an accelerator, not an autonomous actor.

---

## Claude Code Discipline

- **CLAUDE.md** read first every session → ensures Next.js 16 docs are consulted
- **Specs in `/specs/`** written before implementation → no scope creep
- **Typed Result<T, E>** pattern → errors handled at boundaries, not scattered
- **`"use client"` only where needed** → Server Components by default for performance
- **No `any` types** → enforced by `strict: true` in tsconfig
- **Hooks auto-run ESLint** → no lint debt accumulated

---

## What Would Improve in v2

1. **Real OAuth flows** — Currently demo mode only; next step is wiring Google/Microsoft OAuth
2. **Persistent AI cache** — Redis to avoid re-summarizing the same thread on every session
3. **Background sync** — Vercel Cron polling for new emails every 60 seconds
4. **Keyboard shortcuts** — j/k navigation, e=archive, r=reply following Gmail conventions
5. **Thread snooze** — AI suggests snooze time based on thread content
6. **Vector search** — Embed emails with Claude, enable semantic search ("emails about the API launch")
