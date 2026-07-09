import { logger } from '../lib/logger';

/**
 * ALL Gmail DOM knowledge lives here (ARCHITECTURE §7.3). Gmail's markup is
 * obfuscated and churns, so selectors are intentionally attribute-based (stable)
 * rather than class-based, and every read degrades gracefully instead of
 * throwing.
 */

/** A detected Gmail compose window and the pieces we care about. */
export interface ComposeContext {
  /** The compose dialog/container element. */
  container: HTMLElement;
  /** The toolbar row that holds the native Send button (our anchor). */
  toolbar: HTMLElement | null;
  subjectInput: HTMLInputElement | null;
  bodyEditable: HTMLElement | null;
}

const COMPOSE_MARK = 'data-fanout-compose';

/** Find compose windows currently in the DOM. */
export function findComposeContainers(): HTMLElement[] {
  const out: HTMLElement[] = [];
  // A compose window reliably contains the subject input.
  const subjects = document.querySelectorAll<HTMLInputElement>('input[name="subjectbox"]');
  for (const subj of subjects) {
    const dialog = subj.closest<HTMLElement>('div[role="dialog"], .M9, .aoI') ?? subj.parentElement;
    if (dialog) out.push(dialog);
  }
  return out;
}

/** Resolve the interesting parts of a compose container, tolerating churn. */
export function readComposeContext(container: HTMLElement): ComposeContext {
  const subjectInput =
    container.querySelector<HTMLInputElement>('input[name="subjectbox"]');
  // The body editor: a rich-text region labelled "Message Body".
  const bodyEditable =
    container.querySelector<HTMLElement>('[role="textbox"][aria-label*="Message Body" i]') ??
    container.querySelector<HTMLElement>('[g_editable="true"]') ??
    container.querySelector<HTMLElement>('[role="textbox"]');
  // Anchor: the row containing the native Send button.
  const sendBtn =
    container.querySelector<HTMLElement>('[role="button"][aria-label^="Send" i]') ??
    container.querySelector<HTMLElement>('[data-tooltip^="Send" i]');
  const toolbar = sendBtn?.parentElement ?? null;
  return { container, toolbar, subjectInput, bodyEditable };
}

export interface ComposeSnapshot {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

/** Read the current subject/body out of a compose window. */
export function snapshotCompose(ctx: ComposeContext): ComposeSnapshot {
  const subject = ctx.subjectInput?.value ?? '';
  const bodyHtml = ctx.bodyEditable?.innerHTML ?? '';
  const bodyText = ctx.bodyEditable?.innerText ?? '';
  return { subject, bodyHtml, bodyText };
}

export function isMarked(container: HTMLElement): boolean {
  return container.getAttribute(COMPOSE_MARK) === '1';
}

export function mark(container: HTMLElement): void {
  container.setAttribute(COMPOSE_MARK, '1');
}

/**
 * Observe the document for compose windows opening (they mount dynamically and
 * survive SPA navigation). Calls `onCompose` once per newly-detected compose.
 * Returns a disconnect fn.
 */
export function observeComposes(onCompose: (ctx: ComposeContext) => void): () => void {
  const scan = () => {
    try {
      for (const container of findComposeContainers()) {
        if (isMarked(container)) continue;
        const ctx = readComposeContext(container);
        // Only act once the toolbar anchor exists (compose fully rendered).
        if (!ctx.toolbar) continue;
        mark(container);
        onCompose(ctx);
      }
    } catch (e) {
      // Never crash Gmail if markup shifts — log and carry on.
      logger.warn('compose scan failed (Gmail markup may have changed)', {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const observer = new MutationObserver(() => scan());
  observer.observe(document.body, { childList: true, subtree: true });
  scan(); // catch composes already open at injection time
  return () => observer.disconnect();
}

/** Detect Gmail's dark theme so the overlay can match (FRONTEND_SPEC §2.4). */
export function detectGmailDark(): boolean {
  const bg =
    getComputedStyle(document.body).backgroundColor ||
    getComputedStyle(document.documentElement).backgroundColor;
  const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return false;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Perceived luminance; dark surfaces score low.
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}
