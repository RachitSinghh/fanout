# Product Requirements Document
## Project Codename: "Fanout" (working name)
### A Platform for Sending Bulk Email That Arrives as Individual, Separate Messages — a Chrome Extension, a Web Dashboard, and a Freemium Subscription

**Document Owner:** Product Manager
**Status:** v2.0 — platform scope (supersedes v1.0 extension-only MVP)
**Last Updated:** August 6, 2026

> **v2.0 note:** The v1.0 MVP (a standalone Chrome extension, FEATURE_TICKETS 001–013)
> is built and code-complete. This revision widens scope from "an extension" to
> "a product": the extension stays the core sending surface, but it is now joined
> by a **Next.js web app** (marketing site + a user dashboard + an operator/admin
> monitoring dashboard) and a **freemium Stripe subscription**. See §1.5 for the
> scope evolution and the phase plan. The privacy boundary is unchanged and
> non-negotiable: recipient lists and email content never leave the browser.

---

## 1. Working Definition (Assumption to Confirm)

The core insight behind this product: when someone sends an email to multiple recipients today, they have two bad options.

1. **Add everyone to To/CC** → every recipient sees every other recipient's email address. It looks like spam, damages reply rates, and can leak private contact info.
2. **BCC everyone** → recipients don't see each other, but the email is generic, can't be personalized (no "Hi [First Name]"), and BCC'd bulk mail is aggressively flagged by spam filters.

**What this app does:** it lets a user compose *one* email, select a list of recipients (from a spreadsheet, CSV, or Gmail contacts), and have the extension send that email as **N separate, individual SMTP sends** — one per recipient — with personalization tokens filled in. Each recipient receives a normal-looking 1:1 email in their inbox, with no visible bulk list, sent through the user's own Gmail account (not a third-party mail server), which preserves sender reputation and deliverability.

This is functionally a **mail-merge / personalized bulk sender**, built as a lightweight Chrome extension that sits on top of Gmail's web interface — not a full email marketing platform.

> **Please confirm this interpretation before development begins.** The rest of this PRD assumes this definition. If the intent was different (e.g., scheduling, list management, or a full CRM), the scope below will need to change.

---

## 1.5 Scope Evolution — From Extension to Platform (v2.0)

The v1.0 MVP proved the hard part: a resilient, throttled, resumable individual-send
engine that runs entirely client-side (FEATURE_TICKETS 001–013, now code-complete).
v2.0 turns that engine into a **business**. Three things get added around it — none
of which change what the extension does or weaken the privacy story.

### What's new in v2.0

| Surface | What it is | Who it's for | New? |
|---|---|---|---|
| **Chrome Extension** | The sending tool — compose, import, personalize, send. Unchanged core; gains scheduling (016), attachments (018), a **telemetry emitter** and an **entitlement check**. | End users, inside Gmail | Extended |
| **Marketing site** | The public landing page, rebuilt from the static `landing/index.html` into the Next.js app. Pricing page. Privacy Policy + ToS (required for OAuth verification). | Prospects | **New** |
| **User dashboard** | Sign in with Google (same identity as the extension), see your plan + usage, upgrade/manage subscription via Stripe's portal. | End users, on the web | **New** |
| **Admin / monitoring dashboard** | The operator's view: signups, free→paid conversion, MRR/churn, aggregate send health, scrubbed error telemetry, and per-user **metadata** drill-down. | The founder / operators | **New** |
| **Backend** | Accounts, entitlements, Stripe webhooks, and telemetry ingestion. Implemented as **Next.js API routes** (not a separate service). | Internal | **New** (was "thin backend" in ARCHITECTURE, now realized) |

### Monetization (resolves the v1.0 open questions in §9)

**Freemium subscription, billed via Stripe.** The extension checks entitlement on
launch and gates features/caps by tier:

| Tier | Price | Daily cap | Scheduling | Attachments | Multi-account |
|---|---|---|---|---|---|
| **Free** | $0 | Low (safe default, e.g. ~50/day) | — | — | — |
| **Pro** | $/mo | Higher (toward the Gmail ceiling) | ✓ | ✓ | — |
| **Team** | $/mo | Pro caps | ✓ | ✓ | ✓ (post-MVP) |

Exact prices and the free cap are locked before public launch (§9). The
**subscription/plan is set only by verified Stripe webhooks**, never by the client
(SECURITY §3.2).

### The privacy boundary — the line the platform is built around

Adding a server does **not** mean the server sees your mail. Hard rule, enforced in
the schema and in code (ARCHITECTURE §4.2, SECURITY §3):

- **The backend may store:** the user's own Google email, tier, subscription state,
  and **numbers** — per-campaign counts (attempted / sent / failed / cap-hits),
  scrubbed error strings, last-active timestamp.
- **The backend must NEVER receive:** recipient addresses or names, CSV rows, subject
  lines, or email bodies. These stay in the browser's IndexedDB, exactly as in v1.0.

The admin dashboard's per-user drill-down obeys this: the operator sees *"Pro user,
12 campaigns, 1,430 sends, last active 2d ago"* — never **who** was emailed. The pitch
"we never see your recipients or your content" stays literally true.

### Phase plan

| Phase | Goal | Contains | Gate to next |
|---|---|---|---|
| **1 — Ship the extension (free)** | Live in the Chrome Web Store, onboard first users | Finish 016 + 018; add the telemetry-emitter + entitlement-check hooks (pointed at a stub); host the landing page; Privacy Policy + ToS; OAuth verification | Extension published |
| **2 — Stand up the platform** | Paid product with dashboards | Next.js app; backend (accounts, telemetry, Stripe webhooks); billing + tiers; user dashboard; admin dashboard | — |

Phase 1's telemetry + entitlement hooks are built *now* even though they point at
nothing, so Phase 2 is "build the server the extension already expects," not a
re-release through Chrome's review queue.

> **OAuth verification is the long pole (weeks), not the code.** In Google "Testing"
> mode the extension is fully functional for up to **100 test users** with no
> verification — enough to launch Phase 1 and gather feedback while verification
> runs in the background. It requires the Privacy Policy + ToS to be live first.

---

## 1.6 Scope Evolution — v3.0 (planned, not now): more mailboxes + an optional Cloud tier

v2.0 turned Fanout into a business without moving the privacy line. v3.0 is the next
growth bet, **written down here so the code seams get built right — not built now.**
Two independent threads, each optional, neither weakening the local-first default.

### Thread A — More mailboxes (Outlook and beyond)

The send engine already doesn't know it's talking to Gmail: it calls one function
(`sendRawEmail → SendResult`) and branches on an error bucket. So a second provider is
a **new adapter, not a new engine** (ARCHITECTURE §7.7). Outlook-on-the-web (Microsoft
Graph `sendMail`) is the first target.

- **On-brand, not a boundary break.** "Personalized outreach from *your* mailbox,
  whichever one is yours — still no server." Widens the market, leaves the privacy story
  intact.
- **Scope honesty:** a Chrome extension reaches Outlook **on the web only** — not the
  desktop client or mobile. Most "Outlook is everywhere" usage is unreachable this way.
- **The real cost is the DOM adapter, not the API.** Outlook Web is a virtualized app
  across several hosts and breaks on their redesigns — an ongoing maintenance line, same
  fragility class as Gmail injection (ARCHITECTURE §7.3).

### Thread B — Dashboard-native sending + an optional Cloud tier

Users at scale will want to run campaigns from the web dashboard, not only inside the
mail UI. **This splits into two very different things that must not be conflated:**

1. **Dashboard-native send (client-side, NO server).** The dashboard connects the user's
   Gmail/Outlook and sends *from the browser* — the list still lives in the browser,
   nothing hits our server. This is a UI location change, not a boundary change.
   **Do this first; the privacy claim is untouched.**
2. **The Cloud tier (opt-in, server-backed).** Only for what a browser genuinely can't
   do: sending while the machine is **closed** (scheduled/overnight), **cross-device
   sync**, and **team sharing**. These require server-side token storage and encrypted
   list storage (e.g. S3) — which *does* cross the privacy line.

**Keep both — as tiers, not as a default.** Local-first stays the free/privacy promise;
the Cloud tier is an **explicit, per-user opt-in** upgrade. The moment a recipient list is
stored server-side we become a breach target and a data processor (GDPR/DPA), so it is
encrypted at rest, opt-in with clear consent, and stores **only** what the enabled feature
needs — never "sync everything to S3 by default" (SECURITY §7.2). The marketing line
becomes "your data never leaves the browser **unless you turn on Cloud**" — precise, and
still true.

### Phase plan (appends to §1.5)

| Phase | Goal | Contains | Gate |
|---|---|---|---|
| **3a — More mailboxes** | Outlook web support | Provider seam (ARCH §7.7); Microsoft Graph adapter; Outlook DOM adapter; MS OAuth (`Mail.Send` only) | A second provider sends |
| **3b — Dashboard-native send** | Send from the web, still client-side | Browser-side Gmail/Graph send from `/dashboard`; list stays local | Campaign sent from dashboard, **zero** recipient data server-side |
| **3c — Cloud tier (opt-in)** | Offline/scheduled send, sync, teams | Server-side token storage (auth Option B); encrypted list storage; background send worker | An opt-in Cloud campaign runs with the laptop closed |

None of 3a–3c is committed. They are sequenced so the reversible, on-brand work (3a, 3b)
ships before the boundary-crossing work (3c), and so 3c is never built wholesale.

---

## 2. Problem Statement

People who need to email many individuals — but want each one to feel like a personal, 1:1 message — currently have no easy, native way to do this from Gmail.

- Sales reps doing outreach look spammy when they CC a list.
- Recruiters emailing 50 candidates can't personalize easily without a heavy CRM.
- Teachers, community organizers, event hosts, and small business owners need to reach many people individually but don't want to pay for (or learn) enterprise email marketing tools like Mailchimp.
- Existing solutions either require leaving Gmail entirely (Mailchimp, SendGrid) or are clunky, dated Chrome extensions with weak personalization and poor UX.

**The gap:** a fast, native-feeling, Gmail-integrated tool that makes "send this to 200 people, individually, personalized, from my own inbox" as easy as sending a single email.

---

## 3. Target Users

| Persona | Description | Primary Need |
|---|---|---|
| **Solo Sales Rep / Founder** | Doing outbound sales or investor outreach from their own Gmail | High deliverability, personalization, doesn't want to look automated |
| **Recruiter / HR** | Emailing candidate lists | Personalize by name/role, track opens/replies |
| **Community Organizer / Event Host** | Emailing members, volunteers, attendees | Simplicity, no technical setup, free/cheap |
| **Small Business Owner** | Customer updates, promotions, invoices | Low cost alternative to Mailchimp for smaller lists |
| **Educator / Admin** | Emailing parents, students individually | Privacy (no exposed email lists), personalization |

**Primary beachhead persona for V1:** Solo sales reps and founders doing outreach — highest willingness to pay, clearest pain, fastest feedback loop.

---

## 4. Goals & Success Metrics

### Business Goals
- Validate demand for a lightweight, Gmail-native personalized bulk sender
- Reach product-market fit with a narrow, well-served persona before expanding
- Build a foundation for a freemium → paid conversion model

### Success Metrics (V1 / first 90 days post-launch)

| Metric | Target |
|---|---|
| Chrome Web Store installs | 2,000+ |
| Weekly Active Senders (sent ≥1 campaign/week) | 20% of installs |
| Avg. emails sent per active user per week | 50+ |
| Send success rate (delivered without error) | >98% |
| Free → paid conversion rate | 3–5% |
| User-reported deliverability satisfaction (survey) | >4/5 |
| Uninstall rate within 7 days | <15% |

**North Star Metric:** Number of individually-personalized emails successfully sent per week through the extension.

---

## 5. Core User Flow (End-to-End)

1. **Install** the Chrome extension from the Chrome Web Store.
2. **Authenticate** via Google OAuth — extension requests permission to send mail as the user (Gmail API `gmail.send` scope).
3. User opens Gmail and clicks the extension icon, or composes a new email and sees a **"Bulk Personalize" button** injected into the Gmail compose window.
4. User **writes the email body once**, using personalization placeholders (e.g., `{{First Name}}`, `{{Company}}`).
5. User **imports a recipient list**:
   - Upload a CSV, or
   - Paste from a spreadsheet, or
   - Select from Google Contacts.
6. Extension **maps CSV columns to placeholders** (auto-detects common fields like name/email/company).
7. User sees a **preview** of 2–3 sample emails with tokens filled in, to confirm personalization looks correct.
8. User sets **sending options**: send immediately or schedule; delay between sends (to protect deliverability); optional daily send cap.
9. User clicks **Send**. The extension queues and sends emails **one at a time, each as a separate individual message**, respecting Gmail's daily sending limits.
10. User sees a **live progress bar** (e.g., "42 of 200 sent") and can pause/cancel mid-send.
11. After completion, user sees a **summary report**: sent, failed, bounced (if trackable), opens (if tracking enabled).
12. Replies land normally in the user's **regular Gmail inbox** — no separate inbox to check.

---

## 6. Core Features — Must-Have vs. Nice-to-Have

### 6.1 Must-Have (MVP-Critical)

| Feature | Description |
|---|---|
| **Google OAuth + Gmail Send API integration** | Send authentically from the user's own Gmail account, not a third-party server |
| **Individual, separate sends** | Each recipient gets their own discrete email — never a shared To/CC/BCC thread |
| **CSV / spreadsheet import** | Upload recipient list with custom columns |
| **Personalization tokens** | `{{FirstName}}`, `{{LastName}}`, `{{Company}}`, custom fields |
| **Compose UI inside Gmail** | Injects into native Gmail compose window — no separate app to learn |
| **Preview before send** | See real filled-in samples before committing |
| **Send throttling / rate limiting** | Configurable delay between sends to stay within Gmail limits and avoid spam flags |
| **Progress tracking during send** | Live status, pause/cancel capability |
| **Error handling & retry** | Failed sends (bad email format, bounces) are logged and retryable |
| **Send summary report** | Sent / failed / skipped counts after each campaign |
| **Respect Gmail daily send limits** | Auto-detect and stop before hitting account suspension risk (~500/day for free Gmail, ~2000/day Workspace) |

### 6.2 Nice-to-Have (Post-MVP / Fast Follow)

| Feature | Description |
|---|---|
| Open tracking (pixel-based) | See who opened each email |
| Click tracking | Track link clicks within emails |
| Scheduled sending | Queue a campaign for a future date/time |
| Reply detection / auto-stop | Stop sequence to a recipient if they reply |
| Follow-up sequences | Auto-send a follow-up if no reply after X days |
| Attachments & personalized attachments | Attach files, optionally per-recipient |
| Templates library | Save/reuse email templates |
| Merge from Google Sheets (live sync) | Pull recipient list directly, not just static CSV |
| Multiple sending accounts | Support Workspace users managing several inboxes |
| Team/collaboration features | Shared templates, shared sending reports across a team |
| Unsubscribe link management | Auto-insert and honor unsubscribe requests (important if scaling toward marketing use cases) |
| A/B subject line testing | Test two variants across a list |

---

## 7. MVP Scope

**The MVP is the "Must-Have" table in Section 6.1 — nothing more.**

Explicit MVP boundaries:
- One Gmail account per user, no multi-account switching.
- CSV/spreadsheet import only (no live Google Sheets sync).
- No open/click tracking in V1 — deliverability and reliable individual sending come first; tracking is a fast-follow once core send flow is validated.
- No scheduling — send now only.
- Manual pause/cancel only; no smart automation like reply detection.
- Web-based Chrome extension only — no desktop app, no mobile.
- Supports Gmail/Google Workspace accounts only — no Outlook/other providers in V1.

**Definition of MVP Done:** A user can install the extension, authenticate, compose one email, upload a list of 100 contacts, personalize with at least 3 token types, and successfully send 100 individual emails with a >98% success rate and a clear completion report — without ever leaving the Gmail interface.

---

## 8. Explicitly NOT Building in V1

> **v2.0 update:** A web dashboard, an operator/admin monitoring view, and paid
> subscription tiers are now **in scope** (§1.5). The exclusions below still hold —
> in particular, the admin dashboard is *internal operations telemetry* (counts,
> health, billing), **not** user-facing marketing analytics, and it never contains
> recipient data.

> **v3.0 update (planned, not now):** Two exclusions below — Outlook/other providers,
> and server-side recipient storage — get a deliberate future home in §1.6. They remain
> **out of current scope**; §1.6 exists so the code seams are built right, so the
> boundary-crossing pieces stay opt-in and tiered, and so nothing here is built wholesale.
> Third-party **SMTP relays** and shared sending IPs stay permanently excluded — sending
> always goes through the user's own mailbox, which is core to the value prop.

To keep scope tight and shippable, the following are deliberately excluded, even though they're common requests in this space:

- ❌ Outlook, Yahoo, or other non-Gmail email provider support
- ❌ A full CRM or contact database inside the extension
- ❌ Email marketing analytics dashboards (heatmaps, funnels, cohort analysis)
- ❌ Drip campaigns / multi-step automated sequences
- ❌ A/B testing
- ❌ Team collaboration, shared workspaces, or role-based permissions
- ❌ Native mobile app
- ❌ Sending through third-party SMTP relays (all sending stays within the user's own Gmail — this is core to the "looks like a real personal email" value prop and protects deliverability)
- ❌ Built-in unsubscribe/compliance management (revisit if the product moves toward marketing use cases, where CAN-SPAM/GDPR handling becomes mandatory)
- ❌ AI-generated email copywriting (may be a good V2 feature, but not core to the send problem)

---

## 9. Key Risks & Open Questions

| Risk | Notes |
|---|---|
| **Gmail API sending limits & account suspension** | Google actively flags accounts that send high volumes of similar emails quickly. Throttling and honest limit-setting are critical to protect users' Gmail accounts — this is a trust and safety issue, not just a UX detail. |
| **Google OAuth verification** | Requesting `gmail.send` scope requires Google's OAuth app verification/security review, which can take weeks and requires a privacy policy, ToS, and possibly a security assessment. This should be started early, not at launch. |
| **Chrome Web Store policy compliance** | Bulk-sending tools sit close to Chrome Web Store's spam/abuse policies. Positioning matters — this must be marketed and built as a personalization tool, not a spam tool. |
| **Deliverability perception** | Even individually-sent, identical-looking emails at volume can trigger Gmail's own spam detection on the sending account. Needs real-world testing with varied send rates. |
| **Differentiation** | Established players exist (GMass, Mailmeteor, Yet Another Mail Merge). Must be clear early what the wedge is — likely UX simplicity, pricing, or a specific persona focus. |
| **Monetization model** | Freemium with daily send caps? Per-seat? Needs validation before/during MVP, not after. |

**Open questions — status after v2.0:**
1. ~~Target daily/monthly send limit for free vs. paid tiers?~~ **Resolved in shape**
   (§1.5): freemium — Free = low safe daily cap, Pro/Team = higher. *Exact numbers
   still locked before public launch.*
2. Do we support Google Workspace (business) accounts differently from consumer Gmail
   (different limits/policies)? — Still open; the safe-default cap covers it for now.
3. ~~Is pricing per-user, per-send-volume, or flat subscription?~~ **Resolved** (§1.5):
   **flat monthly subscription** per tier (not usage-metered), via Stripe.
4. *(New)* Hosting: **Vercel (recommended) vs. the founder's AWS** — deferred, see
   ARCHITECTURE §2.4. Does not block Phase 1.

---

## 10. Suggested Next Steps

1. Validate the core interpretation in Section 1 with target users (5–10 interviews with the sales-rep/founder persona).
2. Begin Google OAuth app verification process in parallel with design (long lead time).
3. Build a clickable prototype of the compose-injection UI for usability testing before writing send-logic code.
4. Define exact free-tier send limits before public launch to avoid retroactive user backlash.
5. Draft a lightweight technical spec for the Gmail API integration and throttling logic as a follow-up to this PRD.

---

*This PRD is a living document. As user research and technical discovery progress, sections 6–9 should be revisited before final MVP lock.*