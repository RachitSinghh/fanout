import { defineManifest } from '@crxjs/vite-plugin';
import { loadEnv } from 'vite';

// The OAuth client id is public (a "Chrome App" client). It is safe to bundle.
// Load .env here directly: this module is imported by vite.config *before* its
// defineConfig callback runs loadEnv, so reading process.env would always miss
// the value and fall back to the placeholder. loadEnv reads `.env` for any mode.
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), 'VITE_');
const CLIENT_ID =
  env.VITE_GOOGLE_OAUTH_CLIENT_ID ||
  'REPLACE_WITH_CHROME_APP_OAUTH_CLIENT_ID.apps.googleusercontent.com';

export default defineManifest({
  manifest_version: 3,
  name: 'Fanout — Personalized Bulk Sender',
  short_name: 'Fanout',
  description:
    'Send personalized email to a list from your own Gmail — one individual message per recipient. A personalization tool, not a spam tool.',
  version: '0.1.0',
  icons: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png',
  },
  action: {
    default_title: 'Fanout',
    default_popup: 'src/ui/popup/index.html',
    default_icon: {
      '16': 'public/icons/icon-16.png',
      '32': 'public/icons/icon-32.png',
    },
  },
  options_page: 'src/ui/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://mail.google.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['identity', 'storage', 'alarms'],
  host_permissions: [
    'https://mail.google.com/*',
    'https://gmail.googleapis.com/*',
    'https://www.googleapis.com/*',
    'https://people.googleapis.com/*',
    // Fanout backend for telemetry/entitlement (TICKET-039/040). Both dev
    // (localhost) and the deployed web app — the SW needs host access to each so
    // the entitlement/telemetry fetch isn't CORS-blocked.
    'http://localhost:3000/*',
    'https://fanout-web.vercel.app/*',
  ],
  oauth2: {
    client_id: CLIENT_ID,
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'openid',
      'email',
      'profile',
    ],
  },
  // Allow the content script's injected Shadow-DOM overlay to load bundled fonts.
  web_accessible_resources: [
    {
      resources: ['assets/*', 'public/icons/*'],
      matches: ['https://mail.google.com/*'],
    },
  ],
});
