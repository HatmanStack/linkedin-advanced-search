export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_GATEWAY_URL || 'https://2c6mr2rri0.execute-api.us-west-2.amazonaws.com/prod',
  ENDPOINTS: {
    SEARCH: '/',
    MESSAGE_GENERATION: '/ai/generate-message',
  },
  TIMEOUT: 100000000,
} as const;

export const STORAGE_KEYS = {
  VISITED_LINKS: 'visitedLinks',
  SEARCH_RESULTS: 'searchResults',
} as const;

export const UI_CONFIG = {
  DEBOUNCE_DELAY: 300,
  MAX_RETRIES: 3,
} as const;