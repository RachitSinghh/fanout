# Technical Architecture Document

## Project: Fanout — Gmail-Native Personalized Bulk Sender (Chrome Extension)

**Author:** Senior Software Architect
**Status:** v1.0 — for MVP build
**Last Updated:** July 9, 2026
**Companion doc:** [PRD.md](./PRD.md)

---

## 0. TL;DR / Executive Summary

Fanout is a **Manifest V3 Chrome extension** that injects UI into Gmail, imports a recipient list, and sends **N individual emails** through the user's own Gmail account using the **Gmail REST API (`gmail.send`)** — one discrete SMTP send per recipient, throttled to protect deliverability.

The architecture is deliberately **client-heavy, backend-light**:

- **All recipient data and campaign state lives locally** in the browser (IndexedDB). This is not just an implementation detail — it is the product's privacy story and de-risks GDPR/CAN-SPAM exposure. Recipient PII never touches our servers in V1.
- **A thin backend exists only for what the client genuinely cannot do securely or durably:** OAuth token exchange, license/subscription validation (Stripe), and usage metering for freemium enforcement.
- **Sending happens entirely on the client**, directly from the extension's service worker to Google's Gmail API. We are never in the mail path.

This keeps us cheap to operate, fast to ship, defensible on privacy, and — critically — keeps the sending relationship strictly between the user and Google, which is the core deliverability value proposition.

---

## 1. Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                            │
│                                                                    │
│  ┌────────────────────┐      ┌──────────────────────────────────┐ │
│  │  Gmail Web (tab)   │      │      Fanout Chrome Extension     │ │
│  │                    │      │                                  │ │
│  │  ┌──────────────┐  │◄────►│  Content Script                  │ │
│  │  │ Compose win. │  │inject│   • injects "Bulk Personalize"   │ │
│  │  │ [Bulk Pers.] │  │  UI  │   • mounts React overlay         │ │
│  │  └──────────────┘  │      │                                  │ │
│  └────────────────────┘      │  Popup / Options (React)         │ │
│                              │   • dashboard, settings, auth    │ │
│                              │                                  │ │
│                              │  Service Worker (MV3 background) │ │
│                              │   • send queue engine            │ │
│                              │   • throttle + retry + limits    │ │
│                              │   • Gmail API calls              │ │
│                              │                                  │ │
│                              │  IndexedDB (Dexie)               │ │
│                              │   • campaigns, recipients, logs  │ │
│                              └──────────────────────────────────┘ │
└───────────────┬───────────────────────────────┬──────────────────┘
                │                                 │
   (1) send email (access token)     (2) auth exchange, license,
                │                          usage metering
                ▼                                 ▼
   ┌────────────────────────┐      ┌────────────────────────────────┐
   │   Google Gmail API      │      │      Fanout Backend (thin)     │
   │   • users.messages.send │      │  • /auth token exchange        │
   │   • OAuth 2.0           │      │  • /license validate           │
   └────────────────────────┘      │  • /usage report               │
                                    │  • Stripe webhooks             │
                                    │        │                       │
                                    │        ▼                       │
                                    │   PostgreSQL                   │
                                    └────────────────────────────────┘
```

**Key principle:** the arrow that carries email content (1) goes **directly from the browser to Google**. Our backend (2) only ever sees identity, license status, and aggregate counts — never recipients or email bodies.

---

## 2. Recommended Tech Stack (with reasoning)

### 2.1 Chrome Extension (the product)

| Layer | Choice | Why this, not the alternative |
|---|---|---|
| **Extension platform** | **Manifest V3** | Mandatory — Chrome Web Store no longer accepts MV2. Forces us onto a service worker background model (ephemeral, event-driven), which shapes the whole send-queue design (see §7). |
| **Language** | **TypeScript (strict)** | Gmail API payloads, CSV rows, and campaign state are all structured data with sharp edges (MIME encoding, token maps, quota errors). Types catch these at build time. Non-negotiable for a data-processing app. |
| **UI framework** | **React 18** | Three surfaces (injected overlay, popup, options page) share components (recipient table, token editor, preview). React's component reuse + mature ecosystem wins. The injected overlay mounts into a Shadow DOM to avoid Gmail's CSS bleeding in. |
| **Build tool** | **Vite + `@crxjs/vite-plugin`** | CRXJS is purpose-built for MV3: HMR for content scripts, auto-generates the manifest from a TS config, handles the multi-entry-point build (worker + popup + content). Far less friction than hand-rolling Webpack. |
| **Styling** | **Tailwind CSS** (scoped) + Shadow DOM | Utility CSS keeps styling local and predictable. Injecting into Gmail means we **must** isolate styles — a Shadow DOM root for the overlay prevents Gmail's stylesheet from clobbering ours and vice versa. |
| **State management** | **Zustand** | Lightweight, no boilerplate, works cleanly across React + plain service-worker code. Redux is overkill; Context alone won't cross the worker boundary. State that must survive worker restarts is persisted to IndexedDB, not held in memory. |
| **Local database** | **IndexedDB via `Dexie.js`** | Recipient lists can be thousands of rows with per-row send status — too much for `chrome.storage.local` (which is slow and size-capped). Dexie gives us indexed queries, transactions, and a clean async API over IndexedDB. |
| **CSV parsing** | **PapaParse** | Battle-tested, streams large files, handles quoting/encoding edge cases and messy real-world spreadsheets. Do not hand-roll CSV parsing. |
| **MIME construction** | **Hand-rolled RFC 2822 builder** (small util) | Gmail's `messages.send` wants a base64url-encoded RFC 2822 message. A tiny, tested helper (headers + body + optional attachments, proper UTF-8/quoted-printable encoding) is more predictable than pulling in a heavy Node-oriented mail library that assumes an SMTP transport. |
| **Testing** | **Vitest** (unit) + **Playwright** (E2E against a Gmail-like fixture) | Vitest pairs natively with Vite. Playwright can drive the extension in a real Chromium context to test injection and the send flow end-to-end. |

### 2.2 Backend (thin control plane)

| Layer | Choice | Why this, not the alternative |
|---|---|---|
| **Runtime / language** | **Node.js + TypeScript** | Share types (`packages/shared`) with the extension — the auth and license contracts are defined once. One language across the monorepo lowers cognitive load for a small team. |
| **Web framework** | **Hono** (or Fastify) | The backend has ~6 endpoints. Hono is tiny, fast, runs anywhere (Node, edge, Cloud Run), and has first-class TS. Fastify is the equally-good "boring" choice if the team prefers a batteries-included Node server. Avoid Express — unmaintained middleware and weaker types. |
| **Database** | **PostgreSQL** | Relational data (users → subscriptions → usage), strong consistency for billing, ubiquitous hosting. No reason to reach for anything exotic at this scale. |
| **ORM** | **Prisma** | Type-safe queries, painless migrations, generated client shared with the app's type layer. Excellent DX for a small backend. |
| **Auth token exchange** | **Google OAuth 2.0 code flow** on the server | The refresh token and (if used) client secret must never ship in the extension bundle — anything in an extension is publicly readable. The server holds the secret and mints/refreshes tokens. (See §5 for the exact flow and the simpler `getAuthToken` alternative.) |
| **Billing** | **Stripe** (Checkout + Billing + webhooks) | Industry standard for SaaS subscriptions, handles tax/SCA/dunning. Checkout is a hosted page — no card data ever touches us. Webhooks are the source of truth for subscription state. |
| **Secrets / encryption** | **Cloud KMS or libsodium sealed boxes** | Refresh tokens at rest must be encrypted with a key that is not in the DB. |
| **Hosting** | **Google Cloud Run** (or Fly.io / Render) | Scales to zero, cheap at MVP volume, container-based so no lock-in. Cloud Run pairs naturally with the Google OAuth/Gmail dependency. |
| **Managed Postgres** | **Supabase** or **Neon** | Both give managed Postgres with generous free tiers and easy branching. Neon's scale-to-zero fits our spiky, low-baseline load. |

### 2.3 Cross-cutting

| Concern | Choice | Why |
|---|---|---|
| **Monorepo tooling** | **pnpm workspaces + Turborepo** | Extension, backend, and shared types in one repo with shared build caching. pnpm's strict, disk-efficient linking suits a workspace. |
| **Linting/format** | **ESLint + Prettier** (or Biome) | Standard. Biome is a faster single-tool alternative if the team wants it. |
| **Error monitoring** | **Sentry** (extension + backend) | Send failures and Gmail quota errors in the wild are the #1 support surface. You need real telemetry, scrubbed of recipient PII, from day one. |
| **CI/CD** | **GitHub Actions** | Build + test on PR; on tag, build the extension `.zip` for Chrome Web Store upload and deploy the backend container. |

---

## 3. Complete File & Folder Structure

A **pnpm monorepo** with three packages: the extension, the backend, and a shared contracts package.

```
fanout/
├── PRD.md
├── ARCHITECTURE.md
├── README.md
├── package.json                      # workspace root, scripts
├── pnpm-workspace.yaml
├── turbo.json                        # Turborepo pipeline
├── tsconfig.base.json                # shared TS config
├── .env.example                      # documented env vars (see §6)
├── .github/
│   └── workflows/
│       ├── ci.yml                    # lint + typecheck + test on PR
│       ├── release-extension.yml     # build .zip, upload to Web Store
│       └── deploy-backend.yml        # build image, deploy to Cloud Run
│
├── packages/
│   │
│   ├── shared/                       # ── shared, framework-free code ──
│   │   ├── package.json
│   │   └── src/
│   │       ├── types/
│   │       │   ├── campaign.ts        # Campaign, Recipient, SendLog types
│   │       │   ├── auth.ts            # token & session contracts
│   │       │   ├── license.ts         # plan tiers, entitlements
│   │       │   └── api.ts             # backend request/response shapes
│   │       ├── constants/
│   │       │   ├── sendLimits.ts      # Gmail daily caps, plan caps
│   │       │   └── tokens.ts          # personalization token regex/spec
│   │       ├── personalization/
│   │       │   ├── parse.ts           # extract {{Tokens}} from a body
│   │       │   └── render.ts          # fill tokens for one recipient
│   │       └── validation/
│   │           └── email.ts           # RFC-lite email format validation
│   │
│   ├── extension/                    # ── the Chrome extension ──
│   │   ├── package.json
│   │   ├── vite.config.ts             # CRXJS config
│   │   ├── manifest.config.ts         # MV3 manifest (typed, via CRXJS)
│   │   ├── tailwind.config.ts
│   │   ├── public/
│   │   │   └── icons/                 # 16/32/48/128 px extension icons
│   │   └── src/
│   │       ├── background/            # ── MV3 service worker ──
│   │       │   ├── index.ts           # worker entry, message router
│   │       │   ├── sendQueue.ts       # the send engine (see §7)
│   │       │   ├── throttle.ts        # inter-send delay + jitter
│   │       │   ├── rateLimiter.ts     # daily cap tracking
│   │       │   ├── retry.ts           # backoff + retry classification
│   │       │   ├── gmailClient.ts     # Gmail API wrapper
│   │       │   └── alarms.ts          # chrome.alarms for durable resume
│   │       │
│   │       ├── content/               # ── injected into Gmail ──
│   │       │   ├── index.ts           # content-script entry
│   │       │   ├── injectButton.ts    # add "Bulk Personalize" to compose
│   │       │   ├── gmailDom.ts        # Gmail DOM selectors + observers
│   │       │   └── OverlayRoot.tsx    # Shadow-DOM React mount point
│   │       │
│   │       ├── ui/                    # ── shared React UI ──
│   │       │   ├── popup/
│   │       │   │   ├── index.html
│   │       │   │   ├── main.tsx
│   │       │   │   └── Popup.tsx      # dashboard, recent campaigns
│   │       │   ├── options/
│   │       │   │   ├── index.html
│   │       │   │   ├── main.tsx
│   │       │   │   └── Options.tsx    # account, plan, defaults
│   │       │   └── components/
│   │       │       ├── RecipientTable.tsx
│   │       │       ├── CsvImporter.tsx
│   │       │       ├── ColumnMapper.tsx      # CSV cols → tokens
│   │       │       ├── TokenEditor.tsx
│   │       │       ├── PreviewPane.tsx        # 2–3 sample renders
│   │       │       ├── SendOptions.tsx        # delay, daily cap
│   │       │       ├── ProgressBar.tsx        # live "42 of 200"
│   │       │       └── SummaryReport.tsx
│   │       │
│   │       ├── store/                 # ── Zustand stores ──
│   │       │   ├── campaignStore.ts
│   │       │   ├── authStore.ts
│   │       │   └── sendStatusStore.ts
│   │       │
│   │       ├── db/                    # ── Dexie (IndexedDB) ──
│   │       │   ├── schema.ts          # table definitions & indexes
│   │       │   ├── campaigns.ts       # CRUD helpers
│   │       │   └── migrations.ts
│   │       │
│   │       ├── services/
│   │       │   ├── authService.ts     # OAuth via chrome.identity + backend
│   │       │   ├── licenseService.ts  # plan/entitlement checks
│   │       │   ├── csvService.ts      # PapaParse wrapper
│   │       │   └── mimeBuilder.ts     # RFC 2822 → base64url
│   │       │
│   │       ├── messaging/
│   │       │   └── channel.ts         # typed content⇄worker⇄ui messages
│   │       │
│   │       └── lib/
│   │           ├── config.ts          # env-injected constants
│   │           └── logger.ts          # Sentry + console, PII-scrubbed
│   │
│   └── backend/                      # ── thin control-plane API ──
│       ├── package.json
│       ├── src/
│       │   ├── index.ts               # Hono app bootstrap
│       │   ├── routes/
│       │   │   ├── auth.ts            # POST /auth/exchange, /auth/refresh
│       │   │   ├── license.ts        # GET  /license
│       │   │   ├── usage.ts          # POST /usage  (report sent count)
│       │   │   └── stripe.ts         # POST /webhooks/stripe
│       │   ├── services/
│       │   │   ├── googleOAuth.ts     # code→token exchange & refresh
│       │   │   ├── tokenCrypto.ts     # encrypt/decrypt refresh tokens
│       │   │   ├── entitlements.ts    # plan → limits mapping
│       │   │   └── stripeService.ts
│       │   ├── middleware/
│       │   │   ├── requireSession.ts  # verify Google ID token
│       │   │   └── rateLimit.ts
│       │   ├── db/
│       │   │   └── client.ts          # Prisma client singleton
│       │   └── lib/
│       │       └── env.ts             # zod-validated env loading
│       └── prisma/
│           ├── schema.prisma          # backend DB schema (see §4.2)
│           └── migrations/
│
└── docs/
    ├── oauth-verification.md          # Google review checklist & assets
    ├── privacy-policy.md              # required for gmail.send scope
    └── send-limits.md                 # per-plan / per-account caps
```

---

## 4. Database Schema (plain-English)

There are **two separate stores**, and the split is intentional (see §0):

- **A. Local store (IndexedDB / Dexie)** — everything with recipient PII and campaign content. Lives only in the user's browser.
- **B. Backend store (PostgreSQL / Prisma)** — identity, billing, and aggregate usage only. No recipients, no email bodies.

### 4.1 Local Store (IndexedDB — the operational data)

#### Table: `campaigns`
One row per bulk-send the user creates. This is the parent record for a "run."

| Field | Type | Plain-English meaning |
|---|---|---|
| `id` | string (UUID) | Unique id for this campaign. |
| `name` | string | Human label, e.g. "July investor outreach." Auto-derived from the subject if the user doesn't name it. |
| `subject` | string | The email subject line, may contain `{{Tokens}}`. |
| `bodyHtml` | string | The email body as HTML, with `{{Tokens}}` placeholders unfilled. |
| `bodyText` | string | Plain-text fallback version of the body (for the multipart message). |
| `fromEmail` | string | The Gmail address this will send from (the authenticated account). |
| `tokenSchema` | string[] | The list of token names detected in subject+body, e.g. `["FirstName","Company"]`. Used to validate the recipient mapping. |
| `status` | enum | Lifecycle: `draft` → `ready` → `sending` → `paused` → `completed` → `failed` / `cancelled`. |
| `sendDelayMs` | number | Configured delay between individual sends (throttle). |
| `dailyCap` | number | Max sends per calendar day for this campaign (bounded by the account/plan limit). |
| `totalRecipients` | number | Denormalized count for fast progress display. |
| `sentCount` | number | Running count of successful sends (denormalized from `recipients`). |
| `failedCount` | number | Running count of permanent failures. |
| `createdAt` / `updatedAt` | number (epoch ms) | Timestamps. |
| `completedAt` | number \| null | When the run finished. |

#### Table: `recipients`
One row per person in a campaign. This is the biggest table (can be thousands of rows).

| Field | Type | Plain-English meaning |
|---|---|---|
| `id` | string (UUID) | Unique id for this recipient row. |
| `campaignId` | string (FK → `campaigns.id`) | Which campaign this recipient belongs to. **Indexed** for fast per-campaign queries. |
| `email` | string | Recipient's email address. **Indexed** (used for dedupe within a campaign). |
| `fields` | object (JSON) | All imported column data as key→value, e.g. `{ FirstName: "Sam", Company: "Acme" }`. This is what fills the personalization tokens. |
| `status` | enum | `pending` → `sending` → `sent` → `failed` → `skipped`. **Indexed** — the send engine queries "next pending for campaign X." |
| `attempts` | number | How many send attempts have been made (for retry/backoff). |
| `lastError` | string \| null | The error message/code from the most recent failed attempt. |
| `gmailMessageId` | string \| null | Gmail's returned message id on success (proof of send; enables future reply/thread features). |
| `sentAt` | number \| null | When this individual email was sent. |

**Relationship:** `campaigns` 1 —— many `recipients` (via `campaignId`). Deleting a campaign cascades to its recipients (handled in app code inside a Dexie transaction).

#### Table: `sendLogs`
An append-only audit trail of every send attempt — separate from `recipients` so we keep full history even after retries overwrite a recipient's `status`.

| Field | Type | Plain-English meaning |
|---|---|---|
| `id` | string (UUID) | Log entry id. |
| `campaignId` | string (FK) | Campaign this attempt belongs to. **Indexed.** |
| `recipientId` | string (FK) | Recipient this attempt targeted. |
| `attemptNumber` | number | 1 for first try, 2+ for retries. |
| `outcome` | enum | `success` \| `transient_error` \| `permanent_error` \| `rate_limited`. |
| `httpStatus` | number \| null | Gmail API HTTP status, if any (e.g. 429, 403, 200). |
| `errorCode` | string \| null | Parsed Gmail error reason (e.g. `rateLimitExceeded`, `invalidArgument`). |
| `timestamp` | number | When the attempt happened. |

#### Table: `sendCounters`
Tracks how many emails have been sent per account per day, so we can enforce the daily cap **even across separate campaigns and browser restarts**.

| Field | Type | Plain-English meaning |
|---|---|---|
| `id` | string | Composite key: `<accountEmail>:<YYYY-MM-DD>`. |
| `accountEmail` | string | The sending Gmail account. |
| `date` | string | The calendar day (account's local day). |
| `count` | number | Emails successfully sent from this account on this day. |

> **Why local counters and not just the backend?** The daily cap is a *safety* feature that must work offline and instantly, before any network round-trip. The backend counter (§4.2 `usage_records`) is the billing/entitlement source of truth; the local counter is the real-time guardrail. They reconcile opportunistically.

#### Table: `settings` (single-row key/value)
User preferences: default send delay, default daily cap, last-used column mappings, onboarding flags, cached auth/session pointer (not the token itself — see §5).

### 4.2 Backend Store (PostgreSQL — identity, billing, metering)

> **Contains no recipient data and no email content.** If this database leaked, no end-recipient's information would be exposed.

#### Table: `users`
One row per Fanout user (identified by their Google account).

| Field | Type | Plain-English meaning |
|---|---|---|
| `id` | UUID (PK) | Internal user id. |
| `google_sub` | string (unique) | The stable Google account identifier (`sub` claim from the ID token). This is how we recognize a returning user. |
| `email` | string | The user's Gmail address (their own, not recipients'). Used for support and Stripe. |
| `created_at` / `updated_at` | timestamptz | Timestamps. |
| `last_seen_at` | timestamptz | Last time the extension checked in. |

#### Table: `google_tokens`
Stores the encrypted OAuth refresh token so the backend can mint fresh access tokens for long-running sends. (Omitted entirely if you choose the `chrome.identity.getAuthToken` approach — see §5.)

| Field | Type | Plain-English meaning |
|---|---|---|
| `id` | UUID (PK) | Row id. |
| `user_id` | UUID (FK → `users.id`, unique) | Owner. One token record per user. |
| `refresh_token_encrypted` | bytea | The Google refresh token, **encrypted at rest** with a KMS/libsodium key held outside the DB. |
| `scopes` | text[] | Granted OAuth scopes (should include `gmail.send`). |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

**Relationship:** `users` 1 —— 1 `google_tokens`.

#### Table: `subscriptions`
One row per user's billing relationship with us (via Stripe).

| Field | Type | Plain-English meaning |
|---|---|---|
| `id` | UUID (PK) | Row id. |
| `user_id` | UUID (FK → `users.id`) | Which user this subscription belongs to. **Indexed.** |
| `stripe_customer_id` | string | Stripe's customer id. |
| `stripe_subscription_id` | string \| null | Stripe's subscription id (null while on the free plan). |
| `plan` | enum | `free` \| `pro` \| `team` — determines send limits and features. |
| `status` | enum | `active` \| `trialing` \| `past_due` \| `canceled`. Mirrors Stripe's subscription status via webhooks. |
| `current_period_end` | timestamptz \| null | When the current paid period ends (for grace handling). |
| `created_at` / `updated_at` | timestamptz | Timestamps. |

**Relationship:** `users` 1 —— 1 `subscriptions` (a user has exactly one current plan; historical changes are captured via Stripe + webhook events, not a second row).

#### Table: `usage_records`
Aggregate send counts reported by the extension, used to enforce freemium quotas. **Counts only — never who was emailed.**

| Field | Type | Plain-English meaning |
|---|---|---|
| `id` | UUID (PK) | Row id. |
| `user_id` | UUID (FK → `users.id`) | Whose usage. **Indexed with `period`.** |
| `period` | string | Billing/usage window, e.g. `2026-07` (month) or a date for daily tracking. |
| `sent_count` | integer | Number of emails the user reports having successfully sent in this period. |
| `updated_at` | timestamptz | Last time the extension reported in. |

**Relationship:** `users` 1 —— many `usage_records` (one per period).

#### Table: `webhook_events` (idempotency ledger)
Records processed Stripe event ids so a re-delivered webhook is never applied twice.

| Field | Type | Plain-English meaning |
|---|---|---|
| `id` | string (PK) | Stripe's event id (`evt_...`). |
| `type` | string | Event type, e.g. `customer.subscription.updated`. |
| `processed_at` | timestamptz | When we handled it. |

### 4.3 Prisma schema (backend, ready to drop in)

```prisma
// packages/backend/prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Plan            { free  pro  team }
enum SubStatus       { active trialing past_due canceled }

model User {
  id            String        @id @default(uuid())
  googleSub     String        @unique @map("google_sub")
  email         String
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt      @map("updated_at")
  lastSeenAt    DateTime?     @map("last_seen_at")
  googleToken   GoogleToken?
  subscription  Subscription?
  usageRecords  UsageRecord[]
  @@map("users")
}

model GoogleToken {
  id                     String   @id @default(uuid())
  userId                 String   @unique @map("user_id")
  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokenEncrypted  Bytes    @map("refresh_token_encrypted")
  scopes                 String[]
  createdAt              DateTime @default(now()) @map("created_at")
  updatedAt              DateTime @updatedAt      @map("updated_at")
  @@map("google_tokens")
}

model Subscription {
  id                   String    @id @default(uuid())
  userId               String    @unique @map("user_id")
  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  stripeCustomerId     String    @map("stripe_customer_id")
  stripeSubscriptionId String?   @map("stripe_subscription_id")
  plan                 Plan      @default(free)
  status               SubStatus @default(active)
  currentPeriodEnd     DateTime? @map("current_period_end")
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt      @map("updated_at")
  @@index([userId])
  @@map("subscriptions")
}

model UsageRecord {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  period    String
  sentCount Int      @default(0) @map("sent_count")
  updatedAt DateTime @updatedAt @map("updated_at")
  @@unique([userId, period])
  @@map("usage_records")
}

model WebhookEvent {
  id          String   @id
  type        String
  processedAt DateTime @default(now()) @map("processed_at")
  @@map("webhook_events")
}
```

---

## 5. Authentication Flow (the trickiest V1 decision)

You have two viable paths for getting a `gmail.send` access token. Pick based on how you'll handle long-running sends.

### Option A — `chrome.identity.getAuthToken` (simpler; recommended for MVP)
- Gmail-only (which V1 is), Google-managed, **no client secret and no backend token storage**.
- The manifest declares the OAuth2 client id and scopes; `getAuthToken` returns a short-lived access token, cached and silently re-issued by Chrome.
- The `google_tokens` table and `/auth/*` endpoints become unnecessary; the backend identifies the user via the Google **ID token** only.
- **Trade-off:** tokens are short-lived and tied to an interactive Chrome profile. Fine because our send engine runs *in that same browser* while the user is present. Good enough for MVP.

### Option B — Server-side OAuth code flow (more robust; consider post-MVP)
1. Extension opens Google consent via `chrome.identity.launchWebAuthFlow`, receives an **auth code**.
2. Code is POSTed to `POST /auth/exchange`. The **backend** (holding the client secret) exchanges it for access + refresh tokens, encrypts and stores the refresh token (`google_tokens`), returns a short-lived access token + a Fanout session.
3. When the access token expires mid-campaign, the extension calls `POST /auth/refresh` and the backend mints a new one from the stored refresh token.
- **Trade-off:** more moving parts and the sensitive job of storing refresh tokens — but enables future server-side/scheduled sending. Don't build this until scheduling (a post-MVP feature) actually requires it.

> **Recommendation:** ship **Option A** for the MVP (send happens live, in-browser, with the user present — exactly its sweet spot). Keep the `/auth/*` routes and `google_tokens` table in the schema as the documented upgrade path for when scheduled sending arrives.

**Regardless of option:** starting **Google's OAuth app verification** for the restricted `gmail.send` scope is on the critical path. It requires a published privacy policy, a homepage, a ToS, and possibly a third-party security assessment, and can take **several weeks**. Begin it in parallel with design, as the PRD's risk section flags.

---

## 6. Environment Variables & Configuration

Copy `.env.example` and fill per environment. **Never commit real secrets.** Anything bundled into the extension is world-readable — only the *public* OAuth client id and the *public* backend URL may live there; all secrets stay on the backend.

### Extension (`packages/extension`) — build-time, via Vite `import.meta.env`
| Variable | Example | Notes |
|---|---|---|
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | Public. OAuth client of type **"Chrome App"** (must match the extension id). |
| `VITE_BACKEND_URL` | `https://api.fanout.app` | Public. Base URL for license/usage calls. |
| `VITE_SENTRY_DSN` | `https://xxx@sentry.io/123` | Public DSN is fine; scrub PII before sending events. |
| `VITE_ENV` | `production` \| `staging` \| `development` | Toggles verbose logging and mock endpoints. |

Also configured in the manifest (not `.env`): `oauth2.scopes` = `["https://www.googleapis.com/auth/gmail.send", "openid", "email", "profile"]`, and `host_permissions` = `["https://mail.google.com/*"]`. Keep the scope list **minimal** — every extra scope lengthens Google's review.

### Backend (`packages/backend`) — runtime secrets, zod-validated at boot
| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | Postgres connection string (Neon/Supabase). |
| `GOOGLE_OAUTH_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | The **web** OAuth client (only if using Option B). |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `GOCSPX-...` | **Secret.** Server-only. Option B only. |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://api.fanout.app/auth/callback` | Must match Google console config. Option B only. |
| `TOKEN_ENCRYPTION_KEY` | `base64 32-byte key` | **Secret.** Encrypts refresh tokens at rest; ideally sourced from KMS, not an env literal. |
| `STRIPE_SECRET_KEY` | `sk_live_...` | **Secret.** Server-side Stripe calls. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | **Secret.** Verifies webhook signatures — reject unverified events. |
| `STRIPE_PRICE_PRO` / `STRIPE_PRICE_TEAM` | `price_...` | Stripe Price ids per plan. |
| `SESSION_JWT_SECRET` | `base64 random` | **Secret.** Signs Fanout session tokens. |
| `ALLOWED_ORIGIN` | `chrome-extension://<id>` | CORS allowlist — only our extension may call the API. |
| `SENTRY_DSN` | `https://...` | Backend error monitoring. |
| `PORT` | `8080` | Cloud Run injects this; default for local. |

### Configuration constants (in code, `packages/shared/constants`)
| Constant | Suggested value | Notes |
|---|---|---|
| Consumer Gmail daily cap | `500` | Free Gmail's approximate send ceiling. **Auto-detect account type and set accordingly.** |
| Workspace daily cap | `2000` | Google Workspace accounts. |
| Default inter-send delay | `8–30s` with jitter | Deliverability guardrail; randomized to avoid a mechanical cadence. |
| Free plan monthly quota | *decide before launch* | PRD open question #1 — must be locked before public launch to avoid retroactive backlash. |
| Retry policy | 3 attempts, exponential backoff | For transient (5xx / `rateLimitExceeded`) errors only; never retry permanent (`invalidArgument`) errors. |

---

## 7. Key Architectural Considerations & Risks

### 7.1 The send engine must survive MV3 service-worker death (highest-risk area)
MV3 service workers are **ephemeral** — Chrome kills them after ~30s of inactivity, mid-campaign. A naive `for` loop over recipients will simply stop. The engine must therefore be:
- **State-machine driven, not loop-driven.** Each "tick" reads the next `pending` recipient from IndexedDB, sends it, records the outcome, then schedules the next tick.
- **Woken by `chrome.alarms`,** not `setTimeout`. Alarms persist across worker restarts; `setTimeout` does not. The inter-send delay becomes the alarm interval.
- **Fully resumable.** Because campaign/recipient/counter state is all in IndexedDB, the worker can be torn down and revived at any point and resume exactly where it left off. On worker startup, it checks for any campaign in `sending` status and re-arms the alarm.

This design *also* delivers pause/cancel and daily-cap-spanning-days almost for free — they're just state transitions the tick loop respects.

### 7.2 Deliverability & throttling are product-critical, not cosmetic
Even individually-sent emails at volume trigger Gmail's own spam heuristics on the *sending* account (PRD risk). Mitigations baked into the architecture:
- Randomized inter-send delay (jitter) so the cadence isn't mechanical.
- Hard daily caps derived from account type, enforced by the local `sendCounters` before any network call.
- Stop-and-warn (don't silently fail) when approaching the account's ceiling — protecting the user's Gmail account is a trust-and-safety obligation.

### 7.3 Gmail DOM injection is inherently fragile
Gmail's DOM is obfuscated and changes without notice. Isolate this risk:
- Confine all Gmail selectors to `content/gmailDom.ts` — one file to fix when Gmail changes.
- Use `MutationObserver` to detect compose windows opening (they're created dynamically), not one-time queries.
- Mount our UI in a **Shadow DOM** so Gmail's CSS/JS can't interfere with ours and vice versa.
- Consider evaluating the community **InboxSDK** library as an insulation layer, at the cost of an external dependency.

### 7.4 Privacy posture is a feature, defend it
Keeping recipient PII and email bodies exclusively client-side is what lets us make a strong privacy claim, shortens Google's OAuth review, and keeps GDPR/CAN-SPAM surface minimal (PRD explicitly defers compliance tooling). **Do not** casually add server-side recipient storage for a "nice to have" — it would undermine the core value prop. Open/click tracking (post-MVP) is the one feature that will require server infrastructure (a pixel/redirect endpoint + an events table); design that as an explicitly opt-in, isolated subsystem when the time comes.

### 7.5 Idempotency for both sends and billing
- **Sends:** before sending to a recipient, re-check their status is still `pending` inside the transaction — prevents double-sends if the worker restarts between "send" and "record success."
- **Billing:** the `webhook_events` ledger guarantees a re-delivered Stripe event is applied once. Webhooks — not client claims — are the source of truth for plan status.

### 7.6 Build/ship pipeline realities
- The Chrome Web Store review adds latency to every release — batch changes, keep a fast-rollback story (the store lets you re-publish a prior version).
- Extension code is public; treat the bundle as readable by competitors and attackers alike. No secrets, no clever obfuscation-as-security.

---

## 8. Suggested Build Sequence (dependency-ordered)

1. **Scaffold monorepo** (pnpm + Turbo), shared types, empty extension + backend, CI.
2. **OAuth (Option A) + account detection** — get a `gmail.send` token in hand; **kick off Google verification now** (long pole).
3. **MIME builder + single-send** — send exactly one personalized email via Gmail API. Prove the core primitive.
4. **CSV import → recipients in IndexedDB → column mapping → preview.**
5. **Send engine** (alarms-based state machine) with throttle, daily caps, retry, progress, pause/cancel. *This is the hardest part — budget accordingly.*
6. **Gmail compose injection** (Shadow DOM overlay, "Bulk Personalize" button).
7. **Summary report + error surfacing.**
8. **Backend: license + usage + Stripe** for freemium enforcement (can run partly in parallel from step 1).
9. **Harden:** Sentry, PII scrubbing, E2E tests, real-world deliverability testing at varied send rates.

---

*This architecture intentionally optimizes for MVP speed, low operating cost, and a defensible privacy story. Revisit §5 (auth) and §7.4 (privacy) before adding scheduled sending or tracking, as both push work back toward the server.*
