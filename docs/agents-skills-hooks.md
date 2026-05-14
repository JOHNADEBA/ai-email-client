# Agents, Skills, Hooks & Plugins

## Multi-Agent Workflow

This project uses a 5-agent Claude Code workflow orchestrated via `.claude/settings.json`.

### Agents

| Agent | Model | Responsibility |
|---|---|---|
| **Orchestrator** | claude-opus-4-7 | Reads specs, assigns tasks, reviews changes, ensures product coherence |
| **Email Adapter Agent** | claude-sonnet-4-6 | Implements provider integrations (Gmail, O365, IMAP); writes adapter tests |
| **AI Features Agent** | claude-sonnet-4-6 | Designs Claude prompts, evaluates output quality, tunes token limits |
| **UI Agent** | claude-sonnet-4-6 | Builds React components, ensures design system consistency |
| **Test Agent** | claude-haiku-4-5-20251001 | Writes unit/integration tests, spots edge cases, maintains coverage |

### How Agents Collaborate

```
Orchestrator reads specs/product-spec.md
   │
   ├─ assigns "implement Gmail OAuth" → Email Adapter Agent
   │     └─ writes src/lib/email-adapters/gmail-adapter.ts
   │     └─ writes tests/gmail-adapter.test.ts
   │
   ├─ assigns "build thread view" → UI Agent
   │     └─ writes src/components/email/thread-view.tsx
   │
   ├─ assigns "tune summarizer prompt" → AI Features Agent
   │     └─ edits src/lib/ai/email-ai.ts
   │     └─ evaluates against 10 sample threads
   │
   └─ assigns "verify all tests pass" → Test Agent
         └─ runs npm test
         └─ writes missing coverage
```

---

## Hooks

Defined in `.claude/settings.json`:

### PostToolUse[Edit|Write] — ESLint Auto-fix
```json
{
  "matcher": "Edit|Write",
  "hooks": [{
    "type": "command",
    "command": "npx eslint --fix \"$CLAUDE_FILE_PATHS\" --quiet 2>/dev/null || true"
  }]
}
```
**Purpose:** Automatically fixes ESLint issues after every file write. Agents never need to remember to lint.

### PreToolUse[Bash] — Command Logging
```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "echo \"[Claude Code] Running: $CLAUDE_TOOL_INPUT_COMMAND\""
  }]
}
```
**Purpose:** Audit trail of every bash command run by agents.

---

## Skills (Claude Code Skills)

### `email-adapter-skill`
Encapsulates the pattern for implementing a new email provider:
1. Create adapter class implementing `EmailAdapter`
2. Map provider-specific message format → `Email` / `EmailThread` types
3. Handle OAuth token refresh
4. Write unit tests with mocked HTTP responses

### `ai-prompt-eval-skill`  
Evaluates AI prompt quality against a set of test emails:
1. Runs `summarizeThread()` on 20 diverse threads
2. Scores output on: accuracy, conciseness, actionability
3. Reports p50/p90 token usage and latency

### `component-scaffold-skill`
Scaffolds a new React component following the design system:
1. Creates `src/components/email/<name>.tsx` with standard imports
2. Adds `'use client'` only if interactive
3. Exports component + types

---

## Plugins / Integrations

### Current
| Integration | Purpose | Implementation |
|---|---|---|
| **Anthropic Claude** | Email AI features | `@anthropic-ai/sdk` in `src/lib/ai/email-ai.ts` |
| **Gmail API** | Gmail email access | `GmailAdapter` via REST + OAuth2 |
| **Microsoft Graph** | Office 365 access | `Office365Adapter` via REST + OAuth2 |
| **imapflow** | IMAP protocol | `ImapAdapter` (TODO: full implementation) |
| **Vercel** | Hosting + edge | Zero-config Next.js deployment |

### Planned
| Integration | Purpose |
|---|---|
| **Prisma + Postgres** | Persistent email cache, user settings |
| **Redis** | AI response caching (reduce Claude API costs) |
| **Resend / Nodemailer** | SMTP sending for IMAP accounts |
| **Vercel Cron** | Background email sync every 5 minutes |
| **PWA Push API** | Browser push notifications |

---

## Permissions

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(npx *)",
      "Bash(git *)",
      "Bash(vercel *)"
    ]
  }
}
```

Agents are pre-authorized to run build, test, lint, and deploy commands without user prompts.
