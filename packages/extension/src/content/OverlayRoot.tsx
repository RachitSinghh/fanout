import { createRoot, type Root } from 'react-dom/client';
// Bundle the @font-face rules (url()s are rewritten to web-accessible asset URLs)
// so Geist loads inside the Shadow DOM overlay too — not just the popup/options.
import geistCss from '@fontsource-variable/geist/index.css?inline';
import geistMonoCss from '@fontsource/geist-mono/400.css?inline';
import geistMonoMediumCss from '@fontsource/geist-mono/500.css?inline';
import overlayCss from '../ui/styles/app.css?inline';
import { OverlayApp } from '../ui/overlay/OverlayApp';
import type { ComposeSnapshot } from './gmailDom';
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
  // DESIGN.md: product surfaces use the near-black canvas. The theme is driven by
  // CSS-var overrides under `:host([data-theme='dark'])`, so the attribute MUST
  // live on the shadow host (this element) — not an inner div — to match.
  hostEl.setAttribute('data-theme', 'dark');
  // Pin near max int, above Gmail chrome (FRONTEND_SPEC §4.6).
  hostEl.style.cssText =
    'position:fixed;inset:0;z-index:2147483000;';
  const shadow = hostEl.attachShadow({ mode: 'open' });

  // Prefer constructable stylesheets — they aren't subject to Gmail's CSP
  // style-src (unlike an injected <style> element). Fall back to <style>.
  // Bundled font url()s are root-absolute (`/assets/…`); on mail.google.com those
  // would resolve to gmail's origin and 404. Rewrite to the extension origin
  // (assets/* is web-accessible, see manifest.config.ts) so Geist actually loads.
  const css = (geistCss + geistMonoCss + geistMonoMediumCss + overlayCss).replaceAll(
    'url(/assets/',
    `url(${chrome.runtime.getURL('assets/')}`,
  );
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = css;
    shadow.appendChild(style);
  }

  const mountPoint = document.createElement('div');
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
