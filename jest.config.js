export default {
  // Use ES modules
  preset: 'default',
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  
  // Module resolution
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }]
  },
  
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/test-*.js'
  ],
  
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