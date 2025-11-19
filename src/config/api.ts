// API configuration
export const API_CONFIG = {
  PUPPETEER_BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
  LAMBDA_API_URL: import.meta.env.VITE_LAMBDA_API_URL || '',
  REQUEST_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

export const API_ENDPOINTS = {
  // Puppeteer Backend endpoints
  PROFILE_INIT: '/api/profile/init',
  LINKEDIN_INTERACTION: '/api/linkedin/interaction',
  SEARCH: '/api/search',

  // Lambda endpoints (will be constructed with LAMBDA_API_URL)
  LAMBDA_PROFILE: '/profile',
  LAMBDA_CONNECTIONS: '/connections',
  LAMBDA_MESSAGES: '/messages',
} as const;
