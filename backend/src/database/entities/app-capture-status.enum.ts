/**
 * Whether a Device can record which app is in front, as the desktop agent
 * last reported it (desktop/src/main/app-capture-health.ts). `degraded` is
 * some apps but not all — on Wayland, one of the two window sources missing.
 */
export enum AppCaptureStatus {
  OK = 'ok',
  DEGRADED = 'degraded',
  UNAVAILABLE = 'unavailable',
}
