import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/main/tests/**/*.spec.ts'],
    environment: 'node',
  },
});
