import type { BrowserRegistryEntry } from '../../url-capture/browser-registry';
import type { ClassifiedAppleEventsError } from './errors';
import type { OsascriptRunner } from './osascript-runner';
import { CHROMIUM_FAMILY_SCRIPT, SAFARI_SCRIPT, materializeScript } from './scripts';

export interface AppleEventsResolveSuccess {
  ok: true;
  url: string;
  title: string;
  private: boolean | null;
}
export interface AppleEventsResolveFailure {
  ok: false;
  error: ClassifiedAppleEventsError;
}
export type AppleEventsResolveResult = AppleEventsResolveSuccess | AppleEventsResolveFailure;

export function parseChromiumOutput(stdout: string): AppleEventsResolveResult {
  // url is fixed at the front, mode fixed at the back — title (the only
  // field that can plausibly contain a literal tab, e.g. a page title with
  // an embedded tab character) is whatever's left in between, rejoined.
  const fields = stdout.trimEnd().split('\t');
  if (fields.length < 3) {
    return {
      ok: false,
      error: { code: 'unknown', message: `Unexpected chromium-family output shape: ${JSON.stringify(stdout)}` },
    };
  }
  const url = fields[0];
  const mode = fields[fields.length - 1];
  const title = fields.slice(1, -1).join('\t');
  return { ok: true, url, title, private: mode === 'incognito' };
}

export function parseSafariOutput(stdout: string): AppleEventsResolveResult {
  const fields = stdout.trimEnd().split('\t');
  if (fields.length < 2) {
    return {
      ok: false,
      error: { code: 'unknown', message: `Unexpected Safari output shape: ${JSON.stringify(stdout)}` },
    };
  }
  const url = fields[0];
  const title = fields.slice(1).join('\t');
  // Safari has no private-mode signal at all — never guess `false` here.
  return { ok: true, url, title, private: null };
}

/**
 * Resolves a URL for a recognized browser via osascript/Apple Events.
 * Firefox (and anything else with no `darwinAppName` mapped) isn't handled
 * here at all — that's the Swift AX helper's job (Step 10 / Prompt B.2).
 */
export class AppleEventsResolver {
  constructor(private readonly runner: OsascriptRunner) {}

  async resolve(entry: BrowserRegistryEntry): Promise<AppleEventsResolveResult> {
    if (!entry.darwinAppName) {
      return {
        ok: false,
        error: { code: 'unsupported-browser', message: 'No Apple Events app name mapped for this browser.' },
      };
    }

    if (entry.family === 'webkit') {
      const scriptPath = materializeScript('safari', SAFARI_SCRIPT);
      const outcome = await this.runner.run(scriptPath);
      if (!outcome.ok) return outcome;
      return parseSafariOutput(outcome.stdout);
    }

    const scriptPath = materializeScript('chromium-family', CHROMIUM_FAMILY_SCRIPT);
    const outcome = await this.runner.run(scriptPath, [entry.darwinAppName]);
    if (!outcome.ok) return outcome;
    return parseChromiumOutput(outcome.stdout);
  }
}
