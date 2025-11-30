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
    css: true,
    include: ['src/**/*.test.{js,ts,tsx}'],
    exclude: ['**/node_modules/**'],
  },
})
