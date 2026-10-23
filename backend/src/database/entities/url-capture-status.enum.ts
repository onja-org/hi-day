/**
 * Whether a Device can read the websites people visit, as the desktop agent
 * last reported it (desktop/src/main/url-capture-health.ts). `degraded` is
 * some browsers but not all — one running without its accessibility tree.
 */
export enum UrlCaptureStatus {
  OK = 'ok',
  DEGRADED = 'degraded',
  UNAVAILABLE = 'unavailable',
}
