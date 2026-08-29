import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SettingsProvider } from './context';
import { validateConfig } from './config';
import './i18n';
import './fonts.css';
import './index.css';

const CHUNK_RECOVERY_PARAM = '__hava81_chunk_reload';
const CHUNK_RECOVERY_STORAGE_KEY = 'hava81:chunk-recovery-at';
const CHUNK_RECOVERY_WINDOW_MS = 60_000;

const bootUrl = new URL(window.location.href);
const bootRecoveryAttempt = Number(bootUrl.searchParams.get(CHUNK_RECOVERY_PARAM) ?? 0);
if (bootUrl.searchParams.has(CHUNK_RECOVERY_PARAM)) {
  bootUrl.searchParams.delete(CHUNK_RECOVERY_PARAM);
  window.history.replaceState(window.history.state, '', bootUrl);
}

window.addEventListener('vite:preloadError', event => {
  const now = Date.now();
  let previousAttempt = Number.isFinite(bootRecoveryAttempt) ? bootRecoveryAttempt : 0;
  try {
    previousAttempt = Number(window.sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY) ?? 0);
  } catch {
    // Storage can be unavailable in privacy-restricted contexts; the URL guard still limits loops.
  }

  if (previousAttempt && now - previousAttempt < CHUNK_RECOVERY_WINDOW_MS) return;

  try {
    window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, String(now));
  } catch {
    // Best effort only.
  }

  event.preventDefault();
  const recoveryUrl = new URL(window.location.href);
  recoveryUrl.searchParams.set(CHUNK_RECOVERY_PARAM, String(now));
  window.location.replace(recoveryUrl.toString());
});

if (!validateConfig() && import.meta.env.PROD) {
  console.error('Application cannot start due to invalid configuration');
}

const container = document.getElementById('root');
if (!container) throw new Error('Root container not found.');

createRoot(container).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => undefined);
  });
}
