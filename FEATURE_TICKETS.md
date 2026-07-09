# Fanout — Feature Ticket List

Derived from PRD v1.0 (July 9, 2026). Tickets are sequenced in recommended build order. Each is written to be pasted directly into an AI coding tool as a self-contained prompt.

**Legend — Priority:** `MUST` (launch-blocking, MVP) · `SHOULD` (fast-follow) · `NICE` (post-MVP)

**Tech assumptions** (confirm before build): Chrome Extension **Manifest V3**, TypeScript, React for popup/injected UI, Gmail REST API via `gmail.send` scope, `chrome.storage` + IndexedDB for local persistence. No backend server for send logic (all sending is client-side from the user's browser through the Gmail API).

---

## Epic A — Foundation & Auth

### TICKET-001 — Chrome Extension Scaffold (Manifest V3)
**Priority:** MUST · **Depends on:** none

**Build:** Set up a Manifest V3 Chrome extension project skeleton. Include a background service worker, a content script that runs on `https://mail.google.com/*`, a popup, and an options page. Configure TypeScript, a bundler (Vite or webpack), and hot-reload for development. Define minimal permissions in the manifest: `identity`, `storage`, host permission for `mail.google.com`, and the Gmail API scope placeholder.

**Acceptance criteria:**
- `npm run build` produces a loadable unpacked extension with zero console errors.
- Extension loads on Gmail; content script confirms injection via a console log.
- Popup opens from the toolbar icon and renders a placeholder React component.
- Background service worker registers and survives a reload.
- Manifest passes Chrome's MV3 validation.

---

### TICKET-002 — Google OAuth + Gmail Send API Integration
**Priority:** MUST · **Depends on:** TICKET-001

**Build:** Implement Google OAuth 2.0 using `chrome.identity.getAuthToken` (or the launchWebAuthFlow fallback) requesting the `https://www.googleapis.com/auth/gmail.send` scope plus `userinfo.email`. Store and refresh the access token. Provide a `sendRawEmail(rawMime)` helper that calls `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` with a base64url-encoded RFC 822 message. Handle token expiry/refresh and revoked-consent errors.

**Acceptance criteria:**
- User can click "Connect Gmail" in the popup and complete the Google consent screen.
- Authenticated user's email address is displayed in the UI.
- A single test email sends successfully to a real inbox and arrives as a normal 1:1 message.
- Expired tokens auto-refresh without forcing re-login.
- Revoked/denied consent surfaces a clear "reconnect" state.
- Token is stored securely (not in plaintext logs); scope is limited to `gmail.send`.

**Notes:** Kick off Google's OAuth app verification (privacy policy, ToS) in parallel — long lead time per PRD §9.

---

### TICKET-003 — Compose UI Injection into Gmail ("Bulk Personalize" button)
**Priority:** MUST · **Depends on:** TICKET-001, TICKET-002

**Build:** Content script that detects the native Gmail compose window (MV3, resilient to Gmail's dynamic DOM/class-name churn) and injects a **"Bulk Personalize"** button into the compose toolbar. Clicking it opens the Fanout campaign panel (modal or side drawer) pre-populated with the current subject and body. Also expose the same entry point from the toolbar popup.

**Acceptance criteria:**
- Button appears reliably in every new compose window, including reply/pop-out.
- Button survives Gmail SPA navigation (switching folders, opening/closing compose) without duplicating.
- Clicking opens the Fanout panel with current subject/body carried over.
- Injection uses a MutationObserver strategy that degrades gracefully if Gmail markup changes (logged, non-crashing).
- No interference with normal Gmail send when Fanout is unused.

---

## Epic B — Recipient Data & Personalization

### TICKET-004 — Recipient List Import (CSV upload + spreadsheet paste)
**Priority:** MUST · **Depends on:** TICKET-003

**Build:** In the campaign panel, support importing recipients via (a) CSV file upload and (b) paste from a spreadsheet (tab/comma-delimited). Parse into an in-memory table with headers. Validate that a usable email column exists. Store the parsed list in IndexedDB tied to the draft campaign.

**Acceptance criteria:**
- Upload a 100-row CSV → all rows and columns parsed correctly, including quoted fields and commas within values.
- Paste from Google Sheets / Excel → parsed into the same table structure.
- Rows with missing/malformed emails are flagged and counted, not silently dropped.
- Duplicate email addresses are detected and reported.
- Handles a 1,000-row file without freezing the UI.
- Displays a row count and a preview of the first ~5 rows.

---

### TICKET-005 — Column → Token Mapping with Auto-Detection
**Priority:** MUST · **Depends on:** TICKET-004

**Build:** UI to map CSV columns to personalization tokens. Auto-detect common fields (email, first name, last name, company) by fuzzy header matching. Let the user manually remap any column and rename tokens. Produce a token schema (e.g., `{{FirstName}} → column "First"`).

**Acceptance criteria:**
- Columns named "Email", "first_name", "Company", etc. auto-map to the correct tokens.
- User can override any auto-mapping via dropdowns.
- The email column is required; UI blocks proceeding until one is set.
- Custom columns become custom tokens usable in the body.
- Mapping persists with the draft campaign.

---

### TICKET-006 — Personalization Token Engine
**Priority:** MUST · **Depends on:** TICKET-005

**Build:** A merge engine that renders subject + body per recipient by substituting `{{Token}}` placeholders with that recipient's row values. Support tokens in both subject and body. Provide configurable fallback/default values for empty fields (e.g., `{{FirstName|there}}`). Detect tokens used in the body that have no mapped column and warn.

**Acceptance criteria:**
- `{{FirstName}}`, `{{LastName}}`, `{{Company}}`, and custom tokens render correctly per row.
- Empty values use the fallback text; no literal `{{Token}}` leaks into sent mail.
- Unmapped tokens in the body raise a pre-send warning listing them.
- Token syntax is documented inline in the UI.
- Rendering preserves HTML formatting of the email body.

---

## Epic C — Preview, Configure, Send

### TICKET-007 — Pre-Send Preview
**Priority:** MUST · **Depends on:** TICKET-006

**Build:** Show 2–3 fully rendered sample emails (real recipient data, tokens filled) before sending. Include a recipient picker to preview any specific row. Show the resolved To, subject, and body exactly as it will send.

**Acceptance criteria:**
- Preview shows at least 3 distinct recipients' rendered emails by default.
- User can jump to preview any row (e.g., search by email).
- Preview reflects fallback values and current body edits live.
- Warnings from TICKET-006 (unmapped tokens) surface here before send is allowed.

---

### TICKET-008 — Sending Options: Throttle, Delay & Daily Cap
**Priority:** MUST · **Depends on:** TICKET-006

**Build:** Settings UI for send behavior: configurable delay between sends (e.g., randomized 30–90s range recommended for deliverability), and an optional per-day send cap. Provide safe defaults and inline guidance explaining why throttling protects the account. (Scheduling for a future time is explicitly out of MVP — send-now only.)

**Acceptance criteria:**
- User can set a fixed or randomized inter-send delay.
- User can set an optional daily cap; default reflects a safe value.
- Defaults are pre-filled and explained in plain language.
- Settings persist per campaign.
- Values are validated (no zero/negative delays that would risk the account).

---

### TICKET-009 — Sequential Individual Send Engine
**Priority:** MUST · **Depends on:** TICKET-002, TICKET-006, TICKET-008

**Build:** Core queue that sends emails **one at a time, each as a separate `gmail.send` call**, never a shared To/CC/BCC. Runs in the background service worker so it survives popup close. Respects the configured delay between sends. Persists queue state to IndexedDB so an interrupted campaign can resume. Each send is an independent MIME message addressed only to that single recipient.

**Acceptance criteria:**
- Sending 100 recipients produces 100 separate messages; no recipient sees any other address.
- Each send respects the configured delay.
- Send continues if the popup/panel is closed (runs in service worker).
- Queue state persists across browser restart; interrupted campaign can resume.
- Achieves >98% success rate on a clean 100-row list (per PRD MVP definition).
- Per-recipient send result (success/fail + reason) is recorded.

---

### TICKET-010 — Gmail Daily Send-Limit Guardrail
**Priority:** MUST · **Depends on:** TICKET-009

**Build:** Detect account type (consumer Gmail vs. Workspace) where possible and enforce a conservative daily send ceiling (~500/day free, ~2000/day Workspace). Track sends across campaigns within a rolling 24h window. Stop the queue before hitting the limit and warn the user, with clear messaging that this protects them from suspension.

**Acceptance criteria:**
- Running total of sends in the last 24h is tracked and persisted.
- Queue auto-pauses and notifies the user when the cap is reached.
- Limit reflects account type (with a safe default when type is unknown).
- User is warned pre-send if list size exceeds remaining daily allowance.
- 429 / rate-limit responses from Gmail are respected with backoff.

---

### TICKET-011 — Live Progress + Pause / Cancel
**Priority:** MUST · **Depends on:** TICKET-009

**Build:** Live progress UI ("42 of 200 sent") driven by the background queue, with Pause, Resume, and Cancel controls. State updates in real time even if the panel is reopened.

**Acceptance criteria:**
- Progress bar/count updates in near-real-time during send.
- Pause halts after the in-flight send; Resume continues from the same position.
- Cancel stops the queue and records which recipients were not sent.
- Reopening the panel mid-send shows accurate current state.
- Clear final state when the campaign completes.

---

### TICKET-012 — Error Handling & Retry
**Priority:** MUST · **Depends on:** TICKET-009

**Build:** Capture per-recipient failures (invalid format, API errors, bounces where detectable), categorize them, and expose a one-click "Retry failed" that requeues only the failed recipients. Transient errors (network, 429/5xx) auto-retry with exponential backoff; permanent errors (bad address) are marked non-retryable.

**Acceptance criteria:**
- Each failure is logged with recipient, timestamp, and reason.
- Transient errors auto-retry with backoff; permanent errors do not.
- "Retry failed" requeues only failed rows without resending successes.
- Malformed emails are caught pre-send and separated from send-time failures.
- No duplicate sends result from any retry path.

---

### TICKET-013 — Send Summary Report
**Priority:** MUST · **Depends on:** TICKET-009, TICKET-012

**Build:** Post-campaign summary showing counts for sent / failed / skipped, a per-recipient status table, and an export (CSV) of results. Persist reports so the user can review past campaigns.

**Acceptance criteria:**
- Accurate sent / failed / skipped totals displayed on completion.
- Per-recipient status table is filterable by status.
- Results exportable as CSV.
- Past campaign reports are viewable from the popup.
- Report clearly distinguishes "sent" from "delivered" (bounces are best-effort in MVP).

---

## Epic D — Should-Have (Fast Follow)

### TICKET-014 — Open Tracking (pixel-based)
**Priority:** SHOULD · **Depends on:** TICKET-009
**Build:** Inject a per-recipient tracking pixel and record opens. Requires a lightweight hosted endpoint. **AC:** opens attributed per recipient; user can disable tracking per campaign; report shows open counts. *(Note: introduces a backend dependency and privacy-policy implications — scope carefully.)*

### TICKET-015 — Click Tracking
**Priority:** SHOULD · **Depends on:** TICKET-014
**Build:** Rewrite links with per-recipient redirect tracking. **AC:** clicks attributed per recipient/link; toggle per campaign; report shows click counts.

### TICKET-016 — Scheduled Sending
**Priority:** SHOULD · **Depends on:** TICKET-009
**Build:** Queue a campaign to start at a future date/time via `chrome.alarms`. **AC:** campaign starts within a small window of scheduled time; visible in a scheduled list; cancelable before start.

### TICKET-017 — Templates Library
**Priority:** SHOULD · **Depends on:** TICKET-006
**Build:** Save/reuse subject+body templates with tokens. **AC:** save, name, load, edit, delete templates; templates persist locally.

### TICKET-018 — Attachments
**Priority:** SHOULD · **Depends on:** TICKET-009
**Build:** Attach one or more files to all sends. **AC:** attachments included in every individual send; total size validated against Gmail limits.

---

## Epic E — Nice-to-Have (Post-MVP)

| Ticket | Feature | Priority | Depends on |
|---|---|---|---|
| TICKET-019 | Reply detection / auto-stop to a recipient who replies | NICE | TICKET-009 |
| TICKET-020 | Follow-up sequences (auto follow-up after X days) | NICE | TICKET-016, TICKET-019 |
| TICKET-021 | Personalized (per-recipient) attachments | NICE | TICKET-018 |
| TICKET-022 | Live Google Sheets sync (vs. static CSV) | NICE | TICKET-004 |
| TICKET-023 | Multiple sending accounts (Workspace) | NICE | TICKET-002 |
| TICKET-024 | Team collaboration (shared templates/reports) | NICE | TICKET-017 |
| TICKET-025 | Unsubscribe link management | NICE | TICKET-009 |
| TICKET-026 | A/B subject line testing | NICE | TICKET-009 |

---

## Critical Path (build order)

```
001 → 002 → 003 → 004 → 005 → 006 → 007
                                  006 → 008 ─┐
                        002 + 006 + 008 → 009 → 010
                                          009 → 011
                                          009 → 012 → 013
```

**MVP = TICKET-001 through TICKET-013.** Everything in Epics D & E is deferred per PRD §7–8.

## Cross-cutting non-negotiables (apply to every MVP ticket)
- **Never** expose one recipient's address to another — each send is a discrete single-recipient message.
- All sending goes through the user's own Gmail via `gmail.send` — no third-party SMTP relay (PRD §8).
- Positioned and built as a **personalization** tool, not a spam tool (Chrome Web Store + Gmail policy risk, PRD §9).
- UI stays inside Gmail; no separate app to learn.
