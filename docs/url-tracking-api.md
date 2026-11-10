# URL tracking: sync API contract

How the desktop agent uploads URL sessions to the backend. The client types are in `desktop/src/main/url-capture/sync-contract.ts` and `session-types.ts`, and `sync-queue.ts` sends them. The server side is `UrlSessionsService.sync` (`backend/src/url-sessions/`), reached through `DeviceTrackingController`.

## Endpoint

```
POST /device/url-sessions/sync
Authorization: Bearer <deviceToken>
Content-Type: application/json
```

Guarded by `DeviceSessionGuard`, like the other `/device/*` routes.

### Request body

```ts
interface SyncRequestBody {
  sessions: UrlSession[];   // 1 to 200 per request
}

interface UrlSession {
  id: string;               // UUID, client-generated idempotency key
  url: string;
  host: string;
  path: string | null;
  title: string | null;
  browser: string;
  private: boolean | null;  // null = couldn't be determined
  deviceId: string;         // UUID; required, but the server ignores it (see below)
  startedAt: number;        // wall-clock ms
  endedAt: number;          // always set on the wire
  activeMs: number;         // accumulated active time, NOT endedAt - startedAt
  tzOffsetMin: number;
  source: 'apple-events' | 'ax' | 'uia' | 'atspi' | 'title';
  confidence: 'exact' | 'displayed' | 'guess' | 'unknown';
}
```

The client only syncs rows with a non-null `endedAt`. That includes closed sessions and checkpoints. A checkpoint is a still-open session published so far, so a long read shows up before it ends. The same id is sent again later with a larger `activeMs`.

A private session (`private: true`) is sent with `url: ''` and `host: ''`.

`confidence: 'unknown'` is browser time whose address could not be read at all, for example a Linux browser started without its accessibility tree (see `docs/adr/0027-blind-browsers-at-runtime-and-unknown-url-time.md`). It is sent with `url: ''`, `host: ''` and `private: null`. `source` is the platform's own reading method, the one that came back empty. Reports show it as "Unknown website (<browser>)", one row per browser, and never offer it for deletion by URL. It is the only empty-url session reports show. Private sessions stay hidden.

### Response body

```ts
interface SyncResponseBody {
  acked: string[];  // ids the server has durably persisted
}
```

## Idempotency

`id` is the idempotency key, and the server upserts by it. The client depends on this:

- If the client crashes after the server stores a batch but before it marks the ids synced, it sends the same ids again. The server must store them again without error or duplicates and return them in `acked`.
- The same `id` can arrive more than once with different data. Checkpoints do this, and so does the session engine's merge window, which can reopen a closed and synced session after a short lock or idle break. Last write wins on `endedAt` and `activeMs`.
- `acked` may be a subset of the batch. The client retries whatever is missing and never assumes all-or-nothing.

What the server does today:

- It acks the whole batch or rejects it. One invalid session fails validation for the whole request with a 400. `older-backend-fallback.ts` handles the one known case: a backend older than `confidence: 'unknown'` rejects those sessions, so the client resends the batch without them and acks them locally.
- `deviceId` is taken from the authenticated device session, never from the body.
- If the member's "Track apps & URLs" setting is not `apps_urls`, the batch is acked without being stored, so the device doesn't retry it forever.
- If "Window titles" is off, `title` is stored as null. The desktop app also strips it before sending.

## Joining a UrlSession to a time entry

`UrlSession` has no time entry foreign key, and the pinned client shape stays that way. Time entries are server-authoritative (`docs/adr/0006-time-entries-single-running-timer-server-authoritative.md`), so the client can't know the entry id at capture time.

The join is done at read time, by Membership and time. `getDayGroupedByUrl` gives each session the project of the time entry covering its `startedAt` (`findEntryCovering`), and hides sessions no entry covers. When a time entry is deleted or its start or end moves, `CaptureCleanupService.pruneUncovered` deletes the URL sessions no remaining entry covers.

The server does not clamp `[startedAt, endedAt]` to the time entry window. Sessions are stored as received (ADR 0010).

## Read and delete endpoints

Web routes, JWT-authenticated, in `UrlSessionsController`:

- `GET /organisations/:id/url-sessions?membershipId=` lists sessions grouped by URL, most recent first. It reads at most 1000 raw rows. Defaults to the caller's own Membership.
- `GET /organisations/:id/url-sessions/day?date=YYYY-MM-DD&membershipId=&projectId=` returns one day grouped by hour, project and URL.
- `DELETE /organisations/:id/url-sessions?membershipId=&url=` deletes every session for one URL for one member. Admin or manager only (team managers included), never your own history, and audit-logged as `url_session.deleted_by_url`.

Viewing another member's sessions needs `canViewMembership`.

## Retention

The server has no time-based retention for URL sessions. Rows go away only through the per-URL delete or the time entry pruning above.

On the client, `UrlSessionStore.purgeOlderThan` exists but nothing calls it yet. The local database is emptied on logout, unsent rows included, and rows from another account are deleted when someone else signs in. Don't rely on the client for retention; the server must enforce its own when it gets one.

## Batching

The client sends up to 50 sessions per request (`SyncQueue`'s default `batchSize`), every 30 seconds (`SYNC_INTERVAL_MS` in `main.ts`). Both are client tuning knobs, not part of the contract. The server's limit of 200 is a defensive upper bound.
