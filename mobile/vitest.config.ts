import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The pure logic in src/ (cookies, the API client's errors, the upload queue, deep links). Screens
 * are React Native and need a device or the web preview, so they are out of scope here.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
