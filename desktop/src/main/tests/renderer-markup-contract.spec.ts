import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The renderer resolves its elements once at module load with
 * `getElementById('x')!`. The `!` is a compile-time assertion only: if the
 * markup loses an id, TypeScript still passes, the lookup yields null, and
 * the first property write on it throws — taking down whatever function it
 * sat in. That is exactly how `paused-notice` went missing and silently
 * killed every timer path, since all of them run through `setRunning`.
 *
 * Lives under main/tests rather than beside the renderer because vitest only
 * collects `src/main`, and this needs no DOM — it reads both files as text.
 */
const RENDERER_DIR = join(__dirname, '..', '..', 'renderer');

function read(name: string): string {
  return readFileSync(join(RENDERER_DIR, name), 'utf8');
}

describe('renderer markup contract', () => {
  it('index.html defines every id the renderer looks up', () => {
    const renderer = read('renderer.ts');
    const html = read('index.html');

    const wanted = [
      ...renderer.matchAll(/getElementById\(["']([^"']+)["']\)/g),
    ].map((match) => match[1]);
    const present = new Set(
      [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]),
    );

    // Guards the guard: a renderer that looked nothing up would pass vacuously.
    expect(wanted.length).toBeGreaterThan(0);

    const missing = [...new Set(wanted)].filter((id) => !present.has(id));
    expect(missing).toEqual([]);
  });

  it('every class the renderer toggles has a rule in styles.css', () => {
    const renderer = read('renderer.ts');
    const styles = read('styles.css');

    const toggled = [
      ...renderer.matchAll(/classList\.(?:toggle|add)\(["']([^"']+)["']/g),
    ].map((match) => match[1]);

    expect(toggled.length).toBeGreaterThan(0);

    const unstyled = [...new Set(toggled)].filter(
      (name) => !styles.includes(`.${name}`),
    );
    expect(unstyled).toEqual([]);
  });
});
