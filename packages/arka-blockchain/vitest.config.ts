import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@arka/types': resolve(__dirname, '../arka-types/src'),
      '@arka/utils': resolve(__dirname, '../arka-utils/src'),
      '@arka/crypto': resolve(__dirname, '../arka-crypto/src'),
    },
  },
});
