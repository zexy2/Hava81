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
    // The Lighthouse build uses a same-origin /api/v1 base so its browser
    // requests pass through this proxy instead of failing production CORS from
    // http://127.0.0.1. Production Pages builds keep their absolute API origin.
    proxy: {
      '/api': {
        target: process.env.HAVA81_PREVIEW_API_PROXY_TARGET || 'https://api.hava81.zekiakgul.dev',
        changeOrigin: true,
        secure: true,
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
