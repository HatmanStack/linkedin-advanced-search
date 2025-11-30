// Application-level constants
export const DELAYS = {
  TOAST_DURATION: 3000,
  API_RETRY: 1000,
  DEBOUNCE_DEFAULT: 300,
} as const;

export const LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_MESSAGE_LENGTH: 1000,
  MAX_CONNECTIONS_PER_PAGE: 50,
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PREFERENCES: 'user_preferences',
  DRAFT_MESSAGES: 'draft_messages',
  LAST_SYNC: 'last_sync',
} as const;
