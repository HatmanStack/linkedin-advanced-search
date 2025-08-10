export default {

  // Map relative ESM imports without .js extension
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Keep Node environment for backend/unit tests
  testEnvironment: 'node',

  // Disable Jest discovery (backend tests have been ported to Vitest)
  testMatch: ['<rootDir>/tests/__never__/*.never.js'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/lambda-deployments/',
    '/lambda-processing/',
    '/dist/'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'puppeteer-backend/**/*.js',
    '!puppeteer-backend/node_modules/**',
    '!puppeteer-backend/screenshots/**',
    '!puppeteer-backend/logs/**',
    '!puppeteer-backend/data/**'
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],

  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output
  verbose: true,

  // Handle haste map collisions
  haste: {
    enableSymlinks: false
  },

  // Timeout
  testTimeout: 30000
};