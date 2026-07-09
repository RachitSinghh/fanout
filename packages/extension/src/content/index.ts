import { logger } from '../lib/logger';

/**
 * Content-script entry. Runs on https://mail.google.com/*.
 * Installs the compose watcher (injects "Bulk Personalize") and listens for a
 * popup request to open the overlay directly (TICKET-003).
 */
logger.info('content script injected on Gmail');

async function init(): Promise<void> {
  const { installComposeWatcher } = await import('./injectButton');
  installComposeWatcher();

  chrome.runtime.onMessage.addListener((msg: unknown) => {
    if (msg && typeof msg === 'object' && (msg as { type?: string }).type === 'OPEN_OVERLAY') {
      void import('./OverlayRoot').then(({ mountOverlay }) =>
        mountOverlay({ subject: '', bodyHtml: '', bodyText: '' }),
      );
    }
    return false;
  });
}

void init();
