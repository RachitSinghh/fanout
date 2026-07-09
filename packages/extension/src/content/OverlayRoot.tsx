import { createRoot, type Root } from 'react-dom/client';
import overlayCss from '../ui/styles/app.css?inline';
import { OverlayApp } from '../ui/overlay/OverlayApp';
import type { ComposeSnapshot } from './gmailDom';
import { detectGmailDark } from './gmailDom';
import { logger } from '../lib/logger';

const HOST_ID = 'fanout-overlay-host';

let root: Root | null = null;
let hostEl: HTMLElement | null = null;

/** Mount the campaign overlay in an isolated Shadow DOM over Gmail. */
export function mountOverlay(compose: ComposeSnapshot): void {
  if (hostEl) {
    // Already open — bring to focus by re-rendering with fresh compose data.
    renderApp(compose);
    return;
  }
  hostEl = document.createElement('div');
  hostEl.id = HOST_ID;
  // Pin near max int, above Gmail chrome (FRONTEND_SPEC §4.6).
  hostEl.style.cssText =
    'position:fixed;inset:0;z-index:2147483000;';
  const shadow = hostEl.attachShadow({ mode: 'open' });

  // Prefer constructable stylesheets — they aren't subject to Gmail's CSP
  // style-src (unlike an injected <style> element). Fall back to <style>.
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(overlayCss);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = overlayCss;
    shadow.appendChild(style);
  }

  const mountPoint = document.createElement('div');
  mountPoint.setAttribute('data-theme', detectGmailDark() ? 'dark' : 'light');
  mountPoint.style.cssText = 'height:100%;';
  shadow.appendChild(mountPoint);

  document.body.appendChild(hostEl);
  root = createRoot(mountPoint);
  logger.info('overlay mounted');
  renderApp(compose);
}

function renderApp(compose: ComposeSnapshot): void {
  root?.render(<OverlayApp compose={compose} onClose={unmountOverlay} />);
}

export function unmountOverlay(): void {
  root?.unmount();
  root = null;
  hostEl?.remove();
  hostEl = null;
  logger.info('overlay unmounted');
}

export function isOverlayOpen(): boolean {
  return hostEl !== null;
}
