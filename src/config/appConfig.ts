// Unified application configuration
// Combines Cognito, API, and UI-related constants in one place

export const cognitoConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  userPoolWebClientId: import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID || '',
  identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || '',
};

export const validateCognitoConfig = () => {
  const requiredFields = ['userPoolId', 'userPoolWebClientId'];
  const missing = requiredFields.filter((field) => !cognitoConfig[field as keyof typeof cognitoConfig]);
  if (missing.length > 0) {
    console.warn('Missing Cognito configuration fields:', missing);
    console.warn('Using mock authentication. Please configure AWS Cognito environment variables.');
    return false;
  }
  return true;
};

export const isCognitoConfigured = validateCognitoConfig();

export const API_CONFIG = {
  // Production AWS API Gateway URL (fallback)
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



