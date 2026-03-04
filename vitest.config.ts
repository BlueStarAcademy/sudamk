import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/server/__tests__/**/*.test.ts', '**/server/__tests__/**/*.spec.ts'],
    globals: false,
    pool: 'forks',
    testTimeout: 15000,
    hookTimeout: 10000,
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['server/**/*.ts'],
      exclude: ['server/__tests__/**', '**/*.d.ts', '**/node_modules/**'],
    },
  },
  resolve: {
    alias: {
      // Allow tests to resolve server imports the same way server does
      '@server': path.resolve(__dirname, 'server'),
    },
  },
});
