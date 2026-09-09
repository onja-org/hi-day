export interface CaptureSettings {
  windowTrackingEnabled: boolean;
}

/**
 * Applied whenever an Organisation hasn't explicitly set this (including
 * every org created before this existed) — off by default, so nothing is
 * captured until an admin opts in (see docs/adr/0009-...).
 */
export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  windowTrackingEnabled: false,
};
