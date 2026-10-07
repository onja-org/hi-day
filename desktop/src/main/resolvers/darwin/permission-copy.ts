/**
 * User-facing copy and System Settings deep links — Prompt B.3 point 4:
 * "copy that explains what each permission unlocks in user language, not
 * API names." Kept as data, separate from whatever eventually renders it,
 * so copy changes never require touching UI code.
 */
export type SettingsPane = 'automation' | 'accessibility' | 'screenRecording';

export const SETTINGS_DEEP_LINKS: Record<SettingsPane, string> = {
  automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  screenRecording: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
};

export interface PermissionCopy {
  title: string;
  /** What it unlocks, in plain language — never an API or entitlement name. */
  unlocks: string;
  deniedGuidance: string;
}

export const AUTOMATION_COPY: PermissionCopy = {
  title: 'Let Hi Day see which app you\'re using',
  unlocks:
    'Lets the app notice which browser window you have open, and read its address bar, only while your timer is running.',
  deniedGuidance:
    'Website tracking is off for this browser until you allow it in System Settings → Privacy & Security → Automation.',
};

export const ACCESSIBILITY_COPY: PermissionCopy = {
  title: 'Let Hi Day read Firefox\'s address bar',
  unlocks:
    'Firefox doesn\'t support the faster method the other browsers use, so this is the only way to see which Firefox page you\'re on.',
  deniedGuidance:
    'Firefox will still show up in your activity, but without the specific page — just "Firefox" — until you allow this in System Settings → Privacy & Security → Accessibility.',
};

export const PERMISSION_COPY: Record<SettingsPane, PermissionCopy> = {
  automation: AUTOMATION_COPY,
  accessibility: ACCESSIBILITY_COPY,
  screenRecording: {
    title: 'Screen Recording',
    unlocks: 'Not currently used by this app.',
    deniedGuidance: 'No action needed.',
  },
};
