import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SettingsProvider } from './context';
import { validateConfig } from './config';
import './i18n';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource-variable/source-serif-4';
import './index.css';
import 'leaflet/dist/leaflet.css';

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
