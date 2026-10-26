import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
  preview: {
    port: 4173,
    // Keep ordinary local previews on the local API. Lighthouse explicitly
    // overrides this target to the public API so its same-origin requests load
    // real weather without weakening production CORS. Pages builds keep their
    // configured absolute API origin.
    proxy: {
      '/api': {
        target: process.env.HAVA81_PREVIEW_API_PROXY_TARGET || 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: true,
        configure: proxy => {
          // Keep upstream-connectivity failures visible in CI instead of leaving
          // the browser request to time out without identifying the proxy boundary.
          proxy.on('error', (error, request) => {
            const code = (error as NodeJS.ErrnoException).code ?? error.message;
            console.error(
              `[preview API proxy] ${request.method ?? 'GET'} ${request.url ?? '/'} failed: ${code}`
            );
          });
        },
      },
    },
  },
  build: {
    sourcemap: process.env.ANALYZE === "true",
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/index.tsx', 'src/setupTests.ts'],
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
  },
});
