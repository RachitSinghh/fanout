'use client';

import { useState, useEffect } from 'react';
import {
  UploadSimple, ClipboardText, CloudArrowUp, FileCsv, CheckCircle, ArrowRight,
  MagicWand, EnvelopeSimple, CaretLeft, CaretRight, CircleNotch, Clock, XCircle,
  Timer, DownloadSimple, PaperPlaneTilt,
} from '@phosphor-icons/react';

const STEPS = ['Import', 'Map', 'Preview', 'Send', 'Report'] as const;

/** The extension wizard, ported from the landing's product-tour slider (TICKET-037).
 *  Interactive: step dots, Back/Continue, and ←/→ keys move the track. */
export function ProductTour() {
  const [step, setStep] = useState(0);
  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
      if (e.key === 'ArrowRight') setStep((s) => Math.min(STEPS.length - 1, s + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="rounded-2xl border border-line bg-surface p-2 shadow-2xl shadow-black/60">
      <div className="overflow-hidden rounded-xl border border-line bg-raised">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-hi" />
          <span className="h-3 w-3 rounded-full bg-hi" />
          <span className="h-3 w-3 rounded-full bg-hi" />
          <span className="ml-3 font-mono text-sm text-white/40">mail.google.com</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
            <PaperPlaneTilt weight="bold" /> Fanout
          </span>
        </div>

        {/* stepper */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-line bg-surface/40 px-4 py-3 md:gap-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex shrink-0 items-center gap-2 md:gap-3">
              <button onClick={() => go(i)} className="focus-ring flex shrink-0 items-center gap-2 rounded-lg px-1 py-1">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full border text-sm font-semibold ease-fluid transition-all duration-500 ${
                    i === step ? 'border-accent bg-accent text-warm' : 'border-line bg-surface text-white/40'
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`text-sm ease-fluid transition-colors duration-500 ${i === step ? 'text-white' : 'text-white/40'}`}
                >
                  {label}
                </span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-4 shrink-0 bg-line md:w-8" />}
            </div>
          ))}
        </div>

        {/* viewport */}
        <div className="overflow-hidden">
          <div
            className="flex ease-fluid transition-transform duration-700"
            style={{ minHeight: 452, transform: `translateX(-${step * 100}%)` }}
          >
            <Slide><ImportSlide /></Slide>
            <Slide><MapSlide /></Slide>
            <Slide><PreviewSlide /></Slide>
            <Slide><SendSlide /></Slide>
            <Slide><ReportSlide /></Slide>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <span className="text-sm text-white/45">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => go(step - 1)}
              disabled={step === 0}
              className="focus-ring rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-white/80 ease-fluid transition-all duration-300 hover:bg-hi disabled:opacity-40"
            >
              Back
            </button>
            <button
              onClick={() => go(step + 1)}
              disabled={step === STEPS.length - 1}
              className="focus-ring rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-warm ease-fluid transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide({ children }: { children: React.ReactNode }) {
  return <div className="w-full shrink-0 p-6 md:p-8">{children}</div>;
}

function ImportSlide() {
  return (
    <>
      <h3 className="text-xl font-semibold">Import recipients</h3>
      <p className="mt-2 text-sm text-white/55">Upload a CSV or paste rows from a spreadsheet. Everything stays in this browser.</p>
      <div className="mt-5 inline-flex rounded-lg border border-line bg-surface p-1 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/15 px-3 py-1.5 font-semibold text-accent"><UploadSimple /> Upload CSV</span>
        <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-white/50"><ClipboardText /> Paste</span>
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-hi bg-surface/60 px-6 py-9 text-center">
        <CloudArrowUp className="fx-float mx-auto text-3xl text-white/40" />
        <p className="mt-3 text-sm text-white/55">Drop a CSV or <span className="font-medium text-accent">click to browse</span></p>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent"><FileCsv weight="bold" /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">northwind-list.csv</p>
          <p className="text-sm text-white/45">297 rows · 4 columns detected</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-accent"><CheckCircle weight="bold" /> ready</span>
      </div>
    </>
  );
}

function MapRow({ header, token, required }: { header: string; token: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="rounded-lg border border-line bg-raised px-3 py-1.5 font-mono text-sm text-white/75">{header}</span>
      <ArrowRight className="text-white/25" />
      {required ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-hi bg-raised px-3 py-1.5 text-sm text-white/75"><EnvelopeSimple className="text-white/45" /> Recipient</span>
      ) : (
        <span className="rounded-lg bg-accent/15 px-3 py-1.5 font-mono text-sm text-accent">{token}</span>
      )}
      {required ? (
        <span className="ml-auto text-sm text-white/40">required</span>
      ) : (
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-accent/80"><MagicWand /> auto</span>
      )}
    </div>
  );
}

function MapSlide() {
  return (
    <>
      <h3 className="text-xl font-semibold">Map your columns</h3>
      <p className="mt-2 text-sm text-white/55">Headers were matched to tokens automatically. Adjust any that look off.</p>
      <div className="mt-5 space-y-3">
        <MapRow header="First name" token="{{FirstName}}" />
        <MapRow header="Company" token="{{Company}}" />
        <MapRow header="City" token="{{City}}" />
        <MapRow header="Email address" token="" required />
      </div>
    </>
  );
}

function PreviewSlide() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-semibold">Preview a real row</h3>
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-accent"><CheckCircle weight="bold" /> No missing values</span>
      </div>
      <div className="mt-4 flex items-center gap-3 text-sm">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-white/50"><CaretLeft /></span>
        <span className="text-white/55">3 of 297</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-white/50"><CaretRight /></span>
        <span className="ml-1 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-white/70">priya.nair@northwind.co</span>
      </div>
      <div className="mt-4 rounded-xl border border-line bg-surface p-5">
        <p className="text-sm text-white/40">Subject</p>
        <p className="mt-1 text-base">Quick question, <span className="font-semibold">Priya</span></p>
        <div className="mt-4 space-y-3 text-base leading-relaxed text-white/80">
          <p>Hi <span className="font-semibold">Priya</span>,</p>
          <p>Saw that <span className="font-semibold">Northwind</span> just opened its Denver office. Congrats on the move.</p>
          <p className="text-white/40">Best,<br />Nita</p>
        </div>
      </div>
    </>
  );
}

function SendRow({ email, state }: { email: string; state: 'sent' | 'sending' | 'queued' }) {
  const icon = state === 'sending' ? <CircleNotch className="text-white/50" /> : state === 'queued' ? <Clock className="text-white/40" /> : <CheckCircle weight="bold" className="text-accent" />;
  return (
    <li className={`flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 ${state === 'sending' ? 'border-hi' : 'border-line'} ${state === 'queued' ? 'opacity-60' : ''}`}>
      {icon} {email}
      <span className={`ml-auto font-mono ${state === 'sending' ? 'text-accent' : 'text-white/35'}`}>{state}</span>
    </li>
  );
}

function SendSlide() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Sending campaign</h3>
        <span className="inline-flex items-center gap-1.5 text-sm text-accent"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> live</span>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-accent" style={{ transform: 'scaleX(0.62)', transformOrigin: 'left' }} />
      </div>
      <div className="mt-2 flex justify-between text-sm text-white/45"><span>184 of 297 sent</span><span>next in 14s</span></div>
      <ul className="mt-5 space-y-2 text-sm">
        <SendRow email="priya.nair@northwind.co" state="sent" />
        <SendRow email="deshawn.owens@harbor.io" state="sent" />
        <SendRow email="mara.koenig@lattice.dev" state="sending" />
        <SendRow email="tomas.rivera@brightpath.app" state="queued" />
      </ul>
      <p className="mt-4 text-sm text-white/40">Randomized 8 to 30s gap · daily cap 500 of 500 tracked</p>
    </>
  );
}

function ReportSlide() {
  return (
    <>
      <h3 className="text-xl font-semibold">Campaign complete</h3>
      <p className="mt-2 text-sm text-white/55">Every message left from your own Gmail, one at a time.</p>
      <div className="mt-6 grid items-center gap-6 md:grid-cols-2">
        <div className="relative grid place-items-center">
          <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#272727" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#E8B04B" strokeWidth="8" strokeLinecap="round" strokeDasharray="264" strokeDashoffset="0" />
          </svg>
          <div className="absolute text-center">
            <p className="text-2xl font-semibold">100%</p>
            <p className="text-sm text-white/45">delivered</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm text-white/60"><CheckCircle weight="bold" className="text-accent" /> Sent</span>
            <span className="font-mono text-sm">297</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm text-white/60"><XCircle className="text-white/40" /> Failed</span>
            <span className="font-mono text-sm text-white/70">0</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm text-white/60"><Timer className="text-white/40" /> Elapsed</span>
            <span className="font-mono text-sm text-white/70">2h 41m</span>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-white/80"><DownloadSimple /> Export report</span>
      </div>
    </>
  );
}
