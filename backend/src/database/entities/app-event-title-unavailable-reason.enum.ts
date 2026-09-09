/**
 * Mirrors the desktop agent's TitleUnavailableReason
 * (desktop/src/main/window-sample.ts) — kept as its own enum here so a raw
 * app_event row is self-describing without cross-referencing the desktop
 * codebase.
 */
export enum AppEventTitleUnavailableReason {
  PERMISSION_DENIED = 'permission-denied',
  NOT_EXPOSED = 'not-exposed',
  HIDDEN_BY_APP = 'hidden-by-app',
}
