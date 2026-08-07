# Fanout — Feature Ticket List

Derived from PRD v2.0 (Aug 6, 2026). Tickets are sequenced in recommended build order. Each is written to be pasted directly into an AI coding tool as a self-contained prompt.

**Legend — Priority:** `MUST` (launch-blocking) · `SHOULD` (fast-follow) · `NICE` (post-MVP)

**Tech assumptions** (v2.0): Chrome Extension **Manifest V3** (TypeScript, React, Vite/CRXJS) + a **Next.js web app** (App Router, shadcn/ui, Postgres + Prisma, Stripe) that serves the marketing site, the user dashboard, the admin dashboard, and the API routes. Gmail REST API via `gmail.send`. **The privacy boundary is non-negotiable:** recipient lists and email content never leave the browser; the backend stores identity, billing, and counts/scrubbed-metadata only (ARCHITECTURE §4.2, SECURITY §3).

> **What's done:** the v1.0 MVP — **TICKET-001 → 013** — plus **TICKET-017** (templates) are built and code-complete. Their full text has moved to the **✅ Done** section at the bottom of this file. Everything above that line is the remaining v2.0 work, organized by phase (PRD §1.5).

---

## Phase 1 — Finish & ship the extension (free, in Google "Testing" mode → Web Store)

Goal: extension live in the Chrome Web Store, onboarding the first 100 test users, with the phone-home hooks built (but harmless) so Phase 2 is not a re-release.

### TICKET-018 — Attachments
**Priority:** SHOULD · **Depends on:** TICKET-009 · **Gated:** Pro
**Build:** Attach one or more files to all sends; extend the MIME builder for multipart with attachments. Gate behind Pro (TICKET-035).
**AC:** attachments included in every individual send; total size validated against Gmail limits; encoding correct (base64, filename, content-type); blocked for Free with upgrade prompt.

### TICKET-034 — Telemetry Emitter (extension)
**Priority:** MUST (for platform) · **Depends on:** TICKET-013 · **New**
**Build:** After each campaign completes, POST **aggregate counts** (`attempted`, `sent`, `failed`, `cap_hits`, an opaque `campaign_ref`) and any **scrubbed error events** to `${VITE_BACKEND_URL}/api/telemetry`. Reuse `lib/logger.ts` to scrub **before** building the payload. In Phase 1 the endpoint does not exist yet — if `VITE_BACKEND_URL` is unset the emitter **no-ops (or queues locally)** so it ships harmlessly and activates in Phase 2. Honor a "share diagnostics" toggle (default on, user can disable).
**AC:** emits counts + scrubbed errors; payload **never** contains a recipient address/name, subject, body, or CSV value — enforced by a unit test that fails on any `@`-shaped string beyond the user's own email; `campaign_ref` is opaque (not reversible to recipients); no-ops cleanly when no backend is configured; respects the diagnostics toggle.

### TICKET-035 — Entitlement Check + Tier Gating (extension)
**Priority:** MUST (for platform) · **Depends on:** TICKET-013 · **New**
**Build:** An entitlement service returning the current tier (`free` / `pro` / `team`) and derived limits (daily cap, feature flags). Phase 1: a **stub** that always returns `free` (with a dev override). Gate scheduling (016), attachments (018), and the daily cap on tier. Limits live once in `@fanout/shared/constants`. UI shows locked features with an upgrade affordance.
**AC:** features gate on tier from a single source of truth; stub returns `free`; UI reflects locked state; swapping the stub for the real API (TICKET-040) needs **no UI change**.

### Epic F (Phase 1 launch prerequisites)
Legal + verification gate public launch (below). **TICKET-028/029 (Privacy Policy + ToS) are satisfied by TICKET-037** once the Next.js marketing site is up — but they can also be shipped as static pages first if Phase 2 lags, since OAuth verification needs them live. See the **Epic F** table below.

---

## Phase 2 — Platform (Next.js web app + backend + billing + dashboards)

Goal: paid product. Build order: `036 → 037 → 038 → 039 → 040 → 041 → 042 → 043`. The backend is Next.js API routes (ARCHITECTURE §2.4); the DB is one Postgres (ARCHITECTURE §4.2).

### TICKET-036 — Next.js web app scaffold + design system
**Priority:** MUST · **Depends on:** none (parallel to Phase 1) · **New**
**Build:** Create `packages/web` (Next.js App Router) in the pnpm monorepo. Wire Tailwind with the landing tokens (FRONTEND_SPEC §2), self-host **Geist**/Geist Mono via `next/font`, install **shadcn/ui** themed to the dark/gold palette, and scaffold the app shell with `/(marketing)`, `/dashboard`, and `/admin` segments. Import `@fanout/shared`.
**AC:** app builds and deploys (Vercel or AWS — ARCHITECTURE §2.4); shadcn components render in the gold/dark theme; `@fanout/shared` types import cleanly; typecheck + lint green in CI beside the extension.

### TICKET-037 — Port landing page to Next.js (+ Privacy/ToS)
**Priority:** MUST · **Depends on:** TICKET-036 · **New** · **Satisfies 027/028/029**
**Build:** Rebuild `landing/index.html` as Next.js routes/components — marketing home, **pricing**, `/privacy`, `/terms`. Replace CDN Tailwind/GSAP/Motion/Phosphor/Fonts with npm packages (`gsap` + ScrollTrigger, `framer-motion`, `@phosphor-icons/react`, `next/font`); **Aceternity** for marketing flourish. **Port, don't redesign** (FRONTEND_SPEC §3). Retire the static file once the route is live.
**AC:** visual parity with the static page; strong Lighthouse SEO/perf (SSR/ISR); `prefers-reduced-motion` honored; Privacy Policy + ToS published at stable URLs (unblocks OAuth verification, TICKET-030); no external CDN dependencies remain.

### TICKET-038 — Web Google sign-in + accounts backend
**Priority:** MUST · **Depends on:** TICKET-036 · **New**
**Build:** "Sign in with Google" on the web app using the **same `google_sub` identity** as the extension (no second account system). `/api/auth` verifies the Google ID token against Google's public keys, upserts the `users` row, issues a Fanout session. Provision Postgres + the Prisma schema (ARCHITECTURE §4.2–4.3).
**AC:** user signs in with Google; `users` row created/updated; **ID token signature verified server-side on every request** (SECURITY §1.5); session scoped to the verified user; no passwords stored.

### TICKET-039 — Telemetry ingestion API + tables
**Priority:** MUST · **Depends on:** TICKET-038 · **New** · **Absorbs TICKET-033**
**Build:** Implement `/api/telemetry`: verify the ID token, scope to the user, **upsert** `campaign_stats` (by `user_id + campaign_ref`), insert `error_events`. Add both Prisma models + migrations. Flip the extension emitter (TICKET-034) to the live URL. Cap `error_events` retention (e.g. 90 days).
**AC:** extension counts land in `campaign_stats`; scrubbed errors land in `error_events`; the server **rejects payloads carrying recipient-shaped values** and re-scopes every write to the verified user (SECURITY §5.6); retention cap enforced.

### TICKET-040 — Entitlement API (flip the stub)
**Priority:** MUST · **Depends on:** TICKET-038, TICKET-041 · **New**
**Build:** Implement `/api/entitlement` returning the user's tier + limits derived from their `subscriptions` row. Replace the extension's Phase-1 stub (TICKET-035) with a call to this endpoint, cached with a short grace window; when offline, fail **toward already-granted** access, never upgrading (SECURITY §4.5).
**AC:** entitlement reflects the real plan; offline grace never grants unpaid features; plan derives from `subscriptions` (Stripe-sourced), never client claims; extension UI unchanged from TICKET-035.

### TICKET-041 — Stripe billing + tiers
**Priority:** MUST · **Depends on:** TICKET-038 · **New**
**Build:** Stripe **Checkout** (upgrade) + **Customer Portal** (manage) + `/api/stripe/webhook`. The `subscriptions` table is the **source of truth, written only by verified webhooks**; `webhook_events` is the idempotency ledger. Define Free/Pro/Team prices. Upgrade entry point from the user dashboard.
**AC:** user upgrades via Checkout; `subscriptions` mirrors Stripe status via webhook; **webhook signature verified + idempotent** (SECURITY §4.5); a client can never self-grant a paid plan; downgrade honored at `current_period_end`.

### TICKET-042 — User dashboard
**Priority:** MUST · **Depends on:** TICKET-038, TICKET-039, TICKET-041 · **New**
**Build:** Authed `/dashboard`: current plan, usage (from `usage_records` / `campaign_stats`), campaign history (**counts only**), manage subscription (Stripe portal), account settings. Industrial, shadcn, landing palette (FRONTEND_SPEC §1).
**AC:** shows plan + usage + history for the **signed-in user only**; upgrade / manage-billing works; **no recipient data displayed** (none exists server-side); real loading/empty/error states.

### TICKET-043 — Admin / monitoring dashboard
**Priority:** MUST · **Depends on:** TICKET-039, TICKET-041 · **New**
**Build:** `/admin`, gated by an **operator `google_sub` allowlist** (env var, re-checked per request — SECURITY §2.5). Four views: **business metrics** (signups, free→paid, MRR/churn from Stripe + DB), **aggregate send health** (`campaign_stats`), **error telemetry** (`error_events`), and **per-user metadata drill-down**. Charts via shadcn.
**AC:** only allowlisted operators reach `/admin` (re-checked every request; no admin boolean, no blindly-trusted cookie); the four views render real aggregates; per-user drill-down shows **metadata only, never recipients**; performant on large tables (pagination/virtualization).

---

## Deferred — needs recipient-activity server infrastructure or is post-MVP

### TICKET-014 — Open Tracking (pixel-based) · TICKET-015 — Click Tracking
**Priority:** SHOULD · **Status: DEFERRED.** These are the **one** feature area that would put *recipient activity* on the server (a pixel/redirect endpoint + a recipient-events table), crossing the privacy boundary the rest of the platform is built to preserve (ARCHITECTURE §7.4, SECURITY §5.5). If ever built, they must be **explicitly opt-in per campaign, isolated**, and preceded by a fresh privacy/policy review and a Privacy-Policy rewrite. Do not add silently.

### Epic E — Nice-to-Have (Post-MVP)

| Ticket | Feature | Priority | Depends on |
|---|---|---|---|
| TICKET-019 | Reply detection / auto-stop to a recipient who replies | NICE | TICKET-009 |
| TICKET-020 | Follow-up sequences (auto follow-up after X days) | NICE | TICKET-016, TICKET-019 |
| TICKET-021 | Personalized (per-recipient) attachments | NICE | TICKET-018 |
| TICKET-022 | Live Google Sheets sync (vs. static CSV) | NICE | TICKET-004 |
| TICKET-023 | Multiple sending accounts (Workspace) | NICE (Team tier) | TICKET-002 |
| TICKET-024 | Team collaboration (shared templates/reports) | NICE (Team tier) | TICKET-017 |
| TICKET-025 | Unsubscribe link management | NICE | TICKET-009 |
| TICKET-026 | A/B subject line testing | NICE | TICKET-009 |

---

## Epic F — Launch Prerequisites (non-code, required to go public)

These don't block local testing or the 100-user "Testing" mode, but every one is required before publishing beyond the test-user cap. Start OAuth verification early — multi-week lead time (PRD §9).

| Ticket | Item | Status | Blocks | Depends on |
|---|---|---|---|---|
| TICKET-027 | Landing page hosted at a public URL | Superseded by **TICKET-037** (Next.js) | Marketing, OAuth verification | none |
| TICKET-028 | Privacy Policy page (`gmail.send`-only, backend holds no recipient data) | Satisfied by **TICKET-037** | OAuth verification | TICKET-027/037 |
| TICKET-029 | Terms of Service page | Satisfied by **TICKET-037** | OAuth verification | TICKET-027/037 |
| TICKET-030 | Google OAuth app verification (move out of "Testing") | Not started | Public use beyond 100 test users | TICKET-028, TICKET-029 |
| TICKET-031 | Chrome Web Store listing + submission ($5 dev fee) | Not started | Public distribution | TICKET-030 |
| TICKET-032 | Payments / license | Covered by **TICKET-041** (Stripe) | Monetization | TICKET-031 |
| TICKET-033 | Error telemetry (scrubbed, no PII) | Covered by **TICKET-039** | Ops visibility | TICKET-038 |

**Launch critical path (Phase 1):** `037 (Privacy+ToS) → 030 → 031`.

---

## Critical Path (build order)

```
DONE:  001 → … → 013,  017

Phase 1 (extension → Web Store):
   016, 018 (finish)   034 (telemetry emitter)   035 (entitlement stub)
   → 037 (Privacy/ToS live) → 030 (OAuth verification) → 031 (Web Store)

Phase 2 (platform):
   036 → 037 → 038 → 039 → 040 → 041 → 042 → 043
                         041 ─┘ (entitlement 040 needs subscriptions)
```

## Cross-cutting non-negotiables (apply to every ticket)
- **Never** expose one recipient's address to another — each send is a discrete single-recipient message.
- **Recipient lists and email content never leave the browser.** The backend stores identity, billing, and counts/scrubbed-metadata only. Every new server-side field passes the test: *could this reveal who a user emailed or what they wrote?* If yes, it isn't built server-side (ARCHITECTURE §7.4, SECURITY §3).
- All sending goes through the user's own Gmail via `gmail.send` — no third-party SMTP relay.
- **Plan/subscription comes only from verified Stripe webhooks**, never from the client.
- Positioned and built as a **personalization** tool, not a spam tool (Chrome Web Store + Gmail policy risk, PRD §9).
- Use the `landing-page-design` skill when building marketing pages and keep `ponytail` active throughout (FRONTEND_SPEC §0).

---

# ✅ Done (built & code-complete)

The v1.0 MVP and the templates feature. Full original ticket text preserved below for reference.

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

### TICKET-003 — Compose UI Injection into Gmail ("Bulk Personalize" button)
**Priority:** MUST · **Depends on:** TICKET-001, TICKET-002

**Build:** Content script that detects the native Gmail compose window (MV3, resilient to Gmail's dynamic DOM/class-name churn) and injects a **"Bulk Personalize"** button into the compose toolbar. Clicking it opens the Fanout campaign panel (modal or side drawer) pre-populated with the current subject and body. Also expose the same entry point from the toolbar popup.

**Acceptance criteria:**
- Button appears reliably in every new compose window, including reply/pop-out.
- Button survives Gmail SPA navigation (switching folders, opening/closing compose) without duplicating.
- Clicking opens the Fanout panel with current subject/body carried over.
- Injection uses a MutationObserver strategy that degrades gracefully if Gmail markup changes (logged, non-crashing).
- No interference with normal Gmail send when Fanout is unused.

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

### TICKET-005 — Column → Token Mapping with Auto-Detection
**Priority:** MUST · **Depends on:** TICKET-004

**Build:** UI to map CSV columns to personalization tokens. Auto-detect common fields (email, first name, last name, company) by fuzzy header matching. Let the user manually remap any column and rename tokens. Produce a token schema (e.g., `{{FirstName}} → column "First"`).

**Acceptance criteria:**
- Columns named "Email", "first_name", "Company", etc. auto-map to the correct tokens.
- User can override any auto-mapping via dropdowns.
- The email column is required; UI blocks proceeding until one is set.
- Custom columns become custom tokens usable in the body.
- Mapping persists with the draft campaign.

### TICKET-006 — Personalization Token Engine
**Priority:** MUST · **Depends on:** TICKET-005

**Build:** A merge engine that renders subject + body per recipient by substituting `{{Token}}` placeholders with that recipient's row values. Support tokens in both subject and body. Provide configurable fallback/default values for empty fields (e.g., `{{FirstName|there}}`). Detect tokens used in the body that have no mapped column and warn.

**Acceptance criteria:**
- `{{FirstName}}`, `{{LastName}}`, `{{Company}}`, and custom tokens render correctly per row.
- Empty values use the fallback text; no literal `{{Token}}` leaks into sent mail.
- Unmapped tokens in the body raise a pre-send warning listing them.
- Token syntax is documented inline in the UI.
- Rendering preserves HTML formatting of the email body.

## Epic C — Preview, Configure, Send

### TICKET-007 — Pre-Send Preview
**Priority:** MUST · **Depends on:** TICKET-006

**Build:** Show 2–3 fully rendered sample emails (real recipient data, tokens filled) before sending. Include a recipient picker to preview any specific row. Show the resolved To, subject, and body exactly as it will send.

**Acceptance criteria:**
- Preview shows at least 3 distinct recipients' rendered emails by default.
- User can jump to preview any row (e.g., search by email).
- Preview reflects fallback values and current body edits live.
- Warnings from TICKET-006 (unmapped tokens) surface here before send is allowed.

### TICKET-008 — Sending Options: Throttle, Delay & Daily Cap
**Priority:** MUST · **Depends on:** TICKET-006

**Build:** Settings UI for send behavior: configurable delay between sends (e.g., randomized 30–90s range recommended for deliverability), and an optional per-day send cap. Provide safe defaults and inline guidance explaining why throttling protects the account. (Scheduling for a future time is explicitly out of MVP — send-now only.)

**Acceptance criteria:**
- User can set a fixed or randomized inter-send delay.
- User can set an optional daily cap; default reflects a safe value.
- Defaults are pre-filled and explained in plain language.
- Settings persist per campaign.
- Values are validated (no zero/negative delays that would risk the account).

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

### TICKET-010 — Gmail Daily Send-Limit Guardrail
**Priority:** MUST · **Depends on:** TICKET-009

**Build:** Detect account type (consumer Gmail vs. Workspace) where possible and enforce a conservative daily send ceiling (~500/day free, ~2000/day Workspace). Track sends across campaigns within a rolling 24h window. Stop the queue before hitting the limit and warn the user, with clear messaging that this protects them from suspension.

**Acceptance criteria:**
- Running total of sends in the last 24h is tracked and persisted.
- Queue auto-pauses and notifies the user when the cap is reached.
- Limit reflects account type (with a safe default when type is unknown).
- User is warned pre-send if list size exceeds remaining daily allowance.
- 429 / rate-limit responses from Gmail are respected with backoff.

### TICKET-011 — Live Progress + Pause / Cancel
**Priority:** MUST · **Depends on:** TICKET-009

**Build:** Live progress UI ("42 of 200 sent") driven by the background queue, with Pause, Resume, and Cancel controls. State updates in real time even if the panel is reopened.

**Acceptance criteria:**
- Progress bar/count updates in near-real-time during send.
- Pause halts after the in-flight send; Resume continues from the same position.
- Cancel stops the queue and records which recipients were not sent.
- Reopening the panel mid-send shows accurate current state.
- Clear final state when the campaign completes.

### TICKET-012 — Error Handling & Retry
**Priority:** MUST · **Depends on:** TICKET-009

**Build:** Capture per-recipient failures (invalid format, API errors, bounces where detectable), categorize them, and expose a one-click "Retry failed" that requeues only the failed recipients. Transient errors (network, 429/5xx) auto-retry with exponential backoff; permanent errors (bad address) are marked non-retryable.

**Acceptance criteria:**
- Each failure is logged with recipient, timestamp, and reason.
- Transient errors auto-retry with backoff; permanent errors do not.
- "Retry failed" requeues only failed rows without resending successes.
- Malformed emails are caught pre-send and separated from send-time failures.
- No duplicate sends result from any retry path.

### TICKET-013 — Send Summary Report
**Priority:** MUST · **Depends on:** TICKET-009, TICKET-012

**Build:** Post-campaign summary showing counts for sent / failed / skipped, a per-recipient status table, and an export (CSV) of results. Persist reports so the user can review past campaigns.

**Acceptance criteria:**
- Accurate sent / failed / skipped totals displayed on completion.
- Per-recipient status table is filterable by status.
- Results exportable as CSV.
- Past campaign reports are viewable from the popup.
- Report clearly distinguishes "sent" from "delivered" (bounces are best-effort in MVP).

## Epic D (done portion)

### TICKET-016 — Scheduled Sending
**Priority:** SHOULD · **Depends on:** TICKET-009 · **Ungated for now** (launch-free; Pro-gate later via TICKET-035)
**Build:** Queue a campaign to start at a future date/time via `chrome.alarms`, on the existing alarm-driven resumable engine (`sendQueue.ts` `schedule`/`unschedule`/`promoteDueScheduled`, pure `partitionDue` + test). Custom gold-themed date+time picker in the Shadow-DOM overlay (no shadcn dep). UX: confirm-gated "Send now instead" (no accidental early send), overlay auto-closes after a "✓ Scheduled" beat, popup live-monitors campaigns and opens a per-campaign report with a live countdown to the scheduled start.
**AC:** ✅ starts at the scheduled time; resumes if the worker slept / browser was closed; cancelable before start; monitorable + reportable from the popup. *Manual Chrome pass done by the user.*

### TICKET-017 — Templates Library
**Priority:** SHOULD · **Depends on:** TICKET-006
**Build:** Save/reuse subject+body templates with tokens. **AC:** save, name, load, edit, delete templates; templates persist locally.
