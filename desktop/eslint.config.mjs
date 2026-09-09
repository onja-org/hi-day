// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // mock-resolver.mjs is a disposable, fixture-driven test harness spawned
    // as a real child process by resolver-manager.spec.ts — not shipped code,
    // same footing as the JSON fixtures it reads.
    ignores: ['eslint.config.mjs', 'dist/**', 'src/main/url-capture/tests/mock-resolver.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'scripts/*.mjs',
            'vitest.config.mts',
            'src/renderer/*.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/renderer/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
);
