# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fanout sends **N individual emails** (one `gmail.send` per recipient) from the
user's own Gmail, with per-recipient personalization, throttling, and daily-cap
safety. It is a personalization tool, not a mass-mailer.

As of **v2.0** (PRD §1.5) it is a **platform**, not just an extension: a Manifest
V3 Chrome extension (the sending tool) **plus a Next.js web app** — marketing site,
user dashboard, operator/admin dashboard, and the backend API routes — with a
**freemium Stripe subscription**. There **is** now a server, but the privacy
boundary is unchanged and load-bearing: **recipient lists and email content never
leave the browser.** The backend stores identity, billing, and counts/scrubbed
metadata only — never a recipient address, name, subject, or body (ARCHITECTURE
§4.2, SECURITY §3). Every new server-side field must pass that test.

Deep specs live in `PRD.md`, `ARCHITECTURE.md`, `SECURITY_AND_ACCESS.md`,
`FRONTEND_SPEC.md`, and `FEATURE_TICKETS.md`. Code comments cite them by section
(e.g. `§7.5`) and by ticket (e.g. `TICKET-009`) — follow those pointers when a
change touches send/auth/security logic.

## Commands

Run from the repo root (pnpm workspaces, Node ≥ 20):

```bash
pnpm build          # → packages/extension/dist (loadable unpacked)
pnpm dev            # Vite + CRXJS dev server with HMR
pnpm typecheck      # tsc --noEmit across all packages
pnpm test           # vitest run across all packages
pnpm lint           # per-package lint
```

Single test file / test: `pnpm --filter @fanout/extension test src/background/engine.test.ts`
or append `-t "name"`. Tests are vitest + jsdom, colocated as `*.test.ts`.

There is no `pnpm start` / live e2e — OAuth, Gmail sends, and Gmail-DOM
injection require loading `dist` unpacked in Chrome with a configured Google
OAuth "Chrome App" client id (see README setup). Logic is unit-tested; those
paths need a manual Chrome pass.

## Monorepo layout

- `packages/shared/` — framework-free, no Chrome APIs. Types, constants
  (send limits, tokens), the `{{Token|fallback}}` personalization engine, email
  validation. Imported as `@fanout/shared`. Safe to unit-test in isolation.
- `packages/extension/` — the MV3 extension (React 18 + Vite + CRXJS + Tailwind).

The manifest is generated from `packages/extension/manifest.config.ts` (not a
static `manifest.json`) — edit permissions, scopes, and content-script matches
there. The OAuth client id is injected from `VITE_GOOGLE_OAUTH_CLIENT_ID`.

The service worker (`src/background/index.ts`) imports `./sendQueue`
**statically**, never via `await import()`. Two reasons: (1) a dynamic import
routes through Vite's `__vitePreload` helper, which touches `window`/`document`
(absent in a SW) and throws — killing SW registration; (2) `sendQueue`'s
top-level `chrome.alarms` listener must register synchronously on worker load,
or it misses the alarm that woke the worker. Keep engine imports static.

## Architecture — the three contexts and one rule

The extension runs in three isolated JS contexts that cannot share memory:

1. **Service worker** (`src/background/`) — owns the send engine, auth, and the
   IndexedDB. Can die and be revived at any time.
2. **Content script + overlay** (`src/content/`, `src/ui/overlay/`) — runs at
   `mail.google.com` origin, injects the "Bulk Personalize" button and a
   Shadow-DOM React overlay.
3. **Popup / options** (`src/ui/popup/`, `src/ui/options/`) — extension-origin
   pages.

**The one rule: the service worker owns the IndexedDB.** The overlay lives at
`mail.google.com` origin and *cannot* touch the extension-origin DB. So **all**
persistence and privileged actions go through the worker over one typed
request/reply protocol. Never call Dexie (`src/db/`) or Gmail directly from UI
code — go through the channel.

- `src/messaging/channel.ts` is the single source of truth for that protocol:
  the `Request` union, the `ResponseMap`, and `sendToWorker()` / `onBroadcast()`
  / `broadcast()`. Add a new worker operation by extending `Request` +
  `ResponseMap`, then handling it in `src/background/index.ts`'s `handle()`
  switch (which is `never`-exhaustive — the compiler enforces coverage).
- Zustand stores (`src/store/`) are thin UI-side wrappers that call
  `sendToWorker` and subscribe to `PROGRESS` / `AUTH_CHANGED` broadcasts.

## The send engine (`src/background/sendQueue.ts`)

The most load-bearing and subtle code. Read `ARCHITECTURE §7` before changing it.

- **The DB is the state machine.** Each `tick()` reads the next `pending`
  recipient, sends it, records the outcome, and schedules the next tick. All
  state is in IndexedDB, so a worker death mid-run resumes exactly where it left
  off. `resumeSending()` runs on worker wake and browser startup.
- **No double-sends:** a recipient is claimed inside a `rw` transaction that
  only proceeds if it's still `pending` (`§7.5`). The in-memory `ticking` flag is
  a belt; the transaction is the guarantee.
- **Dual scheduling:** Chrome clamps `chrome.alarms` to ~30s, but throttle
  delays are usually shorter. So `scheduleTick()` sets **both** a `setTimeout`
  (honors the real sub-30s delay while the worker is alive) **and** an alarm
  (`ALARM_MIN_MS` ≈ 31s, resurrects a dead worker). Keep both in sync.
- **Error buckets drive everything.** `gmailClient.ts` classifies every failure
  into `transient` (retry w/ backoff), `permanent` (mark failed, continue),
  `account` (403 — **STOP the whole campaign**, protecting the user's Gmail is
  paramount), or `auth` (pause, reconnect). `sendOne()` branches on the bucket.
- **Daily cap** is checked before any network call; on hit the campaign pauses
  and an `ALARM_RESUME` is set for next local midnight.

## Conventions that matter

- **All Gmail DOM selectors live in `src/content/gmailDom.ts`.** One file to fix
  when Gmail's markup changes; scans degrade gracefully (return null) instead of
  throwing.
- **PII never leaves the browser and never hits logs.** Use `src/lib/logger.ts`,
  which scrubs emails/names/content. Don't `console.log` recipient data.
- **Imported values are untrusted.** The personalization renderer HTML-escapes
  every substituted value (`SECURITY_AND_ACCESS §5.2`). A token that resolves
  empty with no fallback is reported in `missing` so the UI blocks the send —
  never leak a literal `{{Token}}` into an email.
- TypeScript is `strict` + `noUncheckedIndexedAccess` +
  `noFallthroughCasesInSwitch`. Prefer exhaustive `switch` with a `never`
  default over partial handling.
