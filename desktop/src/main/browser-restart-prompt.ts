import type { BrowserRestartPrompt } from '../preload/preload';
import { displayName } from './resolvers/linux/blind-browsers';
import { hasSeenBrowserRestartPrompt } from './setup-state';

const NO_PROMPT: BrowserRestartPrompt = {
  show: false,
  names: [],
  manual: [],
  warnings: [],
};

/** The shape of `BrowserRestartService.findBlind()` this decision reads. */
export interface BlindBrowserReportLike {
  restartable: { command: string }[];
  manual: { browser: { command: string }; reason: string }[];
  warnings: string[];
}

export interface BrowserRestartPromptDeps {
  platform: string;
  userDataDir: string;
  findBrowsers: () => BlindBrowserReportLike;
  log?: (line: string) => void;
}

/**
 * Whether to open the first-run screen asking for a browser restart, and
 * what it should name.
 *
 * Asks about every browser that was open when the launchers were shadowed,
 * not only the untracked ones. A browser that already had an accessibility
 * tree — one started under a screen reader, say — is tracked fine and would
 * never appear in the blind set, but its windows lost their launcher binding
 * along with everyone else's, and only a restart gives it back.
 *
 * Lives here rather than inline in main.ts so all four ways of answering
 * "no" are testable: off Linux, where the launcher override this
 * compensates for does not exist; once this install has answered; when no
 * browser was open to orphan, which leaves the one showing unspent for a
 * launch that has something to say; and when the scan itself fails, where
 * a missing prompt beats a window that never opens.
 */
export function browserRestartPrompt(
  deps: BrowserRestartPromptDeps,
): BrowserRestartPrompt {
  if (deps.platform !== 'linux') return NO_PROMPT;
  if (hasSeenBrowserRestartPrompt(deps.userDataDir)) return NO_PROMPT;

  try {
    const report = deps.findBrowsers();
    const names = [
      ...new Set(report.restartable.map((browser) => displayName(browser.command))),
    ];
    // Kept apart from `names`: Continue has no launcher to start these from,
    // so promising to restart them would be a lie. One entry per browser —
    // findBlind reports one per process, and two windows of the same browser
    // must not produce the same sentence twice.
    const manual = [
      ...new Map(
        report.manual.map((entry) => [
          entry.browser.command,
          { name: displayName(entry.browser.command), reason: entry.reason },
        ]),
      ).values(),
    ];
    const warnings = [...new Set(report.warnings)];
    return { show: names.length + manual.length > 0, names, manual, warnings };
  } catch (error) {
    deps.log?.(`[browser-restart] status unavailable: ${String(error)}`);
    return NO_PROMPT;
  }
}
