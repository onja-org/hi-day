/**
 * The resolver protocol, pinned in CLAUDE.md — one JSON object per line, over a
 * side-car child process's stdin/stdout. Do not add or rename fields without
 * updating every side-car implementation (win-resolver.exe, mac-resolver,
 * linux-resolver) in lockstep; this file is the single source of truth for the
 * wire shape on the Electron side.
 */

export type Source = 'apple-events' | 'ax' | 'uia' | 'atspi' | 'title';
export type Confidence = 'exact' | 'displayed' | 'guess';

export type ResolveRequest = { id: number; op: 'resolve'; pid: number; hwnd: number };
export type PingRequest = { id: number; op: 'ping' };
export type ResolverRequest = ResolveRequest | PingRequest;

export type ResolveOkResponse = {
  id: number;
  ok: true;
  url: string;
  title: string;
  browser: string;
  private: boolean | null;
  source: Source;
  confidence: Confidence;
  ms: number;
};

// Not shown in CLAUDE.md's pinned examples (only a successful `resolve` response
// is given). Ping acks and resolve failures both need a shape; these reuse the
// established `id`/`ok` discriminant rather than introducing new wire fields.
// The manager disambiguates a bare `{ id, ok: true }` from a full
// ResolveOkResponse by which op it sent for that id, not by an extra tag.
export type PingOkResponse = { id: number; ok: true };
export type ErrorResponse = { id: number; ok: false; message: string };

export type ResolverResponse = ResolveOkResponse | PingOkResponse | ErrorResponse;

export type FocusEvent = {
  ev: 'focus';
  pid: number;
  hwnd: number;
  app: string;
  title: string;
  ts: number;
};
export type ReadyEvent = { ev: 'ready'; platform: string; caps: string[] };
export type ErrorEvent = { ev: 'error'; code: string; detail: string };
export type ResolverEvent = FocusEvent | ReadyEvent | ErrorEvent;

/** Anything that can legally arrive on a side-car's stdout, one object per line. */
export type ResolverMessage = ResolverResponse | ResolverEvent;

export function isResolverEvent(message: ResolverMessage): message is ResolverEvent {
  return 'ev' in message;
}

export function isResolverResponse(message: ResolverMessage): message is ResolverResponse {
  return 'id' in message && 'ok' in message;
}

/**
 * Distinguishes a full resolve payload from a bare ping ack — both are
 * `{ ok: true }`, but only the former carries `url`. The manager never
 * assumes a response matches the request it was sent for; it checks.
 */
export function isResolveOkResponse(response: ResolverResponse): response is ResolveOkResponse {
  return response.ok === true && 'url' in response;
}

/**
 * The outcome of a single `resolve` call, as seen by callers of
 * ResolverManager#resolve — the `id` is manager bookkeeping, not part of the
 * public result.
 */
export type ResolveOutcome =
  | Omit<ResolveOkResponse, 'id'>
  | { ok: false; message: string };

export type PingOutcome = { ok: true } | { ok: false; message: string };
