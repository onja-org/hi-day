import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(rootDir, 'src', 'renderer');
const outDir = join(rootDir, 'dist', 'renderer');

mkdirSync(outDir, { recursive: true });

for (const file of ['index.html', 'styles.css']) {
  copyFileSync(join(srcDir, file), join(outDir, file));
}
