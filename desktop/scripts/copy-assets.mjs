import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * @param {string} srcDir
 * @param {string} outDir
 * @param {string[]} files
 */
function copyInto(srcDir, outDir, files) {
  mkdirSync(outDir, { recursive: true });
  for (const file of files) {
    copyFileSync(join(srcDir, file), join(outDir, file));
  }
}

copyInto(
  join(rootDir, 'src', 'renderer'),
  join(rootDir, 'dist', 'renderer'),
  ['index.html', 'styles.css'],
);

// The browser registry (docs/url-tracking-plan.md Step 2) is data, not code —
// tsc only compiles .ts files, so it has to be copied into dist by hand,
// same as the renderer assets above.
copyInto(
  join(rootDir, 'src', 'main', 'url-capture'),
  join(rootDir, 'dist', 'main', 'url-capture'),
  ['browser-registry.json'],
);

// Same reason — the per-locale Firefox private-window marker table (Prompt
// B.2) is data FirefoxAxResolver reads at its own __dirname-relative path.
copyInto(
  join(rootDir, 'src', 'main', 'resolvers', 'darwin'),
  join(rootDir, 'dist', 'main', 'resolvers', 'darwin'),
  ['firefox-private-markers.json'],
);
