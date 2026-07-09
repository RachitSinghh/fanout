# Frontend Specification Document

## Project: Fanout — Gmail-Native Personalized Bulk Sender (Chrome Extension)

**Author:** Senior UI/UX Designer & Frontend Architect
**Status:** v1.0 — for MVP build
**Last Updated:** July 9, 2026
**Companion docs:** [PRD.md](./PRD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [SECURITY_AND_ACCESS.md](./SECURITY_AND_ACCESS.md)
**Audience:** Frontend engineers building the extension, plus the founder reviewing the design direction

---

## 0. TL;DR / How to Use This Document

This document is the single source of truth for **how Fanout looks, feels, and talks to the outside world.** It has two halves:

1. **The Design System (§1–§6)** — colors, type, spacing, components, and motion. Every pixel Fanout renders should trace back to a token defined here. Copy the Tailwind config and CSS variables in the Appendix (§13) verbatim into `packages/extension`.
2. **The API & Integration Spec (§7–§11)** — every third-party service the frontend talks to, what each does, the exact endpoints, the request payloads, and the expected responses. This is written from the **frontend's point of view**: what the client sends and what it must handle back.

### The design north star

Fanout injects into Gmail. Per the product decision, its identity is **distinct but harmonious**: an **indigo brand** and **Inter typography** that sit comfortably beside Gmail without impersonating it. A user should never confuse a Fanout surface for a native Gmail feature — that ambiguity would erode the trust the whole product depends on (SECURITY_AND_ACCESS §0). Fanout looks like a well-made, Google-adjacent guest in Gmail's house.

### Three non-negotiable frontend constraints (from the companion docs)

- **Shadow DOM isolation.** The Gmail-injected overlay mounts in a Shadow DOM root (ARCHITECTURE §2.1, §7.3). All styles here are authored to live inside that boundary — no reliance on Gmail's cascade, no leaking out. Tailwind is scoped; fonts and CSS variables are declared on the shadow root's `:host`.
- **Never render an unfilled token.** The UI must make it impossible to send "Hi {{FirstName}}" (SECURITY_AND_ACCESS §4.4). Preview and validation states in §5 enforce this.
- **PII never leaves the browser except to Google.** No recipient data in analytics, Sentry, or backend calls (SECURITY_AND_ACCESS §5.6). The API spec below reflects this precisely.

---

## 1. Design Principles

These five principles resolve disagreements when the spec is silent.

| Principle | What it means in practice |
|---|---|
| **1. Calm under volume** | The core action is sending to *hundreds* of people. The UI must feel controlled, never frantic. Progress is legible, pausing is always one click away, and destructive/irreversible moments (Send) get deliberate friction. Motion is reassuring, not attention-grabbing. |
| **2. Trust is visible** | Fanout's value is deliverability and privacy. Surface the safety work: show the daily-cap headroom, show "sent individually, one at a time," show "your recipients never leave your browser." Trust that isn't shown isn't felt. |
| **3. Preview before commit** | Every irreversible action is preceded by a truthful preview. You always see real rendered emails before you send, real skipped rows before you dedupe, real counts before you commit. |
| **4. Native-feeling, not native-faking** | Fast, keyboard-friendly, and visually quiet enough to belong in Gmail — but always clearly Fanout. Distinct color, distinct type, a persistent wordmark on primary surfaces. |
| **5. Fail safe, fail visible** | Mirrors SECURITY_AND_ACCESS §4. Errors are specific, actionable, and never silent. The UI never "powers through" a limit or quietly does something surprising with the user's Gmail account. |

---

## 2. Color Palette

All colors are defined as design tokens (CSS custom properties) on the Shadow DOM `:host` and mirrored in `tailwind.config.ts`. **Do not hardcode hex values in components** — reference the semantic token.

### 2.1 Brand — Indigo

The primary brand ramp. Used for primary actions, active states, focus rings, links, and the Fanout wordmark. Chosen to be unmistakably *not* Gmail's `#1a73e8` blue while remaining a trustworthy, Google-adjacent hue.

| Token | Hex | Usage |
|---|---|---|
| `brand-50` | `#EEF2FF` | Tinted backgrounds, hover fills on ghost buttons, selected-row wash |
| `brand-100` | `#E0E7FF` | Subtle badges, info-callout backgrounds |
| `brand-200` | `#C7D2FE` | Disabled primary button fill, dividers on brand surfaces |
| `brand-300` | `#A5B4FC` | Borders on active inputs (light), secondary accents |
| `brand-400` | `#818CF8` | Hover accents, chart/progress secondary |
| `brand-500` | `#6366F1` | Default interactive accent (icons, links on light) |
| `brand-600` | `#4F46E5` | **Primary** — default button fill, primary CTAs, active nav. This is *the* Fanout color. |
| `brand-700` | `#4338CA` | Primary button hover / pressed |
| `brand-800` | `#3730A3` | Primary button active, high-contrast text on tint |
| `brand-900` | `#312E81` | Deep accents, dark-mode brand text |
| `brand-950` | `#1E1B4B` | Dark-mode brand surface fills |

### 2.2 Neutrals — Slate

Text, surfaces, borders. A slightly cool slate ramp that reads as clean and modern next to Gmail's warmer greys without clashing.

| Token | Hex | Usage |
|---|---|---|
| `neutral-0` | `#FFFFFF` | App surface / card background (light) |
| `neutral-50` | `#F8FAFC` | Page background, table zebra stripe (light) |
| `neutral-100` | `#F1F5F9` | Input background, hover rows, disabled fills |
| `neutral-200` | `#E2E8F0` | **Default border / divider** (light) |
| `neutral-300` | `#CBD5E1` | Input borders, stronger dividers |
| `neutral-400` | `#94A3B8` | Placeholder text, disabled text, muted icons |
| `neutral-500` | `#64748B` | Secondary text, captions, table meta |
| `neutral-600` | `#475569` | Body text (secondary emphasis) |
| `neutral-700` | `#334155` | **Body text (default)** |
| `neutral-800` | `#1E293B` | Headings, high-emphasis text |
| `neutral-900` | `#0F172A` | Max-contrast headings; app surface (dark) |
| `neutral-950` | `#020617` | Page background (dark) |

### 2.3 Semantic — Status

Mapped to the send-error taxonomy in SECURITY_AND_ACCESS §4.2 (transient / permanent / account-level) and the general success/warning/info language. Each has a `-fg` (foreground/icon/text), `-bg` (tinted background), and `-border`.

| Role | Token base | `-fg` | `-bg` (light) | `-border` | Where it appears |
|---|---|---|---|---|---|
| **Success** | `success` | `#15803D` | `#F0FDF4` | `#BBF7D0` | Sent recipients, completed campaigns, "delivered" |
| **Warning** | `warning` | `#B45309` | `#FFFBEB` | `#FDE68A` | Approaching daily cap, missing-token fallback, dedupe prompts |
| **Danger** | `danger` | `#B91C1C` | `#FEF2F2` | `#FECACA` | Permanent send failures, account-level stop, destructive confirms |
| **Info** | `info` | `#1D4ED8` | `#EFF6FF` | `#BFDBFE` | Neutral system notices, tips, "queued for tomorrow" |
| **Neutral/Pending** | `pending` | `#475569` | `#F1F5F9` | `#E2E8F0` | `pending` / `queued` recipient status, idle states |

> **Send-status color mapping (recipient rows & progress):** `pending` → Neutral · `sending` → Brand (animated) · `sent` → Success · `failed` (permanent) → Danger · `skipped` → Warning · `rate_limited`/`paused` → Info. These are the only five row colors; keep them consistent everywhere a recipient status is shown (RecipientTable, ProgressBar, SummaryReport).

### 2.4 Dark Mode

The popup and options page respect the OS/Chrome theme. The Gmail overlay defaults to **light** (Gmail's default surface) but must read correctly if Gmail Dark Theme is active — detect via the injected host and apply `data-theme="dark"` on the shadow root.

| Semantic token | Light | Dark |
|---|---|---|
| `--surface` | `#FFFFFF` | `#0F172A` |
| `--surface-raised` | `#FFFFFF` | `#1E293B` |
| `--surface-sunken` | `#F8FAFC` | `#020617` |
| `--text-primary` | `#1E293B` | `#F1F5F9` |
| `--text-secondary` | `#475569` | `#94A3B8` |
| `--text-muted` | `#64748B` | `#64748B` |
| `--border` | `#E2E8F0` | `#334155` |
| `--border-strong` | `#CBD5E1` | `#475569` |
| `--brand` | `#4F46E5` | `#818CF8` (lift for contrast on dark) |
| `--brand-hover` | `#4338CA` | `#A5B4FC` |
| `--focus-ring` | `#6366F1` | `#818CF8` |

**Rule:** components reference the semantic aliases (`--surface`, `--text-primary`, `--brand`, …), never the raw ramp, so a single `data-theme` swap flips the whole UI. Raw ramp tokens (§2.1–§2.3) exist only to *define* the aliases.

### 2.5 Contrast & accessibility

- Body text (`neutral-700` on `neutral-0`) = 10.8:1 — exceeds WCAG AAA.
- Primary button text (white on `brand-600`) = 5.9:1 — passes AA for normal text.
- Never place `brand-400`/`brand-500` text on white for body copy (fails AA); use `brand-600`+ for text, reserve lighter shades for fills/icons.
- All status `-fg` colors are validated ≥4.5:1 on their `-bg`.

---

## 3. Typography

### 3.1 Font family

**Inter** (variable) for all UI. Ships bundled with the extension as a self-hosted `woff2` (no external CDN — CSP forbids it, and the Shadow DOM must be self-contained). Fallback stack matches system UI so first paint before font load isn't jarring.

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
```

- **Inter** — everything. Its tall x-height and neutral character read cleanly at the small sizes an in-Gmail overlay demands, and it's visibly *not* Google Sans, reinforcing "distinct but harmonious."
- **JetBrains Mono** — reserved for: personalization tokens (`{{FirstName}}`) in the editor, raw email addresses in dense tables, CSV column headers, and any code/ID display (e.g. Gmail message IDs).

Load `font-feature-settings: 'cv05' 1, 'ss01' 1, 'tnum' 1;` — `tnum` (tabular numerals) is important so the live progress counter ("142 of 200") doesn't jitter as digits change.

### 3.2 Type scale

A modular scale tuned for a compact extension. Sizes in `rem` (root = 16px). Line-heights are unitless.

| Token | Size | Line-height | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| `display` | 1.75rem / 28px | 1.2 | 700 | -0.02em | Popup dashboard hero number ("North Star" send count), empty-state titles |
| `h1` | 1.375rem / 22px | 1.25 | 700 | -0.01em | Modal titles, options-page section headers |
| `h2` | 1.125rem / 18px | 1.3 | 600 | -0.01em | Card titles, step headers ("Import recipients") |
| `h3` | 1rem / 16px | 1.4 | 600 | 0 | Sub-sections, grouped setting labels |
| `body` | 0.875rem / 14px | 1.5 | 400 | 0 | **Default body text**, table cells, descriptions |
| `body-strong` | 0.875rem / 14px | 1.5 | 600 | 0 | Emphasized body, active labels |
| `label` | 0.8125rem / 13px | 1.4 | 500 | 0.01em | Form field labels, button text |
| `caption` | 0.75rem / 12px | 1.4 | 500 | 0.02em | Metadata, timestamps, helper text, badge text |
| `overline` | 0.6875rem / 11px | 1.3 | 600 | 0.08em | UPPERCASE section eyebrows, status chips |
| `mono-sm` | 0.8125rem / 13px | 1.5 | 500 | 0 | Tokens, emails, IDs (JetBrains Mono) |

**Rules:**
- Max **two** weights visible in any one component (typically 400 + 600).
- Body copy never exceeds ~68 characters per line; in the narrow overlay this is natural, on the options page constrain content to `max-w-[640px]`.
- Numbers in tables and progress use `tabular-nums` (baked into the `tnum` feature above).

---

## 4. Spacing, Layout & Foundations

### 4.1 Spacing scale (4px base grid)

Everything aligns to a 4px grid. Use these tokens (Tailwind's default scale, restated for clarity):

| Token | px | Common use |
|---|---|---|
| `space-0.5` | 2 | Icon-to-text hairline gaps |
| `space-1` | 4 | Tight inline gaps, chip padding |
| `space-2` | 8 | Default gap between related controls, input padding-y |
| `space-3` | 12 | Input padding-x, gap between form rows |
| `space-4` | 16 | **Default component padding**, card inner padding |
| `space-5` | 20 | Section gaps within a card |
| `space-6` | 24 | Card-to-card gaps, modal padding |
| `space-8` | 32 | Major section separation |
| `space-10` | 40 | Page-level top/bottom rhythm (options) |
| `space-12` | 48 | Empty-state vertical centering |

### 4.2 Surface dimensions

Fanout renders on three surfaces; each has fixed constraints:

| Surface | Dimensions | Notes |
|---|---|---|
| **Popup** (toolbar icon) | `width: 400px`, `min-height: 480px`, `max-height: 600px` | Chrome caps popup height at 600px. Dashboard + recent campaigns + quick-start. Scrolls internally. |
| **Gmail overlay** (the main flow) | `width: 720px` centered modal-over-Gmail, `max-height: 90vh` | The full compose → import → map → preview → send flow. Mounts in Shadow DOM, dimmed backdrop over Gmail. Responsive down to 560px. |
| **Options page** (full tab) | Content `max-w-[960px]`, centered, `px-6` | Account, plan/billing, defaults (send delay, daily cap), data management. Standard responsive page. |

### 4.3 Layout grid (overlay)

The overlay uses a single-column flow with a **persistent stepper** at top and a **sticky action bar** at bottom:

```
┌──────────────────────────────────────────────┐
│  ◆ Fanout        Compose · Import · Map · …   │  ← header + stepper (sticky)
├──────────────────────────────────────────────┤
│                                                │
│   [ active step content — scrolls ]            │
│                                                │
├──────────────────────────────────────────────┤
│  ← Back            42 recipients   [ Continue ]│  ← action bar (sticky)
└──────────────────────────────────────────────┘
```

- Header: `h-14`, `px-6`, wordmark left, stepper center, close right.
- Action bar: `h-16`, `px-6`, backdrop-blur, top border, contextual left status + right primary action.
- Content region scrolls between them; sticky bars never scroll away.

### 4.4 Border radius

| Token | px | Usage |
|---|---|---|
| `radius-sm` | 6 | Chips, badges, small inputs, token pills |
| `radius-md` | 8 | **Default** — buttons, inputs, cards' inner elements |
| `radius-lg` | 12 | Cards, panels, popovers |
| `radius-xl` | 16 | Modal / overlay container |
| `radius-full` | 9999 | Avatars, progress track, toggle, status dots |

### 4.5 Elevation (shadows)

Shadows are soft and low-spread — an in-Gmail overlay should float gently, not dramatically. Defined for light mode; in dark mode reduce opacity ~40% and lean on borders instead.

| Token | Value | Usage |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgba(15,23,42,0.06)` | Buttons at rest, inputs |
| `shadow-sm` | `0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)` | Cards, dropdowns |
| `shadow-md` | `0 4px 12px rgba(15,23,42,0.10)` | Popovers, hover-lifted cards |
| `shadow-lg` | `0 12px 32px rgba(15,23,42,0.14)` | The overlay modal, dialogs |
| `shadow-focus` | `0 0 0 3px rgba(99,102,241,0.45)` | **Focus ring** — brand-500 @ 45% |

### 4.6 Z-index scale

The overlay lives inside Gmail, which has its own high z-indices. Fanout's Shadow DOM host is pinned at a very high base; internal layering is relative to it.

| Token | Value | Usage |
|---|---|---|
| `z-host` | `2147483000` | The Shadow DOM host wrapper (near max int, above Gmail chrome) |
| `z-backdrop` | `10` | Overlay dimming backdrop (within host) |
| `z-modal` | `20` | Overlay/dialog container |
| `z-popover` | `30` | Dropdowns, column-mapper menus, tooltips |
| `z-toast` | `40` | Toasts / snackbars |

### 4.7 Iconography

- **Library:** [Lucide](https://lucide.dev) (tree-shakeable, MIT, consistent 24×24 grid). Bundled, not fetched.
- **Default size:** 16px inline with `body`/`label` text; 20px for standalone icon buttons; 24px for empty-state/hero.
- **Stroke:** 1.5px (Lucide default) at 16–20px; 2px acceptable at 24px.
- **Color:** inherit `currentColor`; muted icons use `--text-muted`.
- **Key mappings:** send → `send-horizontal`, pause → `pause`, retry → `rotate-cw`, import → `upload`, contacts → `users`, token → `braces`, success → `check-circle-2`, warning → `alert-triangle`, danger → `x-circle`, throttle/delay → `timer`, daily cap → `gauge`, privacy → `shield-check`.

---

## 5. Component Specifications

Every component below lists its **variants**, **states**, **sizing**, and **spec notes**. Components are built as React 18 components in `packages/extension/src/ui/components`, styled with scoped Tailwind, and animated with Framer Motion (§6). All are keyboard-accessible and honor `prefers-reduced-motion`.

### 5.1 Buttons

The workhorse. Four variants, three sizes.

| Variant | Fill | Text | Border | Hover | Active/Pressed | Disabled |
|---|---|---|---|---|---|---|
| **Primary** | `brand-600` | white | none | `brand-700` | `brand-800` | `brand-200` fill, white text @ 70% |
| **Secondary** | `neutral-0` | `neutral-700` | 1px `neutral-300` | `neutral-50` bg, `neutral-400` border | `neutral-100` bg | `neutral-100` bg, `neutral-400` text |
| **Ghost** | transparent | `brand-600` | none | `brand-50` bg | `brand-100` bg | `neutral-400` text |
| **Danger** | `danger-fg` (`#B91C1C`) | white | none | `#991B1B` | `#7F1D1D` | `danger-bg`, `#B91C1C` @ 60% |

**Sizes:**

| Size | Height | Padding-x | Font | Icon | Radius |
|---|---|---|---|---|---|
| `sm` | 28px | 12px | `label` (13px) | 14px | `radius-md` |
| `md` (default) | 36px | 16px | `label` (13px/500) | 16px | `radius-md` |
| `lg` | 44px | 20px | `body-strong` (14px/600) | 18px | `radius-md` |

**Spec notes:**
- Icon + text gap = `space-2` (8px). Icon-only buttons are square (height = width) with an accessible `aria-label`.
- **Focus:** always `shadow-focus` ring, offset 0. Never remove focus outline.
- **Loading state:** replace leading icon with a spinner (Framer Motion `rotate` loop), keep the label, disable pointer events, keep width stable (min-width lock) so the button doesn't reflow.
- **The Send button** is a special `lg` Primary with a leading `send-horizontal` icon; its click opens the pre-send confirm dialog (§5.7) — it never sends directly (Principle 3, deliberate friction).

### 5.2 Inputs & Form Controls

Covers text inputs, textareas, selects, checkboxes, radios, toggles, and file drop.

**Text input / textarea:**

| Property | Value |
|---|---|
| Height (input) | 36px (`md`), 44px (`lg`) |
| Padding | `space-2` y, `space-3` x |
| Background | `neutral-100` (light) / `--surface-sunken` (dark) |
| Border | 1px `neutral-300`; **1px `brand-500` + `shadow-focus` on focus** |
| Radius | `radius-md` |
| Text | `body` (14px), `--text-primary` |
| Placeholder | `neutral-400` |
| Font (email/token fields) | `mono-sm` (JetBrains Mono) |

**States:** default · hover (`neutral-400` border) · focus (brand border + ring) · filled · error (`danger` border + ring, `danger-fg` helper text below) · disabled (`neutral-100` bg, `neutral-400` text, `not-allowed` cursor) · read-only (no border, `--surface-sunken`).

**Field anatomy:** `label` (13px/500, `--text-primary`) → optional helper `caption` (`--text-muted`) → control → error/success message (`caption`, colored). Required fields marked with a `brand-600` asterisk; error messages replace helper text on validation failure.

**Checkbox / Radio:** 16px box, `radius-sm` (checkbox) / `radius-full` (radio), 2px `neutral-300` border unchecked, `brand-600` fill + white check when checked, `shadow-focus` on focus. Animated check-draw (§6.4).

**Toggle (switch):** 36×20px track, `radius-full`, `neutral-300` off / `brand-600` on, 16px white thumb with `shadow-xs`, thumb slides with a spring (§6.4). Used for send options (e.g. "Set a daily cap", future "Open tracking").

**Select / Dropdown:** trigger styled as an input with trailing `chevron-down`; menu is a `z-popover` panel, `radius-lg`, `shadow-md`, 4px item padding, `brand-50` hover, `brand-100` selected. Menu animates open (§6.3).

**File drop (CsvImporter):** dashed 2px `neutral-300` border, `radius-lg`, `neutral-50` bg, `upload` icon + "Drop a CSV or click to browse" (`body`, `--text-muted`). On drag-over: `brand-400` border, `brand-50` bg, subtle scale-up (§6). On file received: collapses to a compact file chip with name, row count, and a remove `x`.

### 5.3 Cards & Panels

The primary content container.

| Property | Value |
|---|---|
| Background | `--surface` |
| Border | 1px `--border` |
| Radius | `radius-lg` (12px) |
| Padding | `space-4` (16px) compact / `space-6` (24px) roomy |
| Shadow | `shadow-sm` at rest; `shadow-md` if interactive/hoverable |
| Header | `h2` title + optional `caption` subtitle + optional trailing action, separated from body by `space-4` and (optionally) a 1px `--border` divider |

**Variants:**
- **Default card** — grouping content (send options, account info).
- **Stat card** (popup dashboard) — large `display` number + `overline` label + trend `caption`. E.g. "1,240 · EMAILS SENT THIS WEEK".
- **Selectable card** (e.g. import method: CSV / Paste / Contacts) — adds hover-lift, `brand-600` border + `brand-50` bg when selected, radio semantics.
- **Callout card** — tinted semantic background (`info-bg`/`warning-bg`) with a leading icon; used for trust messaging ("🛡 Your recipients never leave this browser") and cap warnings.

### 5.4 Modals & Dialogs

Two things share this pattern: the **main overlay** (the full flow, §4.3) and **dialogs** (confirmations, small forms).

**The overlay container:**
- Backdrop: `rgba(15,23,42,0.45)` (light) / `rgba(2,6,23,0.65)` (dark), `z-backdrop`, click-to-dismiss **only when safe** (never during an active send).
- Panel: `--surface`, `radius-xl`, `shadow-lg`, centered, `z-modal`. Dimensions per §4.2.
- Entry/exit animated per §6.3.

**Dialogs (confirm / alert):**
- Width `440px`, `radius-xl`, `shadow-lg`, `space-6` padding.
- Anatomy: optional semantic icon (48px circle, tinted bg) → `h1` title → `body` description → action row (right-aligned: secondary "Cancel" + primary/danger confirm).
- **Focus trap** while open; `Esc` closes (except during send); focus returns to the invoking element on close.
- **Scrim always dims Gmail** so it's unmistakable which surface has focus.

**Named dialogs the frontend must implement:**

| Dialog | Trigger | Content |
|---|---|---|
| **Pre-send confirm** | "Send" clicked | "Send **200** individual emails from **you@co.com**? Each person gets their own message." + delay/cap summary + "Send now" (Primary). |
| **Missing-token block** | Preview detects empty token values | Warning icon, list of affected tokens, "Set a fallback" input or "Skip those rows" — cannot dismiss to send until resolved (SECURITY_AND_ACCESS §4.4). |
| **Dedupe prompt** | Duplicates detected on import | "8 duplicate addresses found." → "Remove duplicates" (Primary) / "Keep all". |
| **Account-level stop** | Gmail `403` / flagged | Danger icon, "Sending stopped to protect your Gmail account." + what happened + "View report". No auto-retry. |
| **Reconnect** | Access revoked mid-campaign | "Google access was removed. Reconnect to resume." + "Reconnect" (Primary). Campaign stays `paused`/resumable. |
| **Cancel campaign** | "Cancel" during send | Danger confirm: "Stop sending? 42 already sent can't be unsent; 158 remaining will be cancelled." |

### 5.5 Recipient Table

The densest, most data-heavy component (thousands of rows — virtualize with `@tanstack/react-virtual`).

- **Header row:** sticky, `--surface-sunken` bg, `overline` uppercase labels, sortable columns (click → `chevron` indicator).
- **Rows:** 44px height, `body` text, zebra (`neutral-50` on even), hover `brand-50`, 1px `--border` bottom.
- **Status cell:** leading status dot (`radius-full`, 8px) + `caption` label, colored per §2.3 mapping. The `sending` dot pulses (§6.5).
- **Email column:** `mono-sm`. **Token/field columns:** `body`, truncated with tooltip on overflow.
- **Error column** (post-send): `danger-fg` short reason + a `retry` icon-button for retryable failures only (transient/permanent distinction from SECURITY_AND_ACCESS §4.2 — permanent failures show no retry).
- **Bulk actions bar** (appears when rows selected): "Remove", "Skip", "Retry selected" — floating `shadow-md` bar animating up from the bottom of the table.
- **Empty / invalid rows:** invalid emails rendered with `warning` styling and a "skipped" badge *before* send (SECURITY_AND_ACCESS §4.4).

### 5.6 Progress Bar & Live Send Status

The emotional center of the app — the user watches this while 200 emails go out. Must feel calm and trustworthy (Principle 1).

- **Track:** `radius-full`, 8px tall, `neutral-200` bg.
- **Fill:** `brand-600`, animated width via Framer Motion spring (§6.5). At completion, fill transitions to `success-fg`.
- **Counter:** `display`/`h2` "142 of 200 sent" with `tabular-nums` so digits don't jitter.
- **Sub-stats row** (`caption`): ✓ 138 sent · ⏭ 3 skipped · ✕ 1 failed · ⏳ 58 queued — each with its status color.
- **Rate indicator:** "next send in 12s" with a subtle countdown (respects the jittered throttle from ARCHITECTURE §7.2 — show a *range* feel, not a precise ticking clock, so the randomized cadence reads as intentional).
- **Daily-cap meter:** a secondary thin bar showing "480 / 500 today" that turns `warning` as it approaches the ceiling (SECURITY_AND_ACCESS §4.3). When capped: inline `info` message "Daily limit reached — remaining will continue tomorrow."
- **Controls:** persistent **Pause** and **Cancel** buttons, always reachable (Principle 1). Pause is `secondary`; Cancel is `ghost`→opens danger dialog.

### 5.7 Token Editor & Column Mapper

- **TokenEditor:** the compose body/subject fields highlight `{{Tokens}}` as inline `mono-sm` pills (`brand-50` bg, `brand-700` text, `radius-sm`). A "+ Insert token" popover lists detected tokens. Invalid/unknown tokens render in `warning` styling.
- **ColumnMapper:** two-column layout — CSV column (left, `mono-sm` header + sample value `caption`) ↔ Fanout token (right, a Select). Auto-detected mappings (name/email/company) pre-filled and badged "auto". The email mapping is **required** and validated; unmapped tokens surface a warning before "Continue."

### 5.8 Preview Pane

Shows 2–3 fully rendered sample emails (Principle 3). Rendered inside a sandboxed, styled container mimicking a Gmail message (avatar, from-line `you@co.com`, subject, body). A small selector cycles through sample recipients. **Every token is resolved** — if any sample would render an unfilled token, the Preview shows the missing-token block (§5.4) instead of allowing "Continue."

### 5.9 Badges, Chips & Status Pills

- **Badge:** `caption`/`overline`, `radius-full`, `space-1` y / `space-2` x, tinted semantic bg + `-fg` text. Used for plan tier ("PRO"), row status, "auto"-mapped columns.
- **Token chip:** `mono-sm`, `brand-50`/`brand-700`, `radius-sm`, optional trailing `x` to remove.
- **Dismissible chip** (recipient filters): `neutral-100` bg, `x` on hover.

### 5.10 Toasts / Snackbars

- Bottom-center of the active surface, `z-toast`, `radius-lg`, `shadow-md`, max-width 420px.
- Leading semantic icon + `body` message + optional action (`ghost` button, e.g. "Undo remove").
- Auto-dismiss after 5s (success/info) or persist until dismissed (danger). Stack vertically, animate in from below (§6.6).
- **Never** put PII (recipient email/name) in a toast that could be captured by screen-recording support tools — keep messages aggregate ("8 duplicates removed") per SECURITY_AND_ACCESS §5.6.

### 5.11 Empty, Loading & Error States

- **Empty:** centered `display` icon (`--text-muted`), `h2` title, `body` description, primary CTA. E.g. no campaigns yet → "Send your first personalized batch."
- **Loading (skeletons):** `neutral-100` blocks with a shimmer sweep (§6), matching final layout dimensions — no spinners for content areas; spinners only for button/action-local waits.
- **Error (surface-level):** `danger` callout card with a plain-English message (mirror SECURITY_AND_ACCESS §4 copy) + a recovery action. Never a raw stack trace or error code alone.

---

## 6. Motion System — Framer Motion

Framer Motion is **required** (per request) and is the sole animation library. It works inside Shadow DOM without extra config and its declarative `variants` model keeps motion consistent and centralized.

### 6.1 Install & setup

```bash
pnpm --filter @fanout/extension add framer-motion
```

- Framer Motion ≥ 11. Import `motion`, `AnimatePresence`, `useReducedMotion`.
- **Shadow DOM note:** Framer Motion animates via inline styles/`transform`, so it needs no global stylesheet and won't leak — safe inside the overlay's shadow root. No portal to `document.body` for animated elements inside the overlay; keep them within the shadow tree so styles stay isolated.
- **Bundle discipline:** import from `framer-motion` and rely on tree-shaking; for the size-sensitive content script, prefer the `m` component + `LazyMotion` with `domAnimation` features to trim the injected bundle:
  ```tsx
  import { LazyMotion, domAnimation, m } from 'framer-motion';
  // wrap the overlay root once in <LazyMotion features={domAnimation}> … use <m.div> everywhere
  ```

### 6.2 Motion tokens

Centralize in `src/ui/motion/tokens.ts`. Every animation references these — no ad-hoc durations.

```ts
export const duration = {
  fast: 0.12,   // hovers, small state flips
  base: 0.2,    // most enters/exits, dropdowns
  slow: 0.32,   // modal/overlay, larger surfaces
  celebrate: 0.6, // completion moment
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1],   // decelerate — enters
  accelerate: [0.4, 0, 1, 1], // exits
  emphasized: [0.2, 0, 0, 1],
} as const;

export const spring = {
  default: { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 },
  gentle:  { type: 'spring', stiffness: 180, damping: 26 }, // progress bar, toggles
  snappy:  { type: 'spring', stiffness: 500, damping: 32 }, // toggle thumb, chips
} as const;
```

### 6.3 Overlays, modals & dropdowns

- **Overlay/modal enter:** backdrop `opacity 0→1` (`duration.base`); panel `opacity 0→1` + `scale 0.96→1` + `y 8→0` with `spring.default`. Exit reverses with `duration.fast`, `ease.accelerate`. Wrap in `AnimatePresence`.
- **Dropdown/popover:** `opacity 0→1` + `scale 0.98→1` + `y -4→0`, `duration.fast`, transform-origin at trigger edge.
- **Stepper transitions:** content cross-fades + slides (`x ±12`) directionally (forward/back) with `duration.base`; use `AnimatePresence mode="wait"`.

### 6.4 Form controls

- **Checkbox:** the check path draws via `pathLength 0→1` (`duration.fast`); box fill fades in.
- **Toggle thumb:** slides with `spring.snappy`; track color transitions `duration.fast`.
- **Input focus:** border-color + ring via CSS transition (`duration.fast`) — cheaper than JS for high-frequency focus events.
- **File drop:** on drag-over, `scale 1→1.01` + border color, `spring.gentle`.

### 6.5 The send flow (the important one)

- **Progress fill:** width animates with `spring.gentle` on every increment — never a linear jump. Feels like momentum, not a stutter.
- **`sending` status dot:** looped `opacity 1→0.4→1` pulse (2s, `easeInOut`), and a subtle `scale 1→1.15` breathing. This is the *only* continuously-looping animation in the app — it signals live activity.
- **Row status flip** (`pending→sent`): the status dot color-transitions and the row does a one-shot `brand-50` background flash decaying to transparent (`duration.slow`) — a quiet "just happened" acknowledgment as rows complete.
- **Completion moment:** when the campaign finishes, the progress fill morphs to `success-fg`, a `check-circle-2` scales in with `spring.default`, and the SummaryReport reveals with a staggered children fade-up (`staggerChildren: 0.05`). This is the one place `duration.celebrate` is allowed — a small, earned moment, not confetti.

### 6.6 Toasts & lists

- **Toast:** enter `y 16→0` + `opacity 0→1` (`spring.gentle`); exit `opacity→0` + `scale 0.96` (`duration.fast`). Stacking reflows with `layout`.
- **List add/remove** (recipient rows, tokens): use `layout` + `AnimatePresence` so insertions/removals reflow smoothly. **Disable `layout` animation on the virtualized recipient table body** (thousands of rows) — animate only the bulk-actions bar and selection highlights there, not every row, to protect scroll performance.

### 6.7 Accessibility — reduced motion (mandatory)

```tsx
const reduce = useReducedMotion();
```

- When `prefers-reduced-motion: reduce` is set: **disable** all scale/slide/spring transforms and the pulse loop; keep **opacity-only** cross-fades at `duration.fast`. Progress bar updates instantly (no spring). The completion check appears without scaling.
- Never gate *information* behind motion — the pulsing dot's meaning is duplicated by its color and text label.

---

## 7. Integration Spec — Overview

The frontend talks to **six** external surfaces. This table is the map; §8–§11 are the detail. Note the strict data boundary from ARCHITECTURE §0 and SECURITY_AND_ACCESS §0:

| # | Service | What it does for Fanout | Who calls it | Carries recipient PII / email content? |
|---|---|---|---|---|
| 1 | **Google Identity (`chrome.identity`)** | Signs the user in; issues the `gmail.send` access token & Google ID token | Extension (service worker) | No — identity only |
| 2 | **Gmail REST API** | Sends each individual personalized email | Extension (service worker) → **directly to Google** | **Yes** — but only browser→Google, never via our backend |
| 3 | **Google People API** | Imports the user's own Google Contacts as recipients (optional import method) | Extension (service worker) | Yes — stays client-side in IndexedDB |
| 4 | **Fanout Backend** | Verifies identity, returns plan/entitlements, records aggregate usage | Extension → our API | **No** — identity, plan, and counts only |
| 5 | **Stripe** | Subscription checkout & billing management | User's browser → Stripe hosted pages (opened by extension); truth via backend webhooks | No — card data never touches us |
| 6 | **Sentry** | Error/telemetry monitoring | Extension + backend | **No — PII scrubbed before send** |

> **The load-bearing rule for every request below:** the arrow carrying email content (Gmail, #2) goes *directly* browser→Google. Our backend (#4) only ever sees identity, plan status, and aggregate counts. Any spec that violates this is wrong (ARCHITECTURE §0, SECURITY_AND_ACCESS §3.1).

Auth model is **Option A** (`chrome.identity.getAuthToken`) per ARCHITECTURE §5 and SECURITY_AND_ACCESS §1.1 — the `/auth/*` endpoints and `google_tokens` table exist in the schema as the documented Option-B upgrade path but are **not called by the MVP frontend**.

---

## 8. Integration #1 & #2 — Google Identity + Gmail API

### 8.1 Google Identity — sign-in & token acquisition

**What it does:** Chrome brokers the Google login and hands the extension a short-lived OAuth access token scoped to `gmail.send`, plus (via the same account) the Google **ID token** used to identify the user to our backend. No password, no refresh token stored by us (SECURITY_AND_ACCESS §1.1).

**Manifest configuration** (not a runtime call, but the contract):
```jsonc
"oauth2": {
  "client_id": "<VITE_GOOGLE_OAUTH_CLIENT_ID>",
  "scopes": [
    "https://www.googleapis.com/auth/gmail.send",
    "openid", "email", "profile"
  ]
}
```
> Scope list is **exactly** these four — no read/delete/full-mailbox scopes (SECURITY_AND_ACCESS §1.3, §6 checklist).

**Get an access token (interactive on first run, silent thereafter):**
```ts
chrome.identity.getAuthToken({ interactive: true }, (token) => { ... });
```
- **Sends:** nothing but the request for the manifest's scopes.
- **Receives:** an OAuth 2.0 access token string (short-lived, ~1h, auto-cached & re-issued by Chrome).
- **Frontend handling:**
  - Cancelled sign-in → SECURITY_AND_ACCESS §4.1 copy, return to sign-in screen.
  - Denied `gmail.send` → explain the single permission, offer re-request, never proceed to compose.
  - Token expired mid-send → call `getAuthToken` again silently; if it fails, `removeCachedAuthToken` then re-prompt (Reconnect dialog §5.4).
  - **On any Gmail 401:** `chrome.identity.removeCachedAuthToken({ token })` and retry once with a fresh token before surfacing an error.

**Get the account identity for detecting Workspace vs. consumer** (drives the daily-cap default, SECURITY_AND_ACCESS §4.3): read the ID token's `hd` (hosted-domain) claim — present ⇒ Workspace (cap 2000), absent ⇒ consumer Gmail (cap 500). When unknown, **default to the safer 500** (SECURITY_AND_ACCESS §4.3).

### 8.2 Gmail API — sending one individual email

This is the core primitive. Called **once per recipient**, from the service worker, throttled by the send engine (ARCHITECTURE §7).

**Endpoint:**
```
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request body:** a single JSON field, `raw` — the **base64url-encoded RFC 2822 message** built by `mimeBuilder.ts` (ARCHITECTURE §2.1). Per-recipient personalization tokens are already rendered into the subject/body, and all token values are **HTML-escaped/sanitized** first (SECURITY_AND_ACCESS §5.2).

```jsonc
{
  "raw": "<base64url of the full MIME message>"
}
```

The MIME message the builder produces (multipart/alternative, UTF-8):
```
From: Sam Founder <you@company.com>
To: Jordan Lee <jordan@acme.com>
Subject: =?UTF-8?B?...?=            // encoded-word for non-ASCII subjects
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="fanout-<uuid>"

--fanout-<uuid>
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

Hi Jordan, ...                       // bodyText, tokens filled

--fanout-<uuid>
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

<p>Hi Jordan, ...</p>                // bodyHtml, tokens filled & escaped
--fanout-<uuid>--
```
- **One recipient per message.** Never populate `To` with more than one address; never use CC/BCC (PRD §1, §6.1). This is the product.
- UTF-8 end-to-end so "José"/"田中" render correctly (SECURITY_AND_ACCESS §5.2).

**Expected success response (HTTP 200):**
```jsonc
{
  "id": "18f2a1b3c4d5e6f7",          // Gmail message id — store on the recipient row
  "threadId": "18f2a1b3c4d5e6f7",
  "labelIds": ["SENT"]
}
```
The frontend records `id` as `gmailMessageId` on the recipient (proof of send; ARCHITECTURE §4.1, SECURITY_AND_ACCESS §4.2) and flips the row to `sent`.

**Error responses — classify into three buckets (SECURITY_AND_ACCESS §4.2):**

| HTTP | `error.errors[].reason` | Bucket | Frontend action |
|---|---|---|---|
| `429` | `rateLimitExceeded`, `userRateLimitExceeded` | **Transient** | Exponential backoff, up to 3 attempts, then mark `failed`, continue. Log to `sendLogs`. |
| `500`/`502`/`503` | server errors | **Transient** | Same as above. |
| `400` | `invalidArgument` | **Permanent** | Mark recipient `failed` immediately, clear reason, **never retry**, move on. |
| `403` | `dailyLimitExceeded`, sending disabled, account flagged | **Account-level** | **STOP the whole campaign**, no more attempts, show the Account-level stop dialog (§5.4). |
| `401` | invalid credentials | (auth) | Refresh token once (§8.1); if still failing, Reconnect dialog. |

- Every attempt (success or failure) writes a `sendLogs` row with `outcome`, `httpStatus`, `errorCode` (ARCHITECTURE §4.1, SECURITY_AND_ACCESS §4.2).
- **Before each send**, re-check inside a Dexie transaction that the recipient is still `pending` (idempotency — prevents double-send on worker restart; ARCHITECTURE §7.5, SECURITY_AND_ACCESS §4.6).
- **Retries count against the daily cap** and respect the throttle (SECURITY_AND_ACCESS §4.2).

---

## 9. Integration #3 — Google People API (Contacts import)

**What it does:** lets the user pick recipients from their own Google Contacts as an alternative to CSV (PRD §5, step 5). Optional import method; the contact data lands in IndexedDB like any imported list and never touches our backend.

> **Scope caution:** reading contacts requires `https://www.googleapis.com/auth/contacts.readonly`, an **additional restricted scope** that lengthens Google's review (SECURITY_AND_ACCESS §1.3–1.4). Recommendation: ship CSV + paste for the MVP and **gate Contacts import behind an incremental auth prompt** (request `contacts.readonly` only when the user chooses "Import from Contacts"), or defer it to fast-follow. The UI's third import card ("Google Contacts") should reflect whichever path is chosen. Spec below assumes incremental consent.

**Incremental scope grant:** call `getAuthToken` with the extra scope only when the user selects Contacts:
```ts
chrome.identity.getAuthToken(
  { interactive: true, scopes: ["https://www.googleapis.com/auth/contacts.readonly"] },
  cb
);
```

**Endpoint (list connections):**
```
GET https://people.googleapis.com/v1/people/me/connections
      ?personFields=names,emailAddresses
      &pageSize=1000
      &pageToken=<token>          // paginate until absent
Authorization: Bearer <access_token>
```
- **Sends:** the `personFields` filter (request **only** names + email — least data, matching the least-access principle).
- **Receives:**
```jsonc
{
  "connections": [
    {
      "names": [{ "displayName": "Jordan Lee", "givenName": "Jordan", "familyName": "Lee" }],
      "emailAddresses": [{ "value": "jordan@acme.com" }]
    }
  ],
  "nextPageToken": "…",
  "totalPeople": 812
}
```
- **Frontend handling:** map `givenName`→`FirstName`, `familyName`→`LastName`, `emailAddresses[0].value`→`email`; present in the same RecipientTable + ColumnMapper flow. Skip contacts with no email (flag as skipped, §5.5). Paginate transparently with a loading skeleton. Store to IndexedDB; **never** send to our backend.

---

## 10. Integration #4 — Fanout Backend

Base URL: `VITE_BACKEND_URL` (e.g. `https://api.fanout.app`). **Every request** carries the Google **ID token** as a bearer credential; the backend verifies its signature against Google's public keys on every call (SECURITY_AND_ACCESS §1.5, §3.2). The frontend never sends recipient data or email content here (ARCHITECTURE §0).

```
Authorization: Bearer <google_id_token>
Content-Type: application/json
```

### 10.1 `GET /license` — plan & entitlements

Called on popup open, before a send, and periodically. Drives plan-gated UI (quota display, PRO badges, upgrade prompts).

- **Sends:** ID token only (identity derived server-side from the verified `sub` — never trust a client-supplied user id, SECURITY_AND_ACCESS §3.2).
- **Receives:**
```jsonc
{
  "plan": "free",                    // "free" | "pro" | "team"
  "status": "active",                // "active" | "trialing" | "past_due" | "canceled"
  "entitlements": {
    "monthlyQuota": 300,             // free-tier cap (value TBD — PRD open Q#1)
    "sentThisPeriod": 142,
    "periodResetsAt": "2026-08-01T00:00:00Z",
    "features": { "openTracking": false, "scheduling": false }
  },
  "currentPeriodEnd": null           // ISO ts when paid period ends (grace handling)
}
```
- **Frontend handling:**
  - Show remaining quota ("158 of 300 left this month").
  - **Backend unreachable →** fail *toward* the user for a short grace window using the last cached entitlement; **never invent new paid access offline** (SECURITY_AND_ACCESS §4.5). Cache the last good response in IndexedDB `settings`.
  - **Free quota exceeded →** block further sends cleanly, show upgrade CTA, **don't lose the drafted campaign** (SECURITY_AND_ACCESS §4.5).
  - Plan status is **display/gating only**; the money-gating source of truth is the server (Stripe webhooks), never the client (SECURITY_AND_ACCESS §3.4).

### 10.2 `POST /usage` — report aggregate send count

Called after a campaign (or in batches during a long one) to reconcile freemium usage. **Counts only — never who was emailed** (ARCHITECTURE §4.2, SECURITY_AND_ACCESS §3.2).

- **Sends:**
```jsonc
{
  "period": "2026-07",               // usage window
  "sentCount": 200                   // aggregate successful sends to report (a number)
}
```
- **Receives:**
```jsonc
{ "period": "2026-07", "sentCount": 342, "accepted": true }   // server's reconciled total
```
- **Frontend handling:** treat client counts as **advisory** (server reconciles, SECURITY_AND_ACCESS §3.4); update the displayed remaining quota from the response, not from the local number. Idempotent-safe to retry on network failure.

### 10.3 Auth endpoints (`/auth/exchange`, `/auth/refresh`) — **not called in MVP**

These exist for the Option-B server-side OAuth upgrade path (scheduled/offline sending). The MVP frontend uses `chrome.identity` (Option A) and **does not call them** (ARCHITECTURE §5, SECURITY_AND_ACCESS §1.1). Documented here so no one wires them up prematurely; revisit under a fresh security review when scheduling ships.

---

## 11. Integration #5 & #6 — Stripe + Sentry

### 11.1 Stripe — subscription checkout & management

**What it does:** handles all payment/subscription flow. **The extension never touches card data** — it opens Stripe's hosted pages and lets the backend/webhooks be the source of truth (ARCHITECTURE §2.2, SECURITY_AND_ACCESS §2.2, §3.2).

**Frontend flow (no direct Stripe API calls from the client):**

1. **Start checkout** — user clicks "Upgrade to Pro" (options page / quota-exceeded prompt). Extension calls **our** backend:
   ```
   POST {VITE_BACKEND_URL}/billing/checkout   (Authorization: Bearer <id_token>)
   → { "plan": "pro" }
   ```
   Backend responds with a Stripe Checkout URL:
   ```jsonc
   { "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_live_…" }
   ```
   Extension opens it in a new tab (`chrome.tabs.create`) — **never** an iframe inside the extension.
2. **Manage subscription** — "Manage billing" opens the Stripe Customer Portal via `POST /billing/portal → { portalUrl }`. Handles plan changes, cancellation, card updates, dunning.
3. **After return** — the extension does **not** trust the redirect as proof of payment. It re-fetches `GET /license` (§10.1). Plan only becomes `pro` once the **Stripe webhook** reaches our backend (SECURITY_AND_ACCESS §3.2, §4.5) — the frontend polls `/license` briefly to bridge the webhook-delay window (SECURITY_AND_ACCESS §5.4), showing a "Confirming your upgrade…" state rather than flipping to Pro optimistically.

**Frontend states to implement:**
- `past_due` / payment failed → non-blocking banner "There's a problem with your payment. Update your card to keep Pro features." + "Update card" (portal). Honor grace period; downgrade only when `/license` reports it (SECURITY_AND_ACCESS §4.5).
- `canceled` but period not ended → keep Pro features until `currentPeriodEnd`; show "Pro until Aug 1."

> Webhook verification, idempotency, and plan mutation are **backend** responsibilities (SECURITY_AND_ACCESS §4.5, §5.4). The frontend's only job: open hosted pages, then trust `/license`.

### 11.2 Sentry — error monitoring (PII-scrubbed)

**What it does:** captures runtime errors (especially Gmail send failures — the #1 support surface, ARCHITECTURE §2.3). Initialized in both the service worker and UI with `VITE_SENTRY_DSN`.

- **Sends:** exception/event data **after PII scrubbing** — this is a hard requirement, not a nicety (SECURITY_AND_ACCESS §5.6).
- **`beforeSend` scrub rules (mandatory):**
  - **Strip** recipient email addresses, names, any `fields`/token values, subject, and body from every event, breadcrumb, and message.
  - Redact anything matching an email regex in error strings.
  - Allowed context: Gmail error `reason`/`httpStatus`, campaign id (a UUID, not content), send-engine state, plan tier, extension version, anonymized user id (`sub` hash — not the email).
  - Set `sendDefaultPii: false`; disable automatic capture of request bodies.
- **Frontend handling:** errors surface to the user via §5.11 patterns with plain-English copy; Sentry capture is silent/background. Audit the scrubber before launch (SECURITY_AND_ACCESS §6 checklist).

---

## 12. Accessibility Requirements

- **Keyboard:** full flow operable without a mouse. Tab order follows visual order; `Enter`/`Space` activate; `Esc` closes dismissible dialogs (never during an active send). Focus is trapped in modals and returned on close.
- **Focus visible:** always `shadow-focus`; never `outline: none` without a replacement.
- **ARIA:** dialogs `role="dialog" aria-modal="true"` with labelled title; the progress bar `role="progressbar"` with `aria-valuenow/min/max`; live send updates announced via an `aria-live="polite"` region ("142 of 200 sent") — throttled to avoid spamming screen readers.
- **Contrast:** all text meets WCAG AA (§2.5); status is never conveyed by color alone (dot + label + text).
- **Reduced motion:** honored everywhere (§6.7).
- **Touch/hit targets:** interactive controls ≥ 32×32px effective (buttons default to 36px).
- **Localization-ready:** no text baked into images; UTF-8 throughout; layouts tolerate ~30% text expansion.

---

## 13. Appendix — Design Tokens as Code

### 13.1 CSS custom properties (declare on the Shadow DOM `:host`)

```css
:host, :root {
  /* Brand — Indigo */
  --brand-50:#EEF2FF; --brand-100:#E0E7FF; --brand-200:#C7D2FE; --brand-300:#A5B4FC;
  --brand-400:#818CF8; --brand-500:#6366F1; --brand-600:#4F46E5; --brand-700:#4338CA;
  --brand-800:#3730A3; --brand-900:#312E81; --brand-950:#1E1B4B;
  /* Neutral — Slate */
  --neutral-0:#FFFFFF; --neutral-50:#F8FAFC; --neutral-100:#F1F5F9; --neutral-200:#E2E8F0;
  --neutral-300:#CBD5E1; --neutral-400:#94A3B8; --neutral-500:#64748B; --neutral-600:#475569;
  --neutral-700:#334155; --neutral-800:#1E293B; --neutral-900:#0F172A; --neutral-950:#020617;
  /* Semantic */
  --success-fg:#15803D; --success-bg:#F0FDF4; --success-border:#BBF7D0;
  --warning-fg:#B45309; --warning-bg:#FFFBEB; --warning-border:#FDE68A;
  --danger-fg:#B91C1C;  --danger-bg:#FEF2F2;  --danger-border:#FECACA;
  --info-fg:#1D4ED8;    --info-bg:#EFF6FF;    --info-border:#BFDBFE;
  --pending-fg:#475569; --pending-bg:#F1F5F9; --pending-border:#E2E8F0;
  /* Aliases (light) */
  --surface:var(--neutral-0); --surface-raised:var(--neutral-0); --surface-sunken:var(--neutral-50);
  --text-primary:var(--neutral-800); --text-secondary:var(--neutral-600); --text-muted:var(--neutral-500);
  --border:var(--neutral-200); --border-strong:var(--neutral-300);
  --brand:var(--brand-600); --brand-hover:var(--brand-700); --focus-ring:var(--brand-500);
  /* Type */
  --font-sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  --font-mono:'JetBrains Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  /* Radius */
  --radius-sm:6px; --radius-md:8px; --radius-lg:12px; --radius-xl:16px; --radius-full:9999px;
  /* Shadows */
  --shadow-xs:0 1px 2px rgba(15,23,42,.06);
  --shadow-sm:0 1px 3px rgba(15,23,42,.08),0 1px 2px rgba(15,23,42,.04);
  --shadow-md:0 4px 12px rgba(15,23,42,.10);
  --shadow-lg:0 12px 32px rgba(15,23,42,.14);
  --shadow-focus:0 0 0 3px rgba(99,102,241,.45);
}
:host([data-theme="dark"]), :root[data-theme="dark"] {
  --surface:#0F172A; --surface-raised:#1E293B; --surface-sunken:#020617;
  --text-primary:#F1F5F9; --text-secondary:#94A3B8; --text-muted:#64748B;
  --border:#334155; --border-strong:#475569;
  --brand:#818CF8; --brand-hover:#A5B4FC; --focus-ring:#818CF8;
}
```

### 13.2 `tailwind.config.ts` (extension)

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#EEF2FF',100:'#E0E7FF',200:'#C7D2FE',300:'#A5B4FC',400:'#818CF8',
                 500:'#6366F1',600:'#4F46E5',700:'#4338CA',800:'#3730A3',900:'#312E81',950:'#1E1B4B' },
        neutral: { 0:'#FFFFFF',50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',
                   500:'#64748B',600:'#475569',700:'#334155',800:'#1E293B',900:'#0F172A',950:'#020617' },
        success:{ fg:'#15803D', bg:'#F0FDF4', border:'#BBF7D0' },
        warning:{ fg:'#B45309', bg:'#FFFBEB', border:'#FDE68A' },
        danger: { fg:'#B91C1C', bg:'#FEF2F2', border:'#FECACA' },
        info:   { fg:'#1D4ED8', bg:'#EFF6FF', border:'#BFDBFE' },
        // semantic aliases wired to CSS vars for theme flips
        surface:'var(--surface)', 'surface-sunken':'var(--surface-sunken)',
        'text-primary':'var(--text-primary)', 'text-secondary':'var(--text-secondary)',
        'text-muted':'var(--text-muted)', border:'var(--border)',
      },
      fontFamily: { sans:['Inter','sans-serif'], mono:['"JetBrains Mono"','monospace'] },
      fontSize: {
        display:['1.75rem',{lineHeight:'1.2',letterSpacing:'-0.02em',fontWeight:'700'}],
        h1:['1.375rem',{lineHeight:'1.25',letterSpacing:'-0.01em',fontWeight:'700'}],
        h2:['1.125rem',{lineHeight:'1.3',fontWeight:'600'}],
        h3:['1rem',{lineHeight:'1.4',fontWeight:'600'}],
        body:['0.875rem',{lineHeight:'1.5'}],
        label:['0.8125rem',{lineHeight:'1.4',fontWeight:'500'}],
        caption:['0.75rem',{lineHeight:'1.4',fontWeight:'500'}],
        overline:['0.6875rem',{lineHeight:'1.3',letterSpacing:'0.08em',fontWeight:'600'}],
      },
      borderRadius: { sm:'6px', md:'8px', lg:'12px', xl:'16px' },
      boxShadow: {
        xs:'0 1px 2px rgba(15,23,42,.06)',
        sm:'0 1px 3px rgba(15,23,42,.08),0 1px 2px rgba(15,23,42,.04)',
        md:'0 4px 12px rgba(15,23,42,.10)',
        lg:'0 12px 32px rgba(15,23,42,.14)',
        focus:'0 0 0 3px rgba(99,102,241,.45)',
      },
      zIndex: { backdrop:'10', modal:'20', popover:'30', toast:'40' },
    },
  },
  plugins: [],
} satisfies Config;
```

### 13.3 Dependencies to add

```bash
# Motion (required per product request)
pnpm --filter @fanout/extension add framer-motion
# Supporting UI libs referenced in this spec
pnpm --filter @fanout/extension add lucide-react @tanstack/react-virtual
# Fonts (self-hosted, bundled — no CDN)
pnpm --filter @fanout/extension add @fontsource/inter @fontsource/jetbrains-mono
```

---

## 14. Open Questions for Design Sign-off

1. **Free-tier monthly quota** (PRD open Q#1) — the number shown in `/license.entitlements.monthlyQuota` and the quota UI. Must be locked before launch; the UI is built to display whatever it is.
2. **Google Contacts import in MVP or fast-follow?** Adds the `contacts.readonly` restricted scope and lengthens Google's review (§9). Recommendation: incremental-consent or defer.
3. **Overlay dark mode** — do we fully theme the in-Gmail overlay for Gmail Dark, or keep it light-on-dimmed-backdrop for v1? (Popup/options are fully themed regardless.)
4. **Wordmark/logo asset** — this spec assumes a `◆ Fanout` indigo wordmark; final logo TBD from brand.

---

*This document is the frontend counterpart to the PRD, Architecture, and Security docs. It inherits their constraints — client-heavy, backend-light, Option-A auth, PII-never-leaves-the-browser. Two future features (scheduled sending, open/click tracking) change both the data flow and this spec's integration section; revisit §7–§11 before either ships.*
