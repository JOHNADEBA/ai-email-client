# API Spec — MailAI

## Base URL
`/api`

## Authentication
Session-based via httpOnly cookie. Demo mode auto-authenticates.

---

## GET /api/accounts
Returns connected email accounts.

**Response:**
```json
{ "accounts": [{ "id": "demo-gmail", "provider": "gmail", "email": "...", "name": "..." }] }
```

---

## GET /api/emails
List threads for an account.

**Query params:**
- `accountId` — account ID (required)
- `maxResults` — default 20
- `pageToken` — pagination cursor
- `label` — filter by label
- `unread` — filter unread only
- `starred` — filter starred only

**Response:**
```json
{ "threads": [...], "nextPageToken": "20" }
```

---

## GET /api/emails/:threadId
Get full thread with messages.

**Response:** `EmailThread` object

---

## PATCH /api/emails/:threadId
Perform action on a thread.

**Body:**
```json
{
  "action": "archive" | "delete" | "markRead" | "star" | "addLabel" | "removeLabel",
  "accountId": "...",
  "value": true,    // for markRead, star
  "label": "work"   // for addLabel, removeLabel
}
```

---

## POST /api/emails/send
Send an email.

**Body:**
```json
{
  "accountId": "...",
  "to": [{ "email": "...", "name": "..." }],
  "cc": [...],
  "subject": "...",
  "body": "...",
  "replyToId": "thread-id"
}
```

---

## GET /api/emails/search
Search across accounts.

**Query params:**
- `q` — search query
- `accountId` — optional, searches all accounts if omitted

---

## POST /api/ai/summarize
Summarize a thread.

**Body:** `{ "thread": EmailThread }`
**Response:** `{ "summary": "2-3 sentence summary" }`

---

## POST /api/ai/draft
Generate a reply draft.

**Body:** `{ "thread": EmailThread }`
**Response:** `{ "draft": "suggested reply text" }`

---

## POST /api/ai/prioritize
Score threads by priority.

**Body:** `{ "threads": EmailThread[] }`
**Response:** `{ "threads": EmailThread[] }` (with `aiPriority` added)
