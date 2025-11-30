// Application-level configuration
export const APP_CONFIG = {
  APP_NAME: 'LinkedIn Advanced Search',
  VERSION: '1.0.0',
  ENVIRONMENT: import.meta.env.MODE || 'development',
  IS_PRODUCTION: import.meta.env.PROD,
  IS_DEVELOPMENT: import.meta.env.DEV,
} as const;
