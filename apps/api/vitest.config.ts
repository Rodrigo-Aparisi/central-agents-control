import { defineConfig, mergeConfig } from 'vitest/config';
import base from '../../vitest.config.ts';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      name: '@cac/api',
      include: ['src/**/*.test.ts', '__tests__/**/*.test.ts'],
      environment: 'node',
    },
  }),
);
