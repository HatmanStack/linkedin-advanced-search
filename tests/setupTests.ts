import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_GATEWAY_URL: 'http://localhost:3001', // Local puppeteer backend
    MODE: 'test',
  },
  writable: true,
});

// Mock global fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.sessionStorage = sessionStorageMock as any;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
// Mock Cognito configuration for tests
vi.mock('@/config/appConfig', () => ({
  cognitoConfig: {
    region: 'us-west-2',
    userPoolId: 'us-west-2_TestPool123',
    userPoolWebClientId: '1234567890abcdefghijklmn',
    identityPoolId: 'us-west-2:12345678-1234-1234-1234-123456789012',
  },
  validateCognitoConfig: vi.fn(() => true),
  isCognitoConfigured: true,
  API_CONFIG: {
    BASE_URL: 'http://localhost:3001',
    ENDPOINTS: {
      SEARCH: '/',
      MESSAGE_GENERATION: '/ai/generate-message',
    },
    TIMEOUT: 100000000,
  },
  STORAGE_KEYS: {
    VISITED_LINKS: 'visitedLinks',
    SEARCH_RESULTS: 'searchResults',
  },
  UI_CONFIG: {
    DEBOUNCE_DELAY: 300,
    MAX_RETRIES: 3,
  },
}));

// Add Cognito-specific environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    ...import.meta.env,
    VITE_AWS_REGION: 'us-west-2',
    VITE_COGNITO_USER_POOL_ID: 'us-west-2_TestPool123',
    VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: '1234567890abcdefghijklmn',
    VITE_COGNITO_IDENTITY_POOL_ID: 'us-west-2:12345678-1234-1234-1234-123456789012',
    VITE_API_GATEWAY_URL: 'http://localhost:3001',
    VITE_PUPPETEER_BACKEND_URL: 'http://localhost:3001',
    MODE: 'test',
  },
  writable: true,
  configurable: true,
});
