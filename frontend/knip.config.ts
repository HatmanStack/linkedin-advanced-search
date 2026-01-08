import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/main.tsx',
    'src/pages/**/*.tsx',
  ],
  project: [
    'src/**/*.{ts,tsx}',
  ],
  ignore: [
    // Test files
    'src/**/*.test.{ts,tsx}',
    'src/**/*.spec.{ts,tsx}',
    'src/setupTests.ts',
    // Generated types
    'src/**/*.d.ts',
    // Config files handled separately
    'vite.config.ts',
    'tailwind.config.ts',
    'vitest.config.ts',
  ],
  ignoreDependencies: [
    // Vite plugins configured in vite.config.ts
    '@vitejs/*',
    'vite',
    // TailwindCSS
    'tailwindcss',
    'autoprefixer',
    'postcss',
    // Testing dependencies
    'vitest',
    '@testing-library/*',
    'jsdom',
  ],
};

export default config;
