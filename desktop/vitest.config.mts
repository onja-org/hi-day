import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/main/**/*.spec.ts'],
    environment: 'node',
  },
});
