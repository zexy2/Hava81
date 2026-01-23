/**
 * Application Entry Point
 */

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { validateConfig } from './config';
import './index.css';

// Validate configuration before rendering
const isConfigValid = validateConfig();

if (!isConfigValid && process.env.NODE_ENV === 'production') {
  console.error('Application cannot start due to invalid configuration');
}

// Performance monitoring
if (process.env.NODE_ENV === 'development') {
  // Report web vitals in development
  // eslint-disable-next-line no-console
  import('web-vitals').then((vitals) => {
    vitals.getCLS((metric) => console.debug('CLS:', metric));
    vitals.getFID((metric) => console.debug('FID:', metric));
    vitals.getFCP((metric) => console.debug('FCP:', metric));
    vitals.getLCP((metric) => console.debug('LCP:', metric));
    vitals.getTTFB((metric) => console.debug('TTFB:', metric));
  });
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container not found. Make sure there is a <div id="root"></div> in your HTML.');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
