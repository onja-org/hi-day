/** How a UrlSession's url/title were captured — see URL_TRACKING_CONTEXT.md's pinned resolver protocol. */
export enum UrlSessionSource {
  APPLE_EVENTS = 'apple-events',
  AX = 'ax',
  UIA = 'uia',
  ATSPI = 'atspi',
  TITLE = 'title',
}
