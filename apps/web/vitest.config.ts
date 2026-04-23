import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, mergeConfig } from 'vitest/config';
import base from '../../vitest.config.ts';

export default mergeConfig(
  base,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      name: '@cac/web',
      environment: 'jsdom',
      include: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        '__tests__/**/*.test.ts',
        '__tests__/**/*.test.tsx',
      ],
      setupFiles: ['./vitest.setup.ts'],
      globals: false,
    },
  }),
);
