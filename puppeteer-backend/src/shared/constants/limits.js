// Rate limits and constraints
export const RATE_LIMITS = {
  MAX_CONNECTIONS_PER_DAY: 100,
  MAX_MESSAGES_PER_HOUR: 20,
  MAX_PROFILE_VIEWS_PER_DAY: 200,
  MAX_SEARCH_RESULTS: 1000,
};

export const TIMEOUTS = {
  PAGE_LOAD: 30000, // 30 seconds
  ELEMENT_WAIT: 10000, // 10 seconds
  API_REQUEST: 30000, // 30 seconds
  BROWSER_CLOSE: 5000, // 5 seconds
};

export const DELAYS = {
  MIN_ACTION: 2000, // 2 seconds
  MAX_ACTION: 5000, // 5 seconds
  HUMAN_TYPING: 100, // 100ms per character
  PAGE_SCROLL: 1000, // 1 second
};
