import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The browser-restart ask is a screen shown before login, not a banner over
 * the timer — it must never reappear once Continue has been pressed.
 *
 * Read as text, like renderer-markup-contract.spec.ts next door: vitest only
 * collects `src/main`, and these are structural facts about the renderer
 * rather than anything that needs a DOM.
 */
const RENDERER_DIR = join(__dirname, '..', '..', 'renderer');

function read(name: string): string {
  return readFileSync(join(RENDERER_DIR, name), 'utf8');
}

describe('browser restart is asked once, before login', () => {
  it('has no in-app banner left in the markup', () => {
    const html = read('index.html');

    expect(html).not.toContain('browser-restart-banner');
    expect(html).not.toContain('browser-restart-button');
  });

  it('has no in-app banner left in the renderer', () => {
    const renderer = read('renderer.ts');

    expect(renderer).not.toContain('browserRestartBanner');
    expect(renderer).not.toContain('refreshBrowserRestartBanner');
  });

  /**
   * One call site, in the boot path. A second — on a status poll, say, or
   * after logout — is exactly how this would creep back into the running
   * app, and it would not be obvious from reading either function alone.
   */
  it('asks the main process exactly once', () => {
    const renderer = read('renderer.ts');

    const asks = renderer.match(/setup\.browserRestartPrompt\(/g) ?? [];
    expect(asks).toHaveLength(1);
  });

  /**
   * `hidden` alone is only the UA stylesheet's `display: none`, which any
   * explicit `display` on the element overrides — so a view with its own
   * layout stays painted after it is hidden, drawn over whatever replaced
   * it. This file has been caught by it three times now (.update-banner,
   * .task-panel, .setup-view), hence the check rather than another comment.
   */
  it('hides every view that sets its own display', () => {
    const css = read('styles.css');

    const withDisplay = [
      ...css.matchAll(/^\.([a-z-]+)\s*\{[^}]*?\bdisplay:\s*(flex|grid|inline-flex|block)/gms),
    ].map((match) => match[1]);

    const unguarded = withDisplay.filter(
      (name) => !css.includes(`.${name}[hidden]`) && !css.includes(`#${name}[hidden]`),
    );

    // Only the views the renderer toggles need this; the rest are never hidden.
    const toggled = ['setup-view', 'update-banner', 'task-panel', 'idle-screen'];
    expect(unguarded.filter((name) => toggled.includes(name))).toEqual([]);
  });

  /**
   * The screen is only ever left by startApp(), so every path out of it has
   * to end somewhere — including the failing one. Without a rejection
   * handler the view simply stays put, which looks exactly like the screen
   * refusing to go away however many times Continue is pressed.
   */
  it('always leaves the screen, even when reading the session fails', () => {
    const renderer = read('renderer.ts');
    const start = renderer.indexOf('function startApp');
    const body = renderer.slice(start, renderer.indexOf('\n}', start));

    expect(body).toContain('.catch(');
    expect(body).toContain('showLoginView');
  });

  // Pressing Continue must leave the screen for good, not re-run the check.
  it('moves to the normal views on Continue without re-asking', () => {
    const renderer = read('renderer.ts');
    const handler = renderer.slice(
      renderer.indexOf('setupContinueButton.addEventListener'),
    );
    const body = handler.slice(0, handler.indexOf('\n});'));

    expect(body).toContain('continueFromBrowserRestart');
    expect(body).toContain('startApp()');
    expect(body).not.toContain('browserRestartPrompt');
  });
});
