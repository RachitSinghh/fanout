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
  // Guard against duplicates within this compose.
  if (ctx.container.querySelector(`.${BTN_CLASS}`)) return;

  const btn = document.createElement('div');
  btn.className = BTN_CLASS;
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');
  btn.setAttribute('aria-label', 'Bulk Personalize with Fanout');
  btn.textContent = '◆ Bulk Personalize';
  // Inline styles so we don't depend on Gmail's classes or leak our stylesheet.
  btn.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:6px',
    'height:36px',
    'padding:0 16px',
    'margin-left:8px',
    'background:#4F46E5',
    'color:#fff',
    'font:600 13px/1 Inter, Roboto, Arial, sans-serif',
    'border-radius:8px',
    'cursor:pointer',
    'user-select:none',
    'white-space:nowrap',
  ].join(';');

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

  ctx.toolbar.appendChild(btn);
}
