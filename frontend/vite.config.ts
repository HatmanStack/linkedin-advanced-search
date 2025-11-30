import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: 'globalThis',
    'process.env': 'import.meta.env'
  },
  optimizeDeps: {
    include: ['amazon-cognito-identity-js']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../tests/frontend/setupTests.ts'],
    css: true,
    include: ['../tests/frontend/**/*.test.{js,ts,tsx}'],
    exclude: [
      'node_modules/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', '../tests/', '**/*.test.{ts,tsx,js}', '**/*.config.{ts,js}', '**/ui/**'],
      thresholds: {
        global: {
          lines: 60,
          functions: 60,
          branches: 60,
          statements: 60
        }
      }
    }
  },
})
