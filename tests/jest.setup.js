/**
 * Jest setup file for Profile Initialization tests
 * Configures global test environment and mocks
 */

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Uncomment to suppress console output during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Helper to create mock request objects
  createMockRequest: (overrides = {}) => ({
    method: 'POST',
    url: '/api/profile-init',
    headers: {
      'authorization': 'Bearer valid-jwt-token',
      'user-agent': 'test-agent',
      'content-type': 'application/json'
    },
    body: {
      searchName: 'test@example.com',
      searchPassword: 'testpassword'
    },
    ...overrides
  }),

  // Helper to create mock response objects
  createMockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  },

  // Helper to create mock state objects
  createMockState: (overrides = {}) => ({
    searchName: 'test@example.com',
    searchPassword: 'testpassword',
    jwtToken: 'valid-jwt-token',
    requestId: 'test-request-id',
    recursionCount: 0,
    ...overrides
  }),

  // Helper to wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate random test data
  generateTestData: {
    profileId: () => `profile-${Math.random().toString(36).substr(2, 9)}`,
    requestId: () => `test-request-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    email: () => `test${Math.random().toString(36).substr(2, 5)}@example.com`,
    timestamp: () => new Date().toISOString()
  }
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-west-2';

// Suppress specific warnings during tests
const originalWarn = console.warn;
console.warn = (...args) => {
  // Suppress specific warnings that are expected during testing
  const message = args[0];
  if (typeof message === 'string') {
    if (message.includes('jest-haste-map') || 
        message.includes('duplicate module name') ||
        message.includes('experimental feature')) {
      return;
    }
  }
  originalWarn.apply(console, args);
};

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset modules
  jest.resetModules();
});

// Global setup
beforeAll(() => {
  // Any global setup needed for all tests
});

// Global cleanup
afterAll(() => {
  // Any global cleanup needed after all tests
});