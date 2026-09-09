/**
 * Typed failure taxonomy for the macOS resolver. Two kinds of check produce
 * these:
 *
 * 1. Our OWN guard checks, compiled into the AppleScript itself (is the app
 *    running? is it frontmost? does it have a window?) — these raise a
 *    custom `error "not-running"`-style string we chose ourselves, so
 *    matching on them is exact and doesn't depend on unverified OS wording.
 * 2. Real macOS/AppleScript failures we don't control — TCC consent denial,
 *    a browser's dictionary not supporting a command. These are classified
 *    by the documented, stable AppleScript error numbers (-1743, -1708,
 *    etc.), which are long-standing OS constants, not guessed one-off text.
 *    NEEDS VALIDATION AGAINST REAL HARDWARE — see docs/url-tracking-plan.md
 *    Step 29's test matrix; nothing here has been observed on a real Mac.
 */
export type AppleEventsErrorCode =
  | 'not-running'
  | 'not-frontmost'
  | 'no-window'
  | 'consent-denied'
  | 'timeout'
  | 'unsupported-dictionary'
  | 'unsupported-browser'
  | 'busy'
  | 'unknown';

export interface ClassifiedAppleEventsError {
  code: AppleEventsErrorCode;
  message: string;
}

const CUSTOM_MARKERS: ReadonlyArray<{ marker: string; code: AppleEventsErrorCode; message: string }> = [
  { marker: 'not-running', code: 'not-running', message: 'The target application is not running.' },
  { marker: 'not-frontmost', code: 'not-frontmost', message: 'The target application is not the frontmost app.' },
  { marker: 'no-window', code: 'no-window', message: 'The target application has no open window.' },
];

export function classifyAppleEventsFailure(
  stderr: string,
  timedOut: boolean,
): ClassifiedAppleEventsError {
  if (timedOut) {
    return { code: 'timeout', message: 'osascript did not complete within the deadline.' };
  }

  const text = stderr.trim();

  // Checked first: an OS-level failure can happen at any `tell` block,
  // before our own guard checks ever get a chance to raise their markers.
  if (/-1743\b/.test(text) || /not authorized to send apple events/i.test(text)) {
    return {
      code: 'consent-denied',
      message: 'Automation permission for this browser has not been granted.',
    };
  }

  for (const { marker, code, message } of CUSTOM_MARKERS) {
    if (text.includes(marker)) {
      return { code, message };
    }
  }

  if (/-1708\b/.test(text) || /doesn't understand/i.test(text)) {
    return {
      code: 'unsupported-dictionary',
      message: 'The target application does not support the expected AppleScript commands.',
    };
  }

  return {
    code: 'unknown',
    message: text.length > 0 ? text : 'osascript failed with no output on stderr.',
  };
}
