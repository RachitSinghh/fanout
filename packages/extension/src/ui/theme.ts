/**
 * Theme handling. Popup/options follow the OS/Chrome theme; the Gmail overlay
 * detects Gmail's own dark theme (TICKET-003). Sets data-theme on the given
 * root so the CSS-variable aliases flip (FRONTEND_SPEC §2.4).
 */
export function applyTheme(root: HTMLElement, theme: 'light' | 'dark'): void {
  root.setAttribute('data-theme', theme);
}

export function applyThemeFromOS(root: HTMLElement): void {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  applyTheme(root, mql.matches ? 'dark' : 'light');
  mql.addEventListener('change', (e) => applyTheme(root, e.matches ? 'dark' : 'light'));
}
