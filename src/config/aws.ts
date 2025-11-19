// AWS configuration
export const AWS_CONFIG = {
  REGION: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  USER_POOL_ID: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  CLIENT_ID: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
} as const;
