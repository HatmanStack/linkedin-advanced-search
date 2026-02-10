import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from '@/App.tsx';

// Polyfills for AWS Cognito Identity JS
if (typeof global === 'undefined') {
  (window as Window & { global: typeof globalThis }).global = globalThis;
}

if (typeof process === 'undefined') {
  (window as Window & { process: { env: Record<string, unknown> } }).process = { env: {} };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
