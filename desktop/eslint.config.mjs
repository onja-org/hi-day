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
          allowDefaultProject: ['scripts/*.mjs', 'vitest.config.mts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Renderer files have their own tsconfig (tsconfig.renderer.json —
    // DOM lib, no Node types) that `tsconfig.json` doesn't include, and
    // `projectService` only auto-discovers a project named `tsconfig.json`
    // walking up from each file — it never finds a sibling, differently-
    // named config on its own. Previously these were routed through
    // `allowDefaultProject` instead, which gives ESLint no real type
    // information at all: every cross-file type (window.api.*, etc.)
    // resolved to `any`/"a type that cannot be resolved", silently
    // disabling type-aware linting for this entire directory rather than
    // linting it against its real types.
    files: ['src/renderer/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: false,
        project: ['./tsconfig.renderer.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
