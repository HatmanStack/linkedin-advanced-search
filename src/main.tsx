import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/App.tsx'

// Polyfills for AWS Cognito Identity JS
if (typeof global === 'undefined') {
  (window as unknown).global = globalThis;
}

if (typeof process === 'undefined') {
  (window as unknown).process = { env: {} };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
