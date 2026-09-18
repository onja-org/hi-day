---
status: accepted
---

# Mutation responses carry a per-endpoint `message` field, added by hand rather than via a global interceptor

Only the auth/password-reset/invite-accept endpoints returned `{ message: string }`; every CRUD controller (tasks, projects, teams, memberships, notes, time-entries, screenshots, etc.) returned the bare entity or `void`. To let the frontend show a toast for every mutation, 40 backend mutation endpoints (`POST`/`PATCH`/`PUT`/`DELETE`, excluding desktop-only endpoints — see docs/adr/0020 — and the 10 that already returned `{ message }`) now return a `message` field, edited into each controller by hand rather than introduced through a `NestInterceptor` that wraps every response automatically. (50 non-desktop mutation endpoints exist in total: 9 in `auth.controller.ts` plus `invitation-accept.controller.ts`'s accept endpoint already carried a message. Notably, `auth.controller.ts`'s own `PATCH /me` — `updateProfile` — was not one of the 10 already covered, so it's in scope too; "auth" isn't a blanket exclusion, each endpoint was checked individually. Similarly, `device-pairing.controller.ts`'s `POST :code/approve` is web-facing and in scope even though the rest of that controller is desktop-only — see docs/adr/0020. `device-session.controller.ts`'s two endpoints were initially miscounted as in-scope during design; they're desktop-only too — see docs/adr/0020 — and are excluded from both this count and the actual implementation.)

Read (`GET`) endpoints are deliberately left untouched — no `message`, no toast. A toast is feedback for an action the user took; toasting on every background fetch/refetch would fire on nearly every page load and refetch.

## Considered options

- **Global response-transform interceptor** — one `app.useGlobalInterceptors(...)` wraps every controller's return value in an envelope and derives a default message, with a decorator to override it per route. Rejected: it would guarantee coverage for free on new endpoints, but it also means the message text is either auto-generated (generic, low-value copy) or centralizes ownership of wording somewhere disconnected from the code that knows what happened. Editing each endpoint by hand keeps the message colocated with, and specific to, the operation it describes.
- **Generic `{ data, message }` envelope** vs. **keeping the existing per-entity naming** (`{ task, message }`, `{ project, message }`) — kept the per-entity shape. It matches the naming the frontend's per-feature result types already used (`task`, `project`, …), so each type only grows by one field instead of being restructured into a new generic wrapper.
- **Per-module message constants file** (e.g. `tasks.messages.ts`) vs. **inline literal at the return site** — chose inline. A string used exactly once doesn't need extracting into a shared constant, and it keeps the wording next to the code it describes.

## Consequences

`void`-returning endpoints (deletes/removes) now return `{ message: string }` alone. Every other mutation returns its existing entity/DTO plus a sibling `message` field. There is intentionally no shared backend `ApiResponse<T>` type — each endpoint's return type is still declared inline, same as before. The initial estimate of "~90 endpoints" during design turned out to include GET fetchers and desktop-only controllers; the actual number touched by this change is 40 backend controller methods and 48 frontend `lib/*.ts` mutation files (see docs/adr/0019).
