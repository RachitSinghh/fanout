'use client';

import Link from 'next/link';
import {
  LockSimple, GoogleChromeLogo, UsersThree, CheckCircle, CircleNotch, Clock,
  BracketsCurly, ShieldCheck, ArrowsClockwise, LockKey, Timer, EnvelopeOpen,
  Plus, PaperPlaneTilt, XCircle,
} from '@phosphor-icons/react';
import { Reveal } from '@/components/marketing/reveal';
import { ProductTour } from '@/components/marketing/product-tour';
import { CustomCursor } from '@/components/marketing/custom-cursor';
import { Magnetic } from '@/components/marketing/magnetic';
import { CountUp } from '@/components/marketing/count-up';
import { Tagline } from '@/components/marketing/tagline';

const TOKEN = (t: string) => <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-accent">{`{{${t}}}`}</span>;

// [dimension, how Fanout does it, how typical server based blasters do it]
const COMPARISON: [string, string, string][] = [
  ['How each email is sent', 'One gmail.send per person, straight from your own Gmail', 'Blasted from shared sending servers you rent'],
  ['Where your contact list lives', 'In your browser, never uploaded anywhere', 'Uploaded to and stored on their backend'],
  ['Open and click tracking', 'None. No pixel and no rewritten links', 'A tracking pixel and rewritten links in every message'],
  ['Sending reputation', 'Yours, guarded by daily caps and randomized throttling', 'A shared IP pool you do not control'],
  ['What the recipient gets', 'A normal email that threads back into your inbox', 'A tracked broadcast from a bulk system'],
  ['What it costs', 'Free while in beta, no card and no account with us', 'A monthly subscription per seat'],
];

export default function Home() {
  return (
    <>
      <CustomCursor />
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-40">
        <nav className="mx-auto mt-6 flex w-max max-w-[calc(100%-2rem)] items-center gap-6 rounded-full border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-2xl">
          <a href="#top" className="focus-ring flex items-center gap-2 pl-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-warm"><PaperPlaneTilt weight="bold" /></span>
            <span className="font-semibold tracking-tight">Fanout</span>
          </a>
          <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a href="#how" className="focus-ring transition-colors hover:text-white">How it works</a>
            <a href="#compare" className="focus-ring transition-colors hover:text-white">Compare</a>
            <a href="#safety" className="focus-ring transition-colors hover:text-white">Safety</a>
            <a href="#faq" className="focus-ring transition-colors hover:text-white">FAQ</a>
          </div>
          <Magnetic>
            <a href="#install" className="focus-ring rounded-full bg-accent px-3 py-2 text-sm font-semibold text-warm transition-all hover:scale-[1.03] active:scale-[0.98]">Add to Chrome</a>
          </Magnetic>
        </nav>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="relative px-4 pt-40 pb-24 md:pt-48 md:pb-28">
          <Reveal className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
              <LockSimple className="text-accent" /> No server. Your list never leaves the browser.
            </span>
            <h1 className="heading-grad mx-auto mt-6 max-w-[680px] text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              Personalized outreach<br />from your own Gmail,<br />one real email at a time
            </h1>
            <p className="mx-auto mt-6 max-w-[680px] text-lg text-white/70">
              Fanout sends N individual emails, one <code className="font-mono text-base text-accent">gmail.send</code> per person, with per recipient tokens, randomized throttling, and a daily cap that protects your account.
            </p>
            <div id="install" className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Magnetic>
                <a href="#install" className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-warm transition-all hover:scale-[1.03] active:scale-[0.98] sm:w-auto">
                  <GoogleChromeLogo weight="bold" /> Add to Chrome — free
                </a>
              </Magnetic>
              <a href="#how" className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold transition-all hover:bg-white/10 active:scale-[0.98] sm:w-auto">
                See how it sends
              </a>
            </div>
            <p className="mt-4 text-sm text-white/45">Free while in beta · Works with consumer Gmail and Workspace</p>
          </Reveal>

          {/* HERO VISUAL */}
          <Reveal className="mx-auto mt-16 max-w-4xl" delay={0.1}>
            <div className="rounded-2xl border border-line bg-surface p-2 shadow-2xl shadow-black/60">
              <div className="overflow-hidden rounded-xl border border-line bg-raised">
                <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-hi" />
                  <span className="h-3 w-3 rounded-full bg-hi" />
                  <span className="h-3 w-3 rounded-full bg-hi" />
                  <span className="ml-3 font-mono text-sm text-white/40">mail.google.com</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1 text-sm font-semibold text-accent"><UsersThree /> Bulk Personalize</span>
                </div>
                <div className="grid gap-px bg-line md:grid-cols-2">
                  <div className="bg-raised p-6">
                    <p className="mb-3 text-sm text-white/40">Subject</p>
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">Quick question, {TOKEN('FirstName|there')}</div>
                    <p className="mt-5 mb-3 text-sm text-white/40">Body</p>
                    <div className="space-y-3 rounded-lg border border-line bg-surface px-3 py-3 text-sm leading-relaxed text-white/80">
                      <p>Hi {TOKEN('FirstName')},</p>
                      <p>Saw that {TOKEN('Company')} just opened its Denver office. Congrats on the move.</p>
                      <p className="text-white/40">Best,<br />Nita</p>
                    </div>
                  </div>
                  <div className="bg-raised p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Sending campaign</p>
                      <span className="inline-flex items-center gap-1.5 text-sm text-accent"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> live</span>
                    </div>
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface"><div className="bar-fill h-full rounded-full bg-accent" /></div>
                    <div className="mt-2 flex justify-between text-sm text-white/45"><span>184 of 297 sent</span><span>next in 14s</span></div>
                    <ul className="mt-5 space-y-2 text-sm">
                      <li className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2"><CheckCircle weight="bold" className="text-accent" /> priya.nair@northwind.co <span className="ml-auto font-mono text-white/35">sent</span></li>
                      <li className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2"><CheckCircle weight="bold" className="text-accent" /> deshawn.owens@harbor.io <span className="ml-auto font-mono text-white/35">sent</span></li>
                      <li className="flex items-center gap-2 rounded-lg border border-hi bg-surface px-3 py-2"><CircleNotch className="text-white/50" /> mara.koenig@lattice.dev <span className="ml-auto font-mono text-accent">sending</span></li>
                      <li className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 opacity-50"><Clock className="text-white/40" /> tomas.rivera@brightpath.app <span className="ml-auto font-mono text-white/35">queued</span></li>
                    </ul>
                    <p className="mt-4 text-sm text-white/40">Randomized 8 to 30s gap · daily cap 500 of 500 tracked</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* PRODUCT TOUR */}
        <section id="tour" className="px-4 pb-24">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto mb-12 max-w-2xl text-center">
              <p className="text-sm font-semibold text-accent">A look inside</p>
              <h2 className="heading-grad mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">Five calm steps, one window that never leaves Gmail</h2>
              <p className="mt-4 text-lg text-white/60">Watch the whole flow, from a raw list to a finished send.</p>
            </Reveal>
            <Reveal><ProductTour /></Reveal>
            <p className="mt-4 text-center text-sm text-white/40">Use the steps above, arrow keys, or the buttons to move.</p>
          </div>
        </section>

        {/* STAT BAND */}
        <section aria-label="Key numbers" className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 py-12 text-center md:grid-cols-4">
            {([
              [1, 'gmail.send per recipient, never a shared BCC'],
              [2000, 'daily cap on Workspace, 500 on consumer Gmail'],
              [5000, 'recipients per campaign, sent one by one'],
              [0, 'servers, your data stays in the browser'],
            ] as [number, string][]).map(([n, label]) => (
              <Reveal key={label}>
                <p className="heading-grad text-4xl font-semibold"><CountUp to={n} /></p>
                <p className="mt-2 text-sm text-white/55">{label}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* PROBLEM */}
        <section className="px-4 py-24">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold text-accent">The problem</p>
            <h2 className="heading-grad mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">Mail merge tools route through a stranger&apos;s servers</h2>
            <p className="mt-5 text-lg text-white/65">Most bulk senders upload your contact list to their backend, blast from a shared IP, and put your Gmail reputation in someone else&apos;s hands. Fanout does the opposite. It drives your own Gmail from inside the browser, sends each message as a distinct email, and keeps every name, address, and note on your machine.</p>
          </Reveal>
        </section>

        {/* COMPARISON */}
        <section id="compare" className="px-4 py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto mb-14 max-w-2xl text-center">
              <p className="text-sm font-semibold text-accent">Fanout vs the blast tools</p>
              <h2 className="heading-grad mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">A personalization tool, not a mail blaster</h2>
              <p className="mt-4 text-lg text-white/60">The usual mass senders route your list and your reputation through their own servers to hit volume. Fanout gives that up on purpose, so the trade is real. Here is where the two part ways.</p>
            </Reveal>
            <Reveal className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="grid grid-cols-[1.3fr_1fr_1fr] border-b border-line text-sm font-semibold">
                <div className="px-4 py-4 text-white/45 md:px-6" />
                <div className="flex items-center gap-2 bg-warm px-4 py-4 md:px-6">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent text-warm"><PaperPlaneTilt weight="bold" className="text-sm" /></span>
                  Fanout
                </div>
                <div className="px-4 py-4 text-white/55 md:px-6">Typical mass mailers</div>
              </div>
              {COMPARISON.map(([dimension, fanout, others]) => (
                <div key={dimension} className="grid grid-cols-[1.3fr_1fr_1fr] border-b border-line text-sm last:border-b-0">
                  <div className="px-4 py-4 font-medium text-white/70 md:px-6">{dimension}</div>
                  <div className="flex items-start gap-2 bg-warm px-4 py-4 text-white/85 md:px-6">
                    <CheckCircle weight="fill" className="mt-0.5 shrink-0 text-accent" />
                    <span>{fanout}</span>
                  </div>
                  <div className="flex items-start gap-2 px-4 py-4 text-white/50 md:px-6">
                    <XCircle weight="fill" className="mt-0.5 shrink-0 text-white/25" />
                    <span>{others}</span>
                  </div>
                </div>
              ))}
            </Reveal>
            <p className="mt-4 text-center text-sm text-white/40">If you need open tracking, inbox rotation, and thousands of sends a day, a server based blaster is the right tool. If you want each email to genuinely come from you, this is.</p>
          </div>
        </section>

        {/* BENEFITS */}
        <section id="safety" className="px-4 pb-8">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="heading-grad text-3xl font-semibold tracking-tight text-balance md:text-4xl">Built to protect the account you send from</h2>
              <p className="mt-4 text-lg text-white/60">Every design choice bends toward keeping your Gmail healthy.</p>
            </Reveal>
            <div className="grid gap-4 md:grid-cols-3">
              <Benefit icon={<BracketsCurly weight="bold" className="text-xl" />} title="Real personalization with fallbacks">Drop <code className="font-mono text-sm text-accent">{'{{FirstName|there}}'}</code> anywhere in subject or body. Every value is HTML escaped, and an empty token with no fallback blocks the send instead of leaking a literal brace.</Benefit>
              <Benefit icon={<ShieldCheck weight="bold" className="text-xl" />} title="Account safety comes first">A 403 from Gmail stops the whole campaign, not just one send. Daily caps are checked before every network call, and the throttle floor can never drop to zero.</Benefit>
              <Benefit icon={<ArrowsClockwise weight="bold" className="text-xl" />} title="Resumes exactly where it stopped">The send queue lives in IndexedDB, so if the browser sleeps the worker mid run, Fanout wakes and picks up the next pending recipient. No double sends, ever.</Benefit>
              <Benefit icon={<LockKey weight="bold" className="text-xl" />} title="PII never touches a log">Names, addresses, and message content stay local and get scrubbed out of every log line. There is no backend to breach because there is no backend.</Benefit>
              <Benefit icon={<Timer weight="bold" className="text-xl" />} title="Deliverability aware throttling">Sends land on a randomized 8 to 30 second cadence rather than a robotic tick, so your pattern reads like a human, not a firehose.</Benefit>
              <Benefit icon={<EnvelopeOpen weight="bold" className="text-xl" />} title="Lives inside Gmail">A Bulk Personalize button appears right in compose. Replies come back to your inbox, threading and all, because the mail genuinely came from you.</Benefit>
            </div>
          </div>
        </section>

        {/* TAGLINE */}
        <section className="px-4 py-32">
          <Tagline />
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="px-4 pb-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-14 max-w-2xl text-center">
              <p className="text-sm font-semibold text-accent">How it works</p>
              <h2 className="heading-grad mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">Three steps from a list to a warm inbox</h2>
            </Reveal>
            <div className="grid gap-4 md:grid-cols-3">
              <How n="01" title="Open compose, click Bulk Personalize">Write your draft with tokens in plain Gmail. Fanout reads the draft straight from the compose window.</How>
              <How n="02" title="Paste your list, map the columns">Headers like first name and company map to tokens automatically. Fix any mapping, preview a real row, and Fanout flags missing values before you send.</How>
              <How n="03" title="Send and watch it go">One email leaves at a time on a randomized gap. Live progress shows sent, sending, and queued, and you can pause whenever you want.</How>
            </div>
          </div>
        </section>

        {/* PROOF */}
        <section className="px-4 pb-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="heading-grad text-3xl font-semibold tracking-tight text-balance md:text-4xl">People who send from their own name, not a blast IP</h2>
            </Reveal>
            <div className="grid gap-4 md:grid-cols-3">
              <Quote name="Priya Raman" role="Founder, Northwind Labs" initials="PR">Reply rate on my seed round outreach went from a trickle to real conversations. It sends from my actual Gmail, so it threads and it does not look like a broadcast.</Quote>
              <Quote name="Deshawn Owens" role="Talent lead, Harbor" initials="DO">I recruit for three roles at once and personalize every note. The daily cap warnings stopped me from tripping a Workspace limit the week before a big push.</Quote>
              <Quote name="Mara Koenig" role="Growth, Lattice.dev" initials="MK">My laptop slept halfway through a 900 person send and I panicked. Fanout just resumed the next morning at recipient 412 with zero duplicates.</Quote>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="px-4 pb-24">
          <div className="mx-auto max-w-3xl">
            <Reveal className="mb-12 text-center">
              <h2 className="heading-grad text-3xl font-semibold tracking-tight md:text-4xl">Questions worth asking</h2>
            </Reveal>
            <Reveal className="divide-y divide-line rounded-2xl border border-line bg-surface">
              <Faq q="Is this a mass mailer or spam tool?" open>No. Fanout sends one distinct email per recipient with real personalization. There is no shared BCC and no blast. It is meant for warm, individual outreach you would be comfortable sending by hand.</Faq>
              <Faq q="Will Gmail flag or suspend my account?">Fanout stays under Gmail&apos;s own daily limits, 500 on consumer and 2,000 on Workspace, spaces sends on a randomized 8 to 30 second gap, and halts the entire run the moment Gmail returns a 403. Protecting your account is the whole point.</Faq>
              <Faq q="Where does my contact list go?">Nowhere. There is no server. Your list, your draft, and your progress live in the browser&apos;s own storage, and personal data is scrubbed from every log.</Faq>
              <Faq q="What happens if my browser closes mid send?">The queue is stored on disk, so the next time the extension wakes it resumes at the next pending recipient. A recipient is claimed inside a transaction, so a resume can never send the same person twice.</Faq>
              <Faq q="Does it work with both consumer Gmail and Workspace?">Yes. It detects the account type and applies the matching daily cap, and when the type is unknown it defaults to the safer 500 limit.</Faq>
              <Faq q="What permissions does it ask for?">Only the scopes needed to send as you: gmail.send plus basic sign in. It cannot read your inbox, and you connect through Google&apos;s own OAuth screen.</Faq>
              <Faq q="How many recipients can one campaign hold?">Up to 5,000 per campaign. They still go out one at a time under your daily cap, so a large list simply spreads across more days.</Faq>
              <Faq q="What does it cost?">Free while in beta. There is no account to create with us and no card required, because everything runs locally against your own Gmail.</Faq>
            </Reveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="px-4 pb-28">
          <Reveal className="mx-auto max-w-4xl rounded-2xl border border-line bg-warm p-10 text-center md:p-16">
            <h2 className="heading-grad mx-auto max-w-[680px] text-3xl font-semibold tracking-tight text-balance md:text-5xl">Send outreach that reads like it was written for one person</h2>
            <p className="mx-auto mt-5 max-w-[680px] text-lg text-white/65">Because with Fanout, it was. Add the extension, connect your Gmail, and send a test to yourself in under two minutes.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Magnetic>
                <a href="#install" className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-warm transition-all hover:scale-[1.03] active:scale-[0.98] sm:w-auto"><GoogleChromeLogo weight="bold" /> Add to Chrome — free</a>
              </Magnetic>
              <Link href="/dashboard" className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold transition-all hover:bg-white/10 active:scale-[0.98] sm:w-auto">Open dashboard</Link>
            </div>
            <p className="mt-4 text-sm text-white/40">No credit card · No server · Cancel by uninstalling</p>
          </Reveal>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-line px-4 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-warm"><PaperPlaneTilt weight="bold" /></span>
            <span className="font-semibold">Fanout</span>
            <span className="text-sm text-white/40">Personalized bulk email from your own Gmail</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-white/60">
            <a href="#faq" className="focus-ring transition-colors hover:text-white">FAQ</a>
            <a href="#" className="focus-ring transition-colors hover:text-white">Privacy</a>
            <a href="#" className="focus-ring transition-colors hover:text-white">Terms</a>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-sm text-white/30">© 2026 Fanout. Runs entirely in your browser. Fanout is not affiliated with Google. Gmail is a trademark of Google LLC.</p>
      </footer>
    </>
  );
}

function Benefit({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Reveal className="rounded-2xl border border-line bg-surface p-6 ease-fluid transition-all duration-500 hover:-translate-y-1 hover:border-hi">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">{icon}</span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-base text-white/60">{children}</p>
    </Reveal>
  );
}

function How({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <Reveal className="rounded-2xl border border-line bg-surface p-6">
      <span className="font-mono text-sm text-accent">{n}</span>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-base text-white/60">{children}</p>
    </Reveal>
  );
}

function Quote({ name, role, initials, children }: { name: string; role: string; initials: string; children: React.ReactNode }) {
  return (
    <Reveal className="rounded-2xl border border-line bg-surface p-6">
      <blockquote className="text-base text-white/80">{children}</blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-semibold text-warm">{initials}</span>
        <span><span className="block text-sm font-semibold">{name}</span><span className="block text-sm text-white/45">{role}</span></span>
      </figcaption>
    </Reveal>
  );
}

function Faq({ q, children, open }: { q: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group p-6" open={open}>
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between font-semibold">
        {q}
        <Plus className="text-white/40 transition-transform duration-500 group-open:rotate-45" />
      </summary>
      <p className="mt-3 text-base text-white/60">{children}</p>
    </details>
  );
}
