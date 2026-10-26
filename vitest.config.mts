import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for pure logic only (schedules, money, plan maths). Nothing here touches the
// database or the network, so CI can run them without secrets.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['**/*.test.ts'],
    // mobile/ runs its own tests with its own dependencies.
    exclude: ['node_modules/**', '.next/**', '.claude/**', 'mobile/**'],
    environment: 'node',
  },
});
