// The backend's real origin, for the rare server-side call that talks to it
// directly instead of through the /api/backend rewrite proxy (see apiUrl.ts).
// Never import this from a Client Component — it isn't NEXT_PUBLIC_-prefixed,
// so it's only available in server contexts anyway, but the point of routing
// almost everything through the proxy is to keep the browser off this origin
// entirely.
export const BACKEND_ORIGIN =
  process.env.BACKEND_ORIGIN ?? "http://localhost:3001";
