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
  btn.setAttribute('title', 'Bulk Personalize with Fanout'); // hover tooltip
  // Icon-only, DESIGN.md button-secondary-on-light: white surface + hairline with
  // the yellow Fanout mark. Compact circle keeps Gmail's blue Send the primary CTA.
  // The gold app-icon itself is the button — no wrapper chrome.
  btn.innerHTML =
    '<svg width="28" height="28" viewBox="0 0 128 128" fill="none" aria-hidden="true">' +
    '<rect width="128" height="128" rx="30" fill="#E8B04B"/>' +
    '<g transform="translate(22 22) scale(3.5)">' +
    '<path d="M22 2 15 22 11 13 2 9 22 2Z" fill="#131209"/>' +
    '<path d="M22 2 11 13" stroke="#E8B04B" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</g></svg>';
  btn.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'margin-left:8px',
    'padding:0',
    'background:transparent',
    'border:0',
    'cursor:pointer',
    'user-select:none',
    'flex:0 0 auto',
    'border-radius:8px',
    'opacity:0.92',
    'transition:opacity 120ms ease, transform 120ms ease',
  ].join(';');
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '1';
    btn.style.transform = 'scale(1.06)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '0.92';
    btn.style.transform = 'scale(1)';
  });

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
