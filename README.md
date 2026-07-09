# Fanout

Gmail-native personalized bulk sender — a Manifest V3 Chrome extension that sends
**N individual emails** (one discrete `gmail.send` per recipient) from the user's
own Gmail, with per-recipient personalization, throttling, and daily-cap safety.

See [PRD.md](./PRD.md), [ARCHITECTURE.md](./ARCHITECTURE.md),
[SECURITY_AND_ACCESS.md](./SECURITY_AND_ACCESS.md), and
[FRONTEND_SPEC.md](./FRONTEND_SPEC.md) for the full specs.

## Monorepo layout

```
packages/
  shared/      framework-free types, constants, personalization engine, validation
  extension/   the MV3 Chrome extension (React + Vite + CRXJS)
```

(A thin backend package for license/usage/Stripe is described in ARCHITECTURE §4.2
but is **not required for the MVP** — Option A auth keeps everything client-side.)

## Prerequisites

- Node ≥ 20, pnpm ≥ 11

## Install & build

```bash
pnpm install
pnpm build          # → packages/extension/dist (loadable unpacked extension)
pnpm typecheck      # tsc across packages
pnpm test           # vitest across packages
pnpm dev            # Vite dev server with HMR (load dist as unpacked)
```

## Load in Chrome

1. `pnpm build`
2. Visit `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select `packages/extension/dist`.
4. Note the generated **extension ID**.

## One required setup step: Google OAuth client ID

The MVP uses `chrome.identity.getAuthToken` (Option A). To sign in and send you
must supply a Google OAuth **client ID of type "Chrome App"** whose item id
matches your loaded extension id:

1. In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services:
   - Enable the **Gmail API**.
   - Create an OAuth client ID → application type **Chrome App** → enter the
     extension id from the step above.
2. Copy `.env.example` → `.env` and set `VITE_GOOGLE_OAUTH_CLIENT_ID`.
3. Request **only** these scopes (already configured in `manifest.config.ts`):
   `gmail.send`, `openid`, `email`, `profile`.
4. Rebuild. Click **Connect Gmail** in the popup, then **Send test to myself**.

> Google's OAuth verification for the restricted `gmail.send` scope takes weeks —
> start it early (SECURITY_AND_ACCESS §1.4). Until verified, use the app in
> testing mode with allowlisted test users.

### Notes / follow-ups

- **Live end-to-end** (real Gmail sends, compose injection) requires loading the
  built extension in Chrome with a configured OAuth client id — see setup above.
  Logic is covered by unit tests; UI/DOM/OAuth paths need a manual Chrome pass.
- The send engine uses `chrome.alarms` as a resurrection fallback (≈30s min) plus
  an in-worker timer to honor sub-30s throttle delays while the worker is alive.
- Backend (license/usage/Stripe, ARCHITECTURE §4.2) is **not** needed for the MVP
  and is not built — Option A auth keeps everything client-side.

## Architecture notes worth knowing

- **The service worker owns the IndexedDB.** The content-script overlay runs at
  `mail.google.com` origin and cannot touch the extension-origin DB, so all
  campaign/recipient persistence is routed through the worker via a typed message
  channel (`messaging/channel.ts` + `services/dbClient.ts`). Popup/options use the
  same path for consistency.
- **All Gmail DOM selectors live in `content/gmailDom.ts`** — one file to fix when
  Gmail's markup changes; scans degrade gracefully instead of throwing.
- **PII never leaves the browser.** `lib/logger.ts` scrubs emails/names/content.
