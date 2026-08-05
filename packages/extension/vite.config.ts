import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), crx({ manifest })],
    // Icons are referenced from the manifest and emitted by CRXJS; disable the
    // implicit public/ copy so they aren't emitted twice.
    publicDir: false,
    server: {
      port: 5173,
      strictPort: true,
      hmr: { port: 5173 },
    },
    build: {
      target: 'esnext',
      sourcemap: mode !== 'production',
      // The service worker dynamically imports ./sendQueue. Vite normally wraps
      // dynamic imports in __vitePreload, whose polyfill touches `document` —
      // which doesn't exist in a SW, so it throws at eval and SW registration
      // fails (status 15). Disable module preload; native import() is enough.
      modulePreload: false,
      rollupOptions: {
        // CRXJS discovers HTML entry points from the manifest.
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
    },
  };
});
