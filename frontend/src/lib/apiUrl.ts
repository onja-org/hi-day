// Browser-facing requests go through the Next.js rewrite proxy configured in
// next.config.ts (source "/api/backend/:path*"), so the browser only ever
// talks to the frontend's own origin. This is what makes the backend's
// session cookies work in production: the frontend (Vercel) and backend
// (Railway) are unrelated domains, so a cookie set directly by the backend
// would never be visible to the frontend's own server-rendered auth checks.
// Routing through this same-origin path makes the cookie the browser stores
// belong to the frontend's domain instead. See isAuthenticated.ts for the
// one place that still talks to the backend's real origin directly (a
// server-to-server call, which isn't subject to this cookie/domain issue).
export const API_URL = "/api/backend";
