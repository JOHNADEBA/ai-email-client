# Product Spec — MailAI Email Client

## User Stories

### Core Email
- As a user, I can connect Gmail, Office 365, and IMAP accounts
- As a user, I see a unified inbox across all connected accounts
- As a user, I can switch between accounts in the sidebar
- As a user, I can read email threads with all messages collapsed/expanded
- As a user, I can compose new emails with to/cc/bcc/subject/body
- As a user, I can reply to and forward emails
- As a user, I can archive, delete, and star emails
- As a user, I can search across all accounts simultaneously
- As a user, I can filter by labels/categories

### AI Features
- As a user, I can get a 2-3 sentence AI summary of any thread with one click
- As a user, I can generate an AI reply draft that I can edit and send
- As a user, I can see priority scores (1-10) for each email
- As a user, I can sort inbox by AI priority to see most urgent emails first
- As a user, I can see auto-applied AI categories (Work, Personal, Newsletter, etc.)

### PWA / Mobile
- As a user, I can install the app on my phone via "Add to Home Screen"
- As a user, the app works on screens as small as 320px wide
- As a user, I have a mobile-friendly sidebar that opens/closes with a hamburger button

## Acceptance Criteria

### Must Have (v1)
- [x] Unified inbox with demo data
- [x] Thread reading with expand/collapse
- [x] Compose/reply with CC support
- [x] AI summarize button (calls Claude API)
- [x] AI draft reply button (calls Claude API)
- [x] Priority score display
- [x] Category emoji display
- [x] Archive/delete/star actions
- [x] Search with debounce
- [x] Mobile responsive sidebar
- [x] PWA manifest

### Nice to Have (v2)
- [ ] Push notifications for new email
- [ ] Offline support with service worker caching
- [ ] Keyboard shortcuts (j/k navigation, e=archive, r=reply, c=compose)
- [ ] Thread snooze
- [ ] Smart folders (AI-generated)
