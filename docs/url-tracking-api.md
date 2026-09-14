# URL tracking — sync API contract

*For the backend team implementing the ingest side of §7.3 website (URL) tracking. The
client-side implementation lives in `desktop/src/main/url-capture/` — see
`sync-contract.ts` for the exact TypeScript types this doc describes, and
`sync-queue.ts` for how the client uses them.*

## Endpoint

```
POST /device/url-sessions/sync
Authorization: Bearer <deviceToken>
Content-Type: application/json
```

Matches the existing `/device/*` prefix convention already used for time-entries and
projects (see `backend/src/time-entries/`, `backend/src/devices/`).

### Request body

```ts
interface SyncRequestBody {
  sessions: UrlSession[];
}

interface UrlSession {
  id: string;               // client-generated — see Idempotency below
  url: string;
  host: string;
  path: string | null;
  title: string | null;
  browser: string;
  private: boolean | null;  // true | false | null (null = couldn't be determined)
  deviceId: string;
  startedAt: number;        // wall-clock ms
  endedAt: number | null;
  activeMs: number;         // accumulated active time — NOT endedAt - startedAt
  tzOffsetMin: number;
  source: 'apple-events' | 'ax' | 'uia' | 'atspi' | 'title';
  confidence: 'exact' | 'displayed' | 'guess';
}
```

This is the pinned model from `CLAUDE.md` — the client never sends a session with
`endedAt: null` (an open, still-accumulating session). Only closed sessions are synced.

### Response body

```ts
interface SyncResponseBody {
  acked: string[];  // ids the server has durably persisted — may be a subset of the batch sent
}
```

## Idempotency — this is the load-bearing part

`id` is the client-generated idempotency key. **POSTing a batch containing an `id` the
server has already persisted must be a no-op success for that id** — return it in `acked`
again, don't error, don't duplicate the row. This is not an edge case to handle
defensively; the client relies on it structurally:

- If the client's local process crashes after the server durably persists a batch but
  before the client marks those ids as synced locally, the **next** sync attempt re-sends
  the same ids. The server must recognize them and just re-confirm.
- The same `id` can legitimately be sent to the server **more than once with different
  data** over its lifetime. The session engine's merge window can reopen a session that
  was already closed-and-synced (e.g. a brief lock/idle interruption on the same page) —
  when it closes again, the client re-syncs the *same id* with a larger `activeMs` and a
  later `endedAt`. Treat this as an upsert by `id`, not an insert-once: **last write wins**
  on `endedAt`/`activeMs`, not first.
- A partial `acked` list is expected, not exceptional — validation failures, rate
  limiting, or a mid-batch server error can all mean only some ids succeed. The client
  retries whatever isn't in `acked` on its next attempt; it never assumes all-or-nothing.

## Server-side clamping

Per `docs/url-tracking-plan.md` Step 5 ("Server clamps every session to the
tracked-time window"): a session's `[startedAt, endedAt]` range should be clamped to fall
within the bounds of whatever `time_entry` was actually running on that device at the
time, if any falls outside it entirely. Clamped sessions should still be included in
`acked` — from the client's perspective, "the server persisted something for this id" is
all that matters; it does not need the adjusted values echoed back.

## Joining a UrlSession to a time entry / timesheet

**No foreign key on `UrlSession` for this.** The pinned client-side shape only carries
`deviceId` — I'm deliberately not proposing a new field on it (e.g. `timeEntryId`) since
that's a pinned model and the client can't reliably know which `time_entry` id a session
belongs to at the moment it's captured (time entries are server-authoritative per
`docs/adr/0006-time-entries-single-running-timer-server-authoritative.md`; the desktop
agent doesn't hold that state today — see the open integration gap noted in
`docs/url-tracking-gap-analysis.md`).

**Proposed join: time-range overlap, computed at query/report time** —
`url_sessions.device_id = time_entry.device_id` (or however device→user is resolved)
`AND url_sessions.started_at < time_entry.ended_at`
`AND url_sessions.ended_at > time_entry.started_at`. This needs a decision from the
backend team before reporting queries are built against it — flagging it explicitly here
rather than assuming.

## Retention

The client purges its own local rows older than a configurable window regardless of sync
status (a privacy floor, not a sync-status-gated cleanup — see
`UrlSessionStore.purgeOlderThan`). The server should enforce its own retention
independently; don't rely on the client's local purge as the only enforcement point.

## Batching

The client sends up to 50 sessions per request by default (`SyncQueue`'s `batchSize`).
Nothing here requires that number specifically — it's a client-side tuning knob, not part
of the contract.
