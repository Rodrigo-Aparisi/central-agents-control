import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.config.*',
        '**/scripts/**',
        '**/__tests__/**',
      ],
    },
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
