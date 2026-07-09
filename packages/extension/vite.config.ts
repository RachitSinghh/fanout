import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig(({ mode }) => {
  // Expose VITE_* to manifest.config.ts (read via process.env there).
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  for (const [k, v] of Object.entries(env)) process.env[k] = v;

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
