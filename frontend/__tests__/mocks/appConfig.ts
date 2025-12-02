import { vi } from 'vitest';

export const mockCognitoConfig = {
  region: 'us-east-1',
  userPoolId: 'mock-pool-id',
  userPoolWebClientId: 'mock-client-id',
  identityPoolId: 'mock-identity-pool-id',
};

export const mockApiConfig = {
  BASE_URL: 'http://localhost:3001',
  ENDPOINTS: {
    SEARCH: '/',
    MESSAGE_GENERATION: '/ai/generate-message',
  },
  TIMEOUT: 100000000,
} as const;

export const mockStorageKeys = {
  VISITED_LINKS: 'visitedLinks',
  SEARCH_RESULTS: 'searchResults',
} as const;

export const mockUiConfig = {
  DEBOUNCE_DELAY: 300,
  MAX_RETRIES: 3,
} as const;

let cognitoConfigured = true;

export const mockAppConfig = {
  cognitoConfig: mockCognitoConfig,
  validateCognitoConfig: vi.fn(() => cognitoConfigured),
  get isCognitoConfigured() {
    return cognitoConfigured;
  },
  API_CONFIG: mockApiConfig,
  STORAGE_KEYS: mockStorageKeys,
  UI_CONFIG: mockUiConfig,
};

export const setIsCognitoConfigured = (value: boolean) => {
  cognitoConfigured = value;
  mockAppConfig.validateCognitoConfig.mockReturnValue(value);
};

export const resetAppConfigMocks = () => {
  cognitoConfigured = true;
  mockAppConfig.validateCognitoConfig.mockReset();
  mockAppConfig.validateCognitoConfig.mockReturnValue(true);
};

export const createMockAppConfig = () => ({
  cognitoConfig: mockCognitoConfig,
  validateCognitoConfig: mockAppConfig.validateCognitoConfig,
  isCognitoConfigured: cognitoConfigured,
  API_CONFIG: mockApiConfig,
  STORAGE_KEYS: mockStorageKeys,
  UI_CONFIG: mockUiConfig,
});
