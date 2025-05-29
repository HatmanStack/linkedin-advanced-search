export const API_CONFIG = {
  BASE_URL: 'http://localhost:3001',
  ENDPOINTS: {
    SEARCH: '/',
  },
  TIMEOUT: 30000,
} as const;

export const STORAGE_KEYS = {
  VISITED_LINKS: 'visitedLinks',
  SEARCH_RESULTS: 'searchResults',
} as const;

export const UI_CONFIG = {
  DEBOUNCE_DELAY: 300,
  MAX_RETRIES: 3,
} as const;