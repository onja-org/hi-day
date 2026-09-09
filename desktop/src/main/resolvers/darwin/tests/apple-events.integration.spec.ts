import { platform } from 'node:os';
import { describe, expect, it } from 'vitest';
import { lookupBrowser, loadBrowserRegistry } from '../../../url-capture/browser-registry';
import { AppleEventsResolver } from '../apple-events';
import { OsascriptRunner } from '../osascript-runner';

/**
 * Runs against a REAL, already-running, frontmost Chrome window — never in
 * CI, never without you explicitly opting in. Skipped unless both:
 *   - RUN_DARWIN_INTEGRATION=1 is set
 *   - this is actually darwin (no point even trying elsewhere)
 *
 * Before running: have Chrome open and frontmost, with Automation
 * permission for this terminal/app already granted (or be ready to approve
 * the TCC prompt), on any real page.
 *
 *   RUN_DARWIN_INTEGRATION=1 pnpm --filter desktop test apple-events.integration
 */
const shouldRun = process.env.RUN_DARWIN_INTEGRATION === '1' && platform() === 'darwin';

describe.skipIf(!shouldRun)('AppleEventsResolver — real browser integration', () => {
  it('resolves the frontmost, already-open Chrome window', async () => {
    const registry = loadBrowserRegistry();
    const { entry } = lookupBrowser(registry, 'darwin', 'com.google.Chrome');
    const resolver = new AppleEventsResolver(new OsascriptRunner());

    const result = await resolver.resolve(entry);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.length).toBeGreaterThan(0);
      expect(typeof result.private).toBe('boolean');
    }
  });
});
