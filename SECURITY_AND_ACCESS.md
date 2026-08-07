# Security & Access Document

## Project: Fanout — Gmail-Native Personalized Bulk Sender (Chrome Extension)

**Author:** Security Engineer (early-stage product security)
**Status:** v2.0 — platform build (extends the v1.0 MVP security model)
**Last Updated:** August 6, 2026
**Companion docs:** [PRD.md](./PRD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [FRONTEND_SPEC.md](./FRONTEND_SPEC.md)
**Audience:** The founder (non-technical) + the engineer building this

> **v2.0 delta (read first).** v2.0 adds a Next.js web app with two new authenticated
> surfaces: a **user dashboard** and an **operator/admin dashboard**. Security impact,
> in one breath: (1) the admin dashboard is gated to an **allowlist of operator Google
> accounts** — see §2.5; (2) the extension now uploads **telemetry** (`campaign_stats`,
> `error_events`) that must be **scrubbed of PII in the browser first** and scoped to
> the sending user — see §3.2 and §5.6; (3) nothing about the privacy boundary changes —
> the new tables hold **counts and scrubbed metadata only**, so §0's promise ("if your
> database leaked, no recipient's information would be exposed") stays true.

---

## 0. Read This First (the 60-second version)

Fanout is unusually safe by design, and that is your biggest security asset. Here is why, in one breath:

- **You never touch the sensitive stuff.** The recipient lists and the actual email content live *only* inside the user's own browser. They are never uploaded to your servers. If a hacker broke into your database tomorrow, they would find **no recipient emails and no message content** — just account IDs and billing status.
- **You are never in the mail path.** Emails go straight from the user's browser to Google. You don't relay, store, or read them. This is both a deliverability feature *and* a security feature — there's nothing to intercept.
- **Your "server" is tiny.** It only knows three things: who the user is, whether they've paid, and how many emails they've sent (a number, not a list). That's a small target, which is exactly what you want at this stage.

The security work, therefore, concentrates in three places:

1. **The Google login** — getting permission to send mail, safely, with the least access possible.
2. **The user's own Gmail account** — protecting *it* from being flagged or suspended is a trust-and-safety obligation you own.
3. **The thin backend** — making sure one user can never see or affect another user's account or billing.

The rest of this document explains each of these in plain English.

---

## 1. Authentication — How Users Prove Who They Are

### 1.1 The recommendation: Google Sign-In via `chrome.identity.getAuthToken`

**Use Google Sign-In, and nothing else.** There is no separate "Fanout username and password." Users log in with the same Google account they'll send from. This is called OAuth, and it's the same "Sign in with Google" button you've seen everywhere.

For the MVP, use the simpler of the two technical variants (your architecture calls this **Option A**). In plain terms:

- Chrome itself handles the Google login and hands your extension a short-lived "access pass" (a token) that says *"this person allowed Fanout to send email as them."*
- Chrome stores and refreshes that pass automatically. **Your code never stores a password, and your servers never store a long-term Google key.**
- Your backend recognizes a returning user by their Google account's permanent ID (the `sub` value), the same way a coat-check recognizes a ticket number.

### 1.2 Why this is the right fit (not just the easy one)

| Reason | What it means for you |
|---|---|
| **No passwords to steal** | You never store passwords, so you can never leak them. The #1 cause of startup breaches simply doesn't apply. |
| **No long-term Google keys on your servers** | With Option A, the powerful "refresh token" never leaves the user's browser. There's nothing valuable in your database for an attacker to steal and abuse. |
| **The send happens while the user is present** | Fanout sends emails live, in the user's browser, while they watch a progress bar. It doesn't need to send at 3 a.m. while they're asleep — so it doesn't need the more dangerous "always-on" server access. |
| **Faster Google approval** | Fewer moving parts and fewer permissions = a shorter Google security review (see §1.4). |

### 1.3 The one rule that matters most: ask for the least access possible

Google lets you request "scopes" — specific permissions. **Request only these four, and never more:**

- `gmail.send` — permission to *send* mail. Note: this does **not** grant permission to *read* the user's inbox. That's deliberate and it's a strong trust signal.
- `openid`, `email`, `profile` — the basics needed to know who the user is.

**Do not** request read access, delete access, or full mailbox access "just in case." Every extra permission (a) scares users, (b) lengthens Google's review, and (c) increases your liability if you're ever breached. If you don't hold it, you can't leak it.

### 1.4 Google's verification review (start this early — it's the long pole)

Because `gmail.send` is a "restricted scope," Google will manually review your app before the public can use it. This requires a published **privacy policy**, a **terms of service**, a real homepage, and possibly a **third-party security assessment**. It can take **several weeks**. Begin it *in parallel with building*, not at launch — a delay here delays your entire launch.

### 1.5 What "logged in" means technically (for your engineer)

- The extension gets an access token from Chrome and attaches it to each Gmail API call.
- When the extension calls *your* backend (to check the plan or report usage), it sends the Google **ID token**. Your backend must **verify that ID token's signature against Google's public keys on every request** — never trust a user ID the browser simply claims. This is the single most important backend security check; §3 depends on it.

---

## 2. User Roles — Who Can Do What

### 2.1 The honest truth about roles in V1

Your PRD deliberately excludes team collaboration and role-based permissions from V1 (PRD §8). So **there is effectively one end-user role**: a single person, signed in with their own Google account, operating entirely on their own data. There is no "admin user," no "viewer," no shared workspace in the product itself.

What *does* vary between users is their **plan tier** (free / pro / team), which gates *how much* they can do, not *what kinds of things* they can do.

Below are all the actors in the system — including the non-obvious ones a security review must account for.

### 2.2 Role & tier matrix

| Actor | Who they are | CAN do | CANNOT do |
|---|---|---|---|
| **Free user** | Signed-in user on the free plan | Compose, import a list, personalize, preview, and send **up to the free monthly quota** and the Gmail daily cap. See their own campaigns and reports. | Exceed the free quota. See anyone else's data. Access pro-only features. Send from an account they haven't authenticated. |
| **Pro user** | Paying individual | Everything Free can, plus a **higher send quota** and any pro features. Manage their own subscription via Stripe's portal. | Exceed pro limits or the Gmail account's own daily ceiling. See other users' data. Grant themselves team features. |
| **Team user** *(post-MVP)* | Member of a team plan | Team-level quota and (later) shared templates/reports **as designed for that feature**. | Anything cross-tenant that the team feature doesn't explicitly allow. In V1, treat this as "pro with a different quota" until real team features ship — do not build implicit team data-sharing early. |
| **Unauthenticated visitor** | Installed the extension, hasn't signed in | Open the extension, see the sign-in prompt. | Send anything, import anything, or reach any Gmail/backend function. |
| **You / the operator (admin)** | Founder + engineers with database and hosting access | Read backend records (accounts, billing, usage counts) for support and operations. | **See any recipient list or email body — this data physically does not exist on your servers.** This is a feature: it limits what you *can* be compelled or breached to reveal. |
| **Google** | The identity + mail authority | Authenticate users, enforce sending limits, deliver mail. | — (external system; you depend on it, you don't control it). |
| **Stripe** | The billing processor | Handle payments, store card data, tell you subscription status via webhooks. | Card numbers never touch your servers — Stripe's hosted checkout handles them. |

### 2.3 The critical access boundary: one user, one account's data

The rule that must hold everywhere: **a user can only ever act on data tied to their own signed-in Google account.**

- In the browser, this is natural — each user's IndexedDB is isolated to their own Chrome profile. One user literally cannot reach another user's local data.
- On the backend, this must be *enforced in code* (see §3). Every request is scoped to the verified user; there is no endpoint that returns "all users" or "all usage" to a normal user.

### 2.4 A subtle but important point: "sending as the user" is a delegated power, not your power

When Fanout sends email, it is acting **on behalf of the user, using permission the user granted to Google** — Fanout is not an independent sender. That means:

- The user can **revoke** Fanout's access at any time from their Google Account settings. Your app must handle that gracefully (see §4.2).
- You should never design a feature that sends without the user's clear, current intent. "Send on a schedule while I'm offline" is a post-MVP feature that changes this security model (it requires the more powerful Option B token storage) — flag it for a fresh review when it comes up.

---

### 2.5 The admin/monitoring dashboard — a privileged surface, gated by allowlist (v2.0)

v2.0 adds an **operator dashboard** (the founder's monitoring view). It is the same
Next.js app under an `/admin` route segment — **not** a separate app, **not** a separate
login. Securing it comes down to three rules:

1. **Authorization is an allowlist, not a role in the DB.** Access is granted only if the
   verified Google `sub` is in an **operator allowlist** held in a server-side env var
   (e.g. `ADMIN_GOOGLE_SUBS`). A normal user flipping a field can never grant themselves
   admin — the check reads config the client can't touch. Keep it to a handful of
   accounts; revisit a DB-backed roles table only if the operator set grows.
2. **Every `/admin` request re-verifies** the Google ID token **and** the allowlist,
   server-side, on each request — same discipline as §1.5. No "admin cookie" that,
   once set, is trusted blindly.
3. **The admin can see metadata, never recipient PII — because it does not exist on the
   server.** The dashboard queries `users`, `subscriptions`, `usage_records`,
   `campaign_stats`, and `error_events`. None of those contain a recipient address, name,
   subject, or body (ARCHITECTURE §4.2). So even a fully-authorized operator — or an
   attacker who compromised an operator account — cannot exfiltrate recipient data.
   Per-user drill-down shows *"Pro, 12 campaigns, 1,430 sends, last active 2d ago"* and
   stops there. This is the §2.2 operator row, now with a UI: the power is bounded by the
   data model, not just by policy.

> **Why an allowlist and not "admin: true" in `users`?** A boolean in the DB is one
> stray `UPDATE` (or one SQL-injection bug) away from privilege escalation. An env-var
> allowlist checked on every request has no such write path from the product surface.

## 3. Database Access Rules ("Row-Level Security")

"Row-level security" (RLS) means: even though many users' records sit in the same table, **each user can only touch the rows that belong to them.** Here's how that applies to Fanout's two very different data stores.

### 3.1 The local store (recipients & email content) — isolation by design

Recipient lists, email bodies, send logs, and daily counters live in **IndexedDB inside each user's browser**. There is no shared server database for this data, so classic row-level security doesn't apply — the isolation is physical:

- Chrome sandboxes each user's profile. User A's browser has no path to User B's browser.
- **Rule:** this data must *never* be uploaded to your backend for any "nice to have" feature. Doing so would demolish your privacy story and drag you into GDPR/CAN-SPAM obligations you've deliberately deferred (ARCHITECTURE §7.4).
- **One real risk to handle:** a *shared computer*. If two people use the same Chrome profile, they'd see each other's campaigns. Mitigation: tie visible data to the currently signed-in account, and clear or hide campaigns that don't belong to the active account. Document "use your own Chrome profile" as guidance.

### 3.2 The backend store (identity, billing, usage) — enforce these rules

Your Postgres database holds `users`, `google_tokens` (only if you ever use Option B), `subscriptions`, `usage_records`, `campaign_stats`, `error_events`, and `webhook_events`. Apply these rules, enforced on **every** request:

**The golden rule:** derive the user's identity from the **verified Google ID token**, never from anything the browser sends as a plain parameter. Then scope every query to that user.

| Table | Who may READ | Who may WRITE | Row-level rule (plain English) |
|---|---|---|---|
| `users` | The user, only their own row. Operator for support. | The backend, on sign-in/update. Users can't edit their own record directly. | A request may only fetch the row whose `google_sub` matches the verified token. No endpoint returns a list of users. |
| `google_tokens` *(Option B only; skip for MVP)* | **Nobody via the API** — never expose tokens. Backend reads it internally to refresh access. | Backend only, during auth exchange. | One row per user. Encrypted at rest with a key held *outside* the database. If you ship Option A (recommended), this table doesn't exist — one less thing to protect. |
| `subscriptions` | The user, only their own row (to show their plan). Operator for support. | **Only the Stripe webhook handler** — never the user. | Plan status is set by Stripe events, not by client claims. A user calling "make me pro" must be impossible; the only path to `pro` is a real Stripe payment. |
| `usage_records` | The user, only their own rows. Operator for support. | Backend, when the extension reports counts — scoped to that user. | A user can only increment *their own* usage. They can never read or alter another user's counts. Treat client-reported counts as *advisory* — see §3.4. |
| `campaign_stats` *(v2.0)* | The user, only their own rows. Operator (admin dashboard). | Backend, on `/api/telemetry` — scoped to the verified user. | Upserted by `(user_id, campaign_ref)`. **Counts only**, keyed by an opaque `campaign_ref` that can't be traced to recipients. A user can't touch another user's rows. |
| `error_events` *(v2.0)* | The user (their own) + Operator (admin dashboard). | Backend, on `/api/telemetry` — scoped to the verified user (or null pre-auth). | **Scrubbed messages only** — must contain no address, name, subject, or body (§5.6). Retention-capped. Never user-writable beyond their own scope. |
| `webhook_events` | Backend only. | Backend only, from verified Stripe webhooks. | Not user-facing at all. Used to make sure a repeated Stripe notification is never counted twice. |

### 3.3 How to actually enforce it (two layers, belt-and-suspenders)

1. **In application code:** every database query includes a `WHERE user_id = <the verified current user>` filter. There is no "get everything" query reachable by a normal request.
2. **In the database itself (recommended):** if you use a Postgres host that supports RLS policies (Supabase does natively), turn on RLS so the database *itself* refuses to return another user's rows even if application code has a bug. This is your safety net — bugs happen, and this layer catches them.

### 3.4 Don't trust the client's numbers for anything that costs money

The extension reports "I sent N emails" to enforce free-tier quotas. A technical user could tamper with that number. For the MVP this is an acceptable, low-stakes risk (worst case: someone sends a few extra free emails). But:

- **Never** let a client-reported value directly unlock a *paid* capability or bypass a hard limit.
- The **subscription/plan** (the thing that gates money) comes *only* from Stripe webhooks — the server's own source of truth — never from the browser.
- Keep the *safety* cap (Gmail daily limit) enforced locally in the browser so it works instantly and offline; keep the *billing* quota reconciled on the server. They serve different purposes.

---

## 4. Error Handling Guide — Every Major Failure Point

For each failure the format is: **what happened → what the user should see → what the system should do.** The guiding principle throughout: **fail safe, fail visible, and never silently do something surprising with the user's Gmail account.**

### 4.1 Login & permission failures

| Failure | What the user sees | What the system does |
|---|---|---|
| **User cancels the Google sign-in** | "Sign-in was cancelled. Connect your Google account to start sending." | No data stored. Return to the sign-in screen. Retry is one click. |
| **User denies the `gmail.send` permission** | "Fanout can't send email without permission to send on your behalf. You can grant this without giving us access to read your inbox." | Explain the single permission plainly, offer to re-request. Never proceed to compose without it. |
| **Access token expired mid-session** | *(Usually invisible.)* | Silently ask Chrome for a fresh token and continue. Only if that fails, prompt the user to re-connect. |
| **User revoked access in Google settings (mid-campaign)** | "Google access was removed, so sending is paused. Reconnect to resume." | Pause the campaign (don't lose it), mark it resumable, prompt reconnect. On reconnect, resume exactly where it stopped. |
| **Backend can't verify the Google ID token** | "Something went wrong verifying your account. Please sign in again." | Reject the request (treat as unauthenticated). Log the event (without PII). Never fall back to trusting an unverified identity. |

### 4.2 Sending failures (the Gmail API) — the core of the app

Classify every send error into one of three buckets, because the correct response differs completely:

| Bucket | Example Gmail errors | What it means | System response |
|---|---|---|---|
| **Transient (retry)** | HTTP `429 rateLimitExceeded`, `5xx` server errors | Temporary — Google is busy or you're going slightly fast. | Retry automatically with **exponential backoff** (wait longer each time), up to **3 attempts**. Then, if still failing, mark that recipient failed and move on. |
| **Permanent (do NOT retry)** | HTTP `400 invalidArgument` (malformed address, bad message) | This specific email will never succeed. | Mark the recipient **failed** immediately with a clear reason. **Never** retry — retrying wastes the daily quota and can look abusive to Google. |
| **Account-level (STOP everything)** | `403` quota/limit exceeded, sending disabled, account flagged | Google is protecting the user's *account*. | **Stop the whole campaign**, don't burn through more attempts, and warn the user loudly (see §4.3). Continuing here risks getting their Gmail suspended — the worst outcome in the product. |

Additional rules:

- **Every attempt is logged** to the append-only `sendLogs` table with the outcome and error code, so a user can see exactly what happened to each recipient and retry failures deliberately.
- **On success**, record Gmail's returned message ID as proof of send.
- **Retries respect the throttle and the daily cap** — a retry is still a send.

### 4.3 Daily-limit and deliverability protection (a trust-and-safety obligation, not just an error)

This is where you protect the user from themselves — and it's arguably the most important safety feature in the product.

| Situation | What the user sees | What the system does |
|---|---|---|
| **Approaching the daily cap** (e.g., 480 of ~500) | "You're near Gmail's daily sending limit. Fanout will stop at the safe ceiling to protect your account." | Warn *before* hitting the wall. Never silently power through. |
| **Daily cap reached mid-campaign** | "Daily limit reached. Remaining emails are queued and will continue tomorrow." | **Pause, don't fail.** Mark remaining recipients `pending`. Resume automatically the next day. The counter is per-account-per-day and survives browser restarts. |
| **Account type unknown** | *(Invisible.)* | Default to the *safer* lower cap (consumer Gmail ≈ 500/day) until the account type is confirmed. When in doubt, err low. |

**Why this matters to you, the founder:** if Fanout gets users' Gmail accounts suspended, you lose all trust and your reviews crater. Conservative, honest, *visible* limits are a feature, not a limitation.

### 4.4 Import & personalization failures

| Failure | What the user sees | What the system does |
|---|---|---|
| **Malformed CSV / can't parse** | "We couldn't read that file. Check it's a valid CSV and try again." | Reject the file cleanly. Never import garbage rows. |
| **No email column detected** | "We couldn't find an email column. Which column has the email addresses?" | Ask the user to map it manually — don't guess and send to the wrong field. |
| **Invalid email addresses in the list** | "12 addresses look invalid and were skipped. Review them?" | Flag them as `skipped` *before* sending, show them, let the user fix or ignore. Don't attempt to send obviously bad addresses. |
| **A personalization token has no value** (e.g., body says `{{FirstName}}` but a row has no first name) | "Some rows are missing values for {{FirstName}}. Choose a fallback (e.g., 'there') or skip those rows." | **Never send an email that literally reads "Hi {{FirstName}}".** Require a fallback default or skip the row. This is a common, embarrassing failure — block it at preview time. |
| **Duplicate recipients in the list** | "8 duplicate addresses found. Remove them?" | Detect and offer to dedupe *before* sending, so no one gets the same email twice. |

### 4.5 Backend & billing failures

| Failure | What the user sees | What the system does |
|---|---|---|
| **Backend unreachable (license check fails)** | Nothing alarming — the app keeps working for already-entitled features. | **Fail toward the user's benefit for a short grace window**, but never *upgrade* someone to paid features they haven't bought. When unsure, allow already-granted access; never invent new paid access offline. |
| **Free quota exceeded** | "You've reached your free monthly limit. Upgrade to keep sending." | Block further sends cleanly, offer the upgrade path. Don't lose their drafted campaign. |
| **Subscription past-due / payment failed** | "There's a problem with your payment. Update your card to keep Pro features." | Follow Stripe's dunning; keep a defined grace period; only downgrade when Stripe says so via webhook. |
| **Stripe webhook received** | *(Invisible.)* | **Verify the webhook signature** before trusting it. Reject unsigned/invalid events. Record the event ID so a re-delivered event is never applied twice. Webhooks are the *only* source of truth for plan changes. |

### 4.6 The signature failure of MV3 extensions: the send engine "dies" mid-campaign

Chrome shuts down the extension's background worker after ~30 seconds of inactivity — *even in the middle of a 200-email campaign*. If handled naively, the campaign just stops. Your architecture already solves this correctly (ARCHITECTURE §7.1); from a security/reliability standpoint the requirement is:

- **The campaign state lives in the database, not in memory.** The worker can be killed and revived at any instant and must resume exactly where it left off — no double-sends, no skipped recipients.
- **Before sending to a recipient, re-check inside a transaction that they're still `pending`.** This prevents sending the same email twice if the worker restarts at an awkward moment.
- **On worker startup, look for any campaign marked `sending` and resume it.**

The user-facing promise: **closing the tab, restarting the browser, or losing the worker never sends a duplicate and never silently abandons a campaign.**

---

## 5. Edge Cases to Handle Before Launch

These are the "we didn't think of that" scenarios that cause support fires and trust damage. Grouped by area, with the recommended handling.

### 5.1 Sending & deliverability
- **Campaign spans midnight / timezone rollover.** The daily counter is keyed to the *account's* calendar day. Decide and document which day boundary you use, so "500/day" is predictable and a campaign resuming after midnight correctly gets a fresh allowance.
- **Two campaigns run in the same day.** The daily cap must be **per account, not per campaign** — otherwise a user could blow past Gmail's ceiling by splitting into two campaigns. (Your `sendCounters` design already does this — verify it in testing.)
- **User closes the laptop / goes offline mid-send.** Sending pauses; it resumes when the browser and network return. Nothing is lost, nothing double-sends.
- **The very first real campaign is large (e.g., 200 on day one).** New Gmail accounts get flagged more easily. Consider a gentler default send rate and a "warm-up" suggestion for new senders.
- **Randomized delay between sends.** Not just an error case — a mechanical, identical cadence is itself a spam signal. Jittered delays are a launch requirement, not a polish item.

### 5.2 Recipient data & personalization
- **Empty recipient list / zero valid recipients.** Block "Send" with a clear message; don't start an empty campaign.
- **HTML injection via personalization fields.** If a CSV value contains HTML or scripts and you drop it into an HTML email body, you could send malformed or malicious markup. **Escape/sanitize all token values** before rendering them into the email. Treat every imported value as untrusted.
- **CSV formula injection.** A value like `=cmd|...` can execute if a recipient opens an exported CSV in Excel. If you ever let users *export* data, prefix risky values so spreadsheets don't execute them. (Lower priority for MVP since you mostly import, but note it.)
- **Extremely large CSV (tens of thousands of rows).** Stream the parse (PapaParse supports this) and page the recipient table; don't freeze the browser. Enforce a sane maximum and tell the user what it is.
- **Weird encodings / non-Latin names / emoji in names.** Ensure UTF-8 is handled end-to-end so "José" and "田中" render correctly in the sent email, not as mojibake.
- **User sends to themselves or to obviously internal test addresses.** Harmless, but make preview-before-send prominent so people test safely.

### 5.3 Accounts, permissions & sessions
- **Access revoked mid-campaign** (covered in §4.1) — resume cleanly on reconnect.
- **User switches Google accounts in Chrome.** Make sure the *displayed data and the sending account match the currently signed-in account* — never show Account A's campaigns while sending from Account B.
- **Shared computer / shared Chrome profile.** Scope visible campaigns to the active account; advise separate profiles. (See §3.1.)
- **Consumer Gmail vs. Google Workspace** have different limits (~500 vs ~2000/day). Detect the account type and set the safe cap accordingly; default low if unsure.

### 5.4 Billing & entitlements
- **Payment succeeds but the webhook is delayed.** Handle the brief window where Stripe took the money but your backend hasn't heard yet — reconcile gracefully, don't leave a paying user locked out for long.
- **Webhook delivered twice.** The idempotency ledger (`webhook_events`) must make double-delivery a no-op.
- **Subscription canceled but current period not over.** Honor access until `current_period_end`; don't cut them off the instant they cancel.
- **Client under-reports or over-reports usage.** Reconcile server-side; never let client numbers unlock paid features (see §3.4).

### 5.5 Compliance & abuse (deferred, but know your exposure)
- **No unsubscribe handling in V1.** Your PRD defers CAN-SPAM/GDPR tooling — that's a *reasonable scope decision* because Fanout is positioned as personal 1:1 outreach, not marketing blasts. **But be explicit in your marketing and Terms of Service that this is for personal/transactional outreach, not bulk marketing.** The moment you court marketing use cases, unsubscribe links and consent handling become legally mandatory, not optional.
- **Abuse positioning for Chrome Web Store.** Bulk senders sit near Chrome's spam policies (PRD §9). Ship conservative default limits and personalization-first framing so you're clearly a "personalization tool," not a "spam cannon." This is a *store-approval survival* issue.
- **Privacy policy must be true.** Your strongest claim — "we never see your recipients or your email content" — is a legal statement. Keep it accurate. If you ever add server-side storage (e.g., open-tracking post-MVP), the policy and this document must be revised *first*.

### 5.6 Logging & telemetry (don't leak what you promised not to hold)
- **Sentry / error logs must scrub PII.** Your #1 support surface is send failures — but an error report that includes a recipient's email address or the message body quietly breaks your entire privacy promise. **Scrub recipient addresses, names, and email content from every log and error event before it leaves the browser.** Audit this before launch; it's easy to leak PII into logs by accident.
- **v2.0 — the telemetry endpoint is a PII exit that must stay dry.** The extension now
  POSTs `campaign_stats` (counts) and `error_events` (scrubbed messages) to
  `/api/telemetry`. The scrub happens **in the browser, in `lib/logger.ts`, before the
  request is built** — never "we'll strip it server-side," because by then it has already
  left the machine that promised to keep it. What may be sent: numbers, opaque
  `campaign_ref`s, error categories, HTTP status codes, extension version. What may never
  be sent: any recipient address/name, subject, body, or CSV field value. Add a test that
  fails if a payload to `/api/telemetry` contains an `@`-shaped string outside the user's
  own account email. The server also re-scopes every write to the verified user (§3.2), so
  a tampered client can only pollute its own rows.

---

## 6. Pre-Launch Security Checklist (one page for the founder)

- [ ] Google Sign-In uses **only** `gmail.send`, `openid`, `email`, `profile` — no read/delete/full-mailbox scopes.
- [ ] Google OAuth verification **started weeks before launch** (privacy policy + ToS + homepage published).
- [ ] Backend **verifies the Google ID token signature on every request** — no trusting client-claimed identity.
- [ ] Every backend query is **scoped to the signed-in user**; database-level RLS enabled as a safety net.
- [ ] Plan/subscription status comes **only from verified Stripe webhooks**, never from the browser.
- [ ] Stripe webhooks: **signature verified** + **idempotency ledger** prevents double-processing.
- [ ] **No secrets in the extension bundle** — anything shipped is world-readable. Only the *public* OAuth client ID and *public* backend URL.
- [ ] Refresh tokens (only if Option B is ever used) are **encrypted at rest** with a key held outside the database.
- [ ] Send errors are **classified** (transient / permanent / account-level) and handled per §4.2 — permanent errors are **never** retried.
- [ ] Daily cap is enforced **per account, locally, before any network call**, and defaults to the safer limit when unsure.
- [ ] Send engine is **fully resumable** — worker death, tab close, or restart never double-sends or drops recipients.
- [ ] Personalization values are **escaped/sanitized** before being placed into email HTML.
- [ ] Missing-token values are **caught at preview** — no "Hi {{FirstName}}" ever leaves the building.
- [ ] Duplicate and invalid addresses are **detected before sending**.
- [ ] **PII scrubbed from all logs and Sentry events** — no recipient emails or message content in telemetry.
- [ ] Marketing + ToS clearly position Fanout as **personal/transactional outreach**, not bulk marketing.
- [ ] *(v2.0)* Admin dashboard is gated by an **operator `google_sub` allowlist** in a server env var, re-checked on every `/admin` request — no DB `admin` boolean, no admin cookie trusted blindly (§2.5).
- [ ] *(v2.0)* `/api/telemetry` **scopes every write to the verified user** and stores counts/scrubbed metadata only; a test fails if any payload carries a recipient-shaped value (§5.6).
- [ ] *(v2.0)* `campaign_stats` uses an **opaque `campaign_ref`** (not reversible to recipients); `error_events` are **retention-capped** and scrubbed.
- [ ] *(v2.0)* The user dashboard verifies the Google ID token exactly like the API; no new password/account system introduced.

---

*This document now reflects the **v2.0 platform** (extension + Next.js web app with user
and admin dashboards, backend as Next.js API routes, Option A auth). The privacy boundary
is unchanged: the server holds identity, billing, and counts/scrubbed metadata only —
never recipient data. Two future features still change the security model and require a
fresh review before they ship: (1) **scheduled/offline sending**, which forces server-side
token storage (Option B), and (2) **open/click tracking**, which introduces the first
server-side handling of recipient activity. Revisit §1, §2.5, §3, and §5.5 before building
either.*
