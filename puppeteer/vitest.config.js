import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['__tests__/setup.js'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        '__tests__/**',
        'vitest.config.js',
        'coverage/**',
      ],
    },
    testTimeout: 10000,
  },
});
