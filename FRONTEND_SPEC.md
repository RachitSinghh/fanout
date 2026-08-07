# Frontend & Design Spec

## Project: Fanout — extension UI + Next.js web app (marketing, user dashboard, admin dashboard)

**Status:** v1.0 — for the v2.0 platform build
**Last Updated:** August 6, 2026
**Companion docs:** [PRD.md](./PRD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [SECURITY_AND_ACCESS.md](./SECURITY_AND_ACCESS.md)

---

## 0. The one design rule

**There is one visual identity, and the landing page already defines it.**
`landing/index.html` is the source of truth for color, type, spacing, motion feel,
and iconography. Every new surface — the rebuilt marketing site, the user dashboard,
the admin dashboard, and the extension overlay — reuses the *same tokens*. We are not
designing three products; we are dressing one product in three contexts.

When building or restyling **any** page, first load the `landing-page-design` skill
(for the marketing site) and keep the `ponytail` skill active (shortest code that
works). Do not invent new colors, fonts, radii, or easings — pull them from §2.

---

## 1. Surfaces & stacks

| Surface | Framework | Component layer | Motion | Notes |
|---|---|---|---|---|
| **Marketing site** (rebuilt from `landing/index.html`) | **Next.js** (App Router) | **shadcn/ui** + **Aceternity** | **Framer Motion + GSAP** (ScrollTrigger) | The heavy motion stack lives **here only**. Port the existing HTML/GSAP page into React. |
| **User dashboard** | Next.js (same app) | shadcn/ui | Framer Motion, restrained | Industrial/data-dense. No GSAP, no scroll theatrics. |
| **Admin dashboard** | Next.js (same app) | shadcn/ui + charts | Minimal | Dense tables + charts. Function over flourish. |
| **Extension overlay / popup / options** | React 18 + Vite + Tailwind (existing) | existing primitives | existing tokens | Unchanged stack (Shadow DOM). Shares the §2 palette only, **not** the web app's Next/shadcn deps. |

> **Motion budget rule:** Aceternity + GSAP + scroll-driven effects are a
> **marketing-page-only** indulgence — they sell. Inside dashboards they cost
> perceived performance and get in the way of data. Dashboards use shadcn's built-in
> transitions and the odd Framer `motion` fade; nothing scroll-triggered.

**"Industrial level" dashboards means:** dense but legible tables, real empty/loading/
error states, keyboard-navigable, virtualized long lists, charts that read at a glance,
and numbers you can trust — not a flashy demo. Build with shadcn's `table`, `card`,
`chart`, `badge`, `dialog`, `sheet`, and `sidebar` primitives.

---

## 2. Design tokens (lifted verbatim from `landing/index.html`)

**Type**
- Sans: **Geist** (400 / 500 / 600 / 700)
- Mono: **Geist Mono** (400 / 500) — for counts, ids, code, metrics
- Heading gradient: `linear-gradient(90deg, #FFFFFF 0%, #9B9B9B 100%)`, clipped to text
- Dark mode is the default (`<html class="dark">`); body text white, `text-wrap: pretty`

**Color** (dark, gold-accented)

| Token | Hex | Use |
|---|---|---|
| `ink` | `#000000` | Page background |
| `surface` | `#181818` | Cards / panels |
| `raised` | `#1F1F1F` | Elevated surfaces, inputs |
| `line` | `#272727` | Borders / dividers |
| `hi` | `#313131` | Hover / highlight borders |
| `warm` | `#131209` | Text **on** the accent |
| `accent` | `#E8B04B` | Primary gold — CTAs, focus, selection, active |

- Selection: `background:#E8B04B; color:#131209`
- Focus ring: `2px solid #E8B04B; outline-offset:2px; border-radius:8px`

**Motion feel**
- Signature easing: `cubic-bezier(0.32, 0.72, 0, 1)` (the "fluid" ease)
- Durations 300–700ms for UI; magnetic buttons + custom arrow cursor are landing-only
- Always honor `prefers-reduced-motion` (the landing page already does — match it)

**Icons:** Phosphor (`@phosphor-icons/react` in the Next.js app; the CDN web font on landing).

---

## 3. Porting the landing page to Next.js (Phase 2, first web task)

`landing/index.html` uses the Tailwind CDN, GSAP/Motion via CDN, Google Fonts, and
Phosphor via CDN. For the Next.js port:

- Move the `tailwind.config` `extend` block (§2 tokens) into the app's Tailwind config.
- Self-host Geist / Geist Mono via `next/font` (also removes an OAuth-review external
  dependency and a CLS source).
- Replace CDN GSAP/Motion with the `gsap` + `framer-motion` npm packages; keep
  ScrollTrigger reveals.
- Rebuild sections as components; **do not** redesign — this is a port, not a redesign.
- Drop the static file once the Next.js route is live and hosted (TICKET for it lives
  in FEATURE_TICKETS Phase 2).

---

## 4. Shared UI tokens as code

Define the palette + easing once (Tailwind theme + a small CSS `:root`) and import it
into both the Next.js app and — where practical — the extension's Tailwind config, so a
future color tweak is one edit. The extension keeps its own build (Vite/Shadow DOM); it
imports the **token values**, not the shadcn component library.
