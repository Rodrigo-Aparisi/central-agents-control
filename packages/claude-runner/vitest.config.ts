import { defineConfig, mergeConfig } from 'vitest/config';
import base from '../../vitest.config.ts';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      name: '@cac/claude-runner',
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    },
  }),
);
