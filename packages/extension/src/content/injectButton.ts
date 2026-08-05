import { logger } from '../lib/logger';
import { observeComposes, snapshotCompose, type ComposeContext } from './gmailDom';
import { mountOverlay } from './OverlayRoot';

const BTN_CLASS = 'fanout-bulk-btn';

/**
 * Watch Gmail for compose windows and inject a "Bulk Personalize" button into
 * each one's toolbar (TICKET-003). Resilient to Gmail's SPA navigation and
 * dynamic DOM; never duplicates a button per compose.
 */
export function installComposeWatcher(): void {
  const disconnect = observeComposes((ctx) => {
    try {
      injectButton(ctx);
    } catch (e) {
      logger.warn('button injection failed', {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });
  // Content scripts persist for the tab's lifetime; keep the observer alive.
  void disconnect;
  logger.debug('compose watcher installed');
}

function injectButton(ctx: ComposeContext): void {
  if (!ctx.toolbar) return;
  // ctx.toolbar is the native Send button's immediate wrapper — Gmail's blue
  // rounded "pill". Appending INTO it makes the blue background wrap our button.
  // Insert as a sibling AFTER the pill so we sit on the neutral toolbar row.
  const group = ctx.toolbar;
  const row = group.parentElement;
  if (!row) return;
  // Guard against duplicates within this compose.
  if (ctx.container.querySelector(`.${BTN_CLASS}`)) return;

  const btn = document.createElement('div');
  btn.className = BTN_CLASS;
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');
  btn.setAttribute('aria-label', 'Bulk Personalize with Fanout');
  btn.textContent = '◆ Bulk Personalize';
  // Secondary tint, not a solid fill: Gmail's blue "Send" must stay the single
  // primary CTA — the injected action sits one step below it in the hierarchy.
  // Inline styles so we don't depend on Gmail's classes or leak our stylesheet.
  const REST = '#EEF2FF'; // indigo-50
  const HOVER = '#E0E7FF'; // indigo-100
  btn.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:6px',
    'height:36px',
    'padding:0 16px',
    'margin-left:8px',
    `background:${REST}`,
    'color:#4338CA', // indigo-700 — readable on the tint
    'font:500 13px/1 Inter, Roboto, Arial, sans-serif',
    'border:1px solid #C7D2FE', // indigo-200
    'border-radius:18px', // pill, matching Gmail's Send
    'cursor:pointer',
    'user-select:none',
    'white-space:nowrap',
    'transition:background 120ms ease',
  ].join(';');
  btn.addEventListener('mouseenter', () => (btn.style.background = HOVER));
  btn.addEventListener('mouseleave', () => (btn.style.background = REST));

  const open = () => {
    const snapshot = snapshotCompose(ctx);
    logger.info('opening Fanout overlay from compose');
    mountOverlay(snapshot);
  };
  btn.addEventListener('click', open);
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });

  row.insertBefore(btn, group.nextSibling);
}
