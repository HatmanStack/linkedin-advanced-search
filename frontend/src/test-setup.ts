/**
 * Test setup file for Vitest
 * Provides mocks and configuration for testing environment
 */

import { vi } from 'vitest';

// Mock Cognito configuration for tests
vi.mock('@/config/appConfig', () => ({
  cognitoConfig: {
    region: 'us-west-2',
    userPoolId: 'test-user-pool-id',
    userPoolWebClientId: 'test-client-id',
    identityPoolId: 'test-identity-pool-id',
  },
  apiConfig: {
    apiGatewayUrl: 'http://localhost:3000/test',
    puppeteerBackendUrl: 'http://localhost:3001',
  },
}));

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_AWS_REGION: 'us-west-2',
    VITE_COGNITO_USER_POOL_ID: 'test-user-pool-id',
    VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: 'test-client-id',
    VITE_COGNITO_IDENTITY_POOL_ID: 'test-identity-pool-id',
    VITE_API_GATEWAY_URL: 'http://localhost:3000/test',
    VITE_PUPPETEER_BACKEND_URL: 'http://localhost:3001',
  },
  writable: true,
  configurable: true,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
