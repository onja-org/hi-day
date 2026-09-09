// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // mock-resolver.mjs and fake-osascript.mjs are disposable, fixture-driven
    // test harnesses spawned as real child processes by their specs — not
    // shipped code, same footing as the JSON/text fixtures they read.
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      'src/main/url-capture/tests/mock-resolver.mjs',
      'src/main/resolvers/darwin/tests/fake-osascript.mjs',
      'src/main/resolvers/darwin/tests/fake-firefox-ax-helper.mjs',
      'src/main/resolvers/darwin/tests/fake-mdfind.mjs',
    ],
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
